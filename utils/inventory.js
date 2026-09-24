// Core inventory / menu-availability business logic.
// Pure functions only — no React, no DOM — so they're easy to unit test
// and easy to reason about in an interview.

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------
// Stock and recipes can express the same ingredient in different units
// (e.g. stock keeps Paneer in "kg", recipes need it in "g" per portion).
// We normalize everything to a *base unit* before comparing/subtracting:
//   mass family:   g   (kg -> g   : x1000)
//   volume family: ml  (l  -> ml  : x1000)
// Two ingredients can only be compared/deducted if they belong to the same
// family. Mixing "kg" stock with an "ml" recipe line is a data error, not a
// stock shortage, so we surface it as its own reason instead of silently
// miscalculating.

const MASS_UNITS = { g: 1, kg: 1000 };
const VOLUME_UNITS = { ml: 1, l: 1000 };

export function unitFamily(unit) {
  if (unit in MASS_UNITS) return "mass";
  if (unit in VOLUME_UNITS) return "volume";
  return "unknown";
}

// Converts a quantity to its family's base unit (g for mass, ml for volume).
// Returns null for an unrecognized unit so callers can flag it explicitly
// instead of accidentally treating it as zero.
export function toBaseUnits(qty, unit) {
  if (unit in MASS_UNITS) return qty * MASS_UNITS[unit];
  if (unit in VOLUME_UNITS) return qty * VOLUME_UNITS[unit];
  return null;
}

// Converts a base-unit quantity back into a target display unit
// (used after deducting stock, to store it back in the stock item's own unit).
export function fromBaseUnits(baseQty, targetUnit) {
  if (targetUnit in MASS_UNITS) return baseQty / MASS_UNITS[targetUnit];
  if (targetUnit in VOLUME_UNITS) return baseQty / VOLUME_UNITS[targetUnit];
  return null;
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

// Case-insensitive lookup — "paneer" and "Paneer" should be the same ingredient.
export function findStockItem(stock, name) {
  const target = name.trim().toLowerCase();
  return stock.find((s) => s.name.trim().toLowerCase() === target);
}

// Every recipe that lists this ingredient (used for the delete-guard rule).
export function recipesUsingIngredient(recipes, ingredientName) {
  const target = ingredientName.trim().toLowerCase();
  return recipes.filter((r) =>
    r.ingredients.some((i) => i.name.trim().toLowerCase() === target)
  );
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------
// Rule (as specified by the assignment): a dish is unavailable if ANY
// ingredient it needs is CURRENTLY at or below... below its par level.
// This checks *current* stock vs par — not whether there's literally enough
// left for one more portion. See README "Known limitations" for why that's
// a real edge case worth calling out.
//
// Returns: { available: boolean, reasons: string[] }
// reasons is always populated when available === false, so the UI can show
// *why* a dish is off the menu instead of just a blank "unavailable".
export function getDishAvailability(dish, stock) {
  const reasons = [];

  for (const ing of dish.ingredients) {
    const stockItem = findStockItem(stock, ing.name);

    if (!stockItem) {
      reasons.push(`${ing.name} is not tracked in stock`);
      continue;
    }

    if (unitFamily(stockItem.unit) !== unitFamily(ing.unit)) {
      reasons.push(
        `${ing.name} unit mismatch (stock: ${stockItem.unit}, recipe: ${ing.unit})`
      );
      continue;
    }

    const stockBase = toBaseUnits(stockItem.qty, stockItem.unit);
    const parBase = toBaseUnits(stockItem.par, stockItem.unit);

    if (stockBase < parBase) {
      reasons.push(`${ing.name} is below par`);
    }
  }

  return { available: reasons.length === 0, reasons };
}

// Convenience: availability for every dish, keyed by dish name.
export function getMenuAvailability(recipes, stock) {
  return recipes.map((dish) => ({
    dish,
    ...getDishAvailability(dish, stock),
  }));
}

// ---------------------------------------------------------------------------
// Ordering / stock deduction
// ---------------------------------------------------------------------------
// Deducts one portion of `dish` from `stock`. Does NOT mutate the input —
// returns a new stock array so React state updates stay predictable.
//
// Throws a descriptive Error instead of silently doing the wrong thing when:
//  - the dish is currently unavailable (UI should already prevent this, but
//    the logic layer re-checks so it can't be bypassed)
//  - the order would push any ingredient below zero
// This keeps "can this order happen" logic in one place instead of split
// between the UI and the data layer.
export function orderDish(dish, stock) {
  const { available, reasons } = getDishAvailability(dish, stock);
  if (!available) {
    throw new Error(
      `Cannot order "${dish.dish}": ${reasons.join(", ")}`
    );
  }

  const nextStock = stock.map((item) => ({ ...item }));

  for (const ing of dish.ingredients) {
    const stockItem = nextStock.find(
      (s) => s.name.trim().toLowerCase() === ing.name.trim().toLowerCase()
    );

    const stockBase = toBaseUnits(stockItem.qty, stockItem.unit);
    const deductBase = toBaseUnits(ing.qty, ing.unit);
    const newBase = stockBase - deductBase;

    if (newBase < 0) {
      throw new Error(
        `Cannot order "${dish.dish}": would make ${stockItem.name} negative`
      );
    }

    stockItem.qty = fromBaseUnits(newBase, stockItem.unit);
  }

  return nextStock;
}

// ---------------------------------------------------------------------------
// Delete guard
// ---------------------------------------------------------------------------
// Returns { canDelete, message } instead of a bare boolean so the UI can
// show the exact reason ("used by 2 recipes") without recomputing anything.
export function canDeleteIngredient(stock, recipes, ingredientName) {
  const usedBy = recipesUsingIngredient(recipes, ingredientName);
  if (usedBy.length > 0) {
    const names = usedBy.map((r) => r.dish).join(", ");
    return {
      canDelete: false,
      message: `${ingredientName} cannot be deleted because it is used by ${usedBy.length} recipe${usedBy.length > 1 ? "s" : ""} (${names}).`,
    };
  }
  return { canDelete: true, message: null };
}

// ---------------------------------------------------------------------------
// Validation (add / edit ingredient form)
// ---------------------------------------------------------------------------
// Rules (documented in README):
//   - name must be non-empty after trimming
//   - name must be unique (case-insensitive), except when editing itself
//   - quantity must be a valid number >= 0
//   - par must be a valid number >= 0
export function validateIngredient(
  { name, qty, par },
  stock,
  { editingName } = {}
) {
  const errors = {};
  const trimmedName = (name ?? "").trim();

  if (!trimmedName) {
    errors.name = "Name is required.";
  } else {
    const duplicate = stock.find(
      (s) =>
        s.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        s.name.trim().toLowerCase() !== (editingName ?? "").trim().toLowerCase()
    );
    if (duplicate) errors.name = "An ingredient with this name already exists.";
  }

  const qtyNum = Number(qty);
  if (qty === "" || qty === null || qty === undefined || Number.isNaN(qtyNum)) {
    errors.qty = "Quantity must be a number.";
  } else if (qtyNum < 0) {
    errors.qty = "Quantity cannot be negative.";
  }

  const parNum = Number(par);
  if (par === "" || par === null || par === undefined || Number.isNaN(parNum)) {
    errors.par = "Par level must be a number.";
  } else if (parNum < 0) {
    errors.par = "Par level cannot be negative.";
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
