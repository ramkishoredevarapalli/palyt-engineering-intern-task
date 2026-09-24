import { describe, it, expect } from "vitest";
import {
  getDishAvailability,
  orderDish,
  canDeleteIngredient,
  validateIngredient,
  toBaseUnits,
} from "./inventory";

// Small helpers to build minimal stock/recipe fixtures per test, so each
// test is self-contained and easy to read top-to-bottom.
const paneerCurry = (qty = 180, unit = "g") => ({
  dish: "Paneer Curry",
  price: 250,
  ingredients: [{ name: "Paneer", qty, unit }],
});

describe("getDishAvailability", () => {
  it("Test 1 — available when every ingredient is at/above par", () => {
    const stock = [{ name: "Paneer", qty: 1000, unit: "g", par: 500 }];
    const result = getDishAvailability(paneerCurry(), stock);
    expect(result.available).toBe(true);
  });

  it("Test 2 — unavailable when an ingredient is below par", () => {
    const stock = [{ name: "Paneer", qty: 400, unit: "g", par: 500 }];
    const result = getDishAvailability(paneerCurry(), stock);
    expect(result.available).toBe(false);
    expect(result.reasons[0]).toMatch(/below par/);
  });

  it("Test 3 — unavailable if ANY one of several ingredients is below par", () => {
    const dish = {
      dish: "Chicken Burger",
      price: 200,
      ingredients: [
        { name: "Chicken", qty: 200, unit: "g" },
        { name: "Bread", qty: 1, unit: "g" }, // treat as mass for the test
      ],
    };
    const stock = [
      { name: "Chicken", qty: 1000, unit: "g", par: 500 }, // fine
      { name: "Bread", qty: 3, unit: "g", par: 5 }, // below par
    ];
    const result = getDishAvailability(dish, stock);
    expect(result.available).toBe(false);
    expect(result.reasons).toContain("Bread is below par");
  });

  it("Test 6 — raising par above current stock flips an available dish to unavailable", () => {
    const stock = [{ name: "Paneer", qty: 700, unit: "g", par: 500 }];
    expect(getDishAvailability(paneerCurry(), stock).available).toBe(true);

    const restocked = [{ name: "Paneer", qty: 700, unit: "g", par: 800 }];
    expect(getDishAvailability(paneerCurry(), restocked).available).toBe(false);
  });

  it("Test 7 — restocking above par makes an unavailable dish available again", () => {
    const low = [{ name: "Paneer", qty: 400, unit: "g", par: 500 }];
    expect(getDishAvailability(paneerCurry(), low).available).toBe(false);

    const restocked = [{ name: "Paneer", qty: 700, unit: "g", par: 500 }];
    expect(getDishAvailability(paneerCurry(), restocked).available).toBe(true);
  });

  it("flags an ingredient the recipe needs but stock doesn't track", () => {
    const stock = [];
    const result = getDishAvailability(paneerCurry(), stock);
    expect(result.available).toBe(false);
    expect(result.reasons[0]).toMatch(/not tracked/);
  });

  it("flags a unit-family mismatch instead of miscalculating", () => {
    const stock = [{ name: "Paneer", qty: 5, unit: "ml", par: 1 }]; // wrong family
    const result = getDishAvailability(paneerCurry(), stock);
    expect(result.available).toBe(false);
    expect(result.reasons[0]).toMatch(/unit mismatch/);
  });
});

describe("unit conversion", () => {
  it("Test 5 — 5kg stock minus a 180g order leaves 4.82kg (4820g)", () => {
    const stock = [{ name: "Paneer", qty: 5, unit: "kg", par: 0.5 }];
    const next = orderDish(paneerCurry(180, "g"), stock);
    const updated = next.find((s) => s.name === "Paneer");
    expect(updated.qty).toBeCloseTo(4.82, 5);
    expect(toBaseUnits(updated.qty, updated.unit)).toBeCloseTo(4820, 3);
  });
});

describe("orderDish (Test 4 — deduction)", () => {
  it("subtracts the recipe amount from stock, same units", () => {
    const stock = [{ name: "Paneer", qty: 1000, unit: "g", par: 500 }];
    const next = orderDish(paneerCurry(180, "g"), stock);
    expect(next.find((s) => s.name === "Paneer").qty).toBe(820);
  });

  it("does not mutate the original stock array", () => {
    const stock = [{ name: "Paneer", qty: 1000, unit: "g", par: 500 }];
    orderDish(paneerCurry(180, "g"), stock);
    expect(stock[0].qty).toBe(1000);
  });

  it("refuses to order a currently-unavailable dish", () => {
    const stock = [{ name: "Paneer", qty: 100, unit: "g", par: 500 }];
    expect(() => orderDish(paneerCurry(180, "g"), stock)).toThrow(/Cannot order/);
  });

  it("refuses an order that would make stock negative", () => {
    // Constructed case: par is 0 so the dish reads as "available", but the
    // portion size is bigger than what's left in stock.
    const stock = [{ name: "Paneer", qty: 100, unit: "g", par: 0 }];
    expect(() => orderDish(paneerCurry(180, "g"), stock)).toThrow(/negative/);
  });
});

describe("canDeleteIngredient", () => {
  const recipes = [
    { dish: "A", price: 1, ingredients: [{ name: "Cashews", qty: 10, unit: "g" }] },
    { dish: "B", price: 1, ingredients: [{ name: "Cashews", qty: 5, unit: "g" }] },
  ];

  it("blocks deleting an ingredient used by recipes", () => {
    const stock = [{ name: "Cashews", qty: 300, unit: "g", par: 100 }];
    const result = canDeleteIngredient(stock, recipes, "Cashews");
    expect(result.canDelete).toBe(false);
    expect(result.message).toMatch(/used by 2 recipes/);
  });

  it("allows deleting an ingredient no recipe uses", () => {
    const stock = [{ name: "Bay Leaves", qty: 40, unit: "g", par: 10 }];
    const result = canDeleteIngredient(stock, recipes, "Bay Leaves");
    expect(result.canDelete).toBe(true);
  });
});

describe("validateIngredient", () => {
  const stock = [{ name: "Paneer", qty: 1, unit: "kg", par: 0.5 }];

  it("rejects an empty name", () => {
    const { valid, errors } = validateIngredient({ name: "  ", qty: 1, par: 1 }, stock);
    expect(valid).toBe(false);
    expect(errors.name).toBeDefined();
  });

  it("rejects a duplicate name (case-insensitive)", () => {
    const { valid, errors } = validateIngredient({ name: "paneer", qty: 1, par: 1 }, stock);
    expect(valid).toBe(false);
    expect(errors.name).toBeDefined();
  });

  it("allows editing an ingredient to keep its own name", () => {
    const { valid } = validateIngredient(
      { name: "Paneer", qty: 2, par: 1 },
      stock,
      { editingName: "Paneer" }
    );
    expect(valid).toBe(true);
  });

  it("rejects negative quantity and negative par", () => {
    const { errors } = validateIngredient({ name: "New", qty: -1, par: -5 }, stock);
    expect(errors.qty).toBeDefined();
    expect(errors.par).toBeDefined();
  });

  it("rejects non-numeric quantity", () => {
    const { errors } = validateIngredient({ name: "New", qty: "abc", par: 1 }, stock);
    expect(errors.qty).toBeDefined();
  });
});
