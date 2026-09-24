import { useState } from "react";
import { canDeleteIngredient, validateIngredient } from "../utils/inventory";

const UNITS = ["g", "kg", "ml", "l"];

const emptyForm = { name: "", qty: "", unit: "g", par: "" };

export default function StockPanel({ stock, recipes, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [addForm, setAddForm] = useState(emptyForm);
  const [addErrors, setAddErrors] = useState({});
  const [editingName, setEditingName] = useState(null); // name of row currently being edited
  const [editForm, setEditForm] = useState(emptyForm);
  const [editErrors, setEditErrors] = useState({});
  const [deleteMessage, setDeleteMessage] = useState(null);

  const filtered = stock.filter((s) =>
    s.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  function handleAddSubmit(e) {
    e.preventDefault();
    const { valid, errors } = validateIngredient(addForm, stock);
    if (!valid) {
      setAddErrors(errors);
      return;
    }
    onAdd({
      name: addForm.name.trim(),
      qty: Number(addForm.qty),
      unit: addForm.unit,
      par: Number(addForm.par),
    });
    setAddForm(emptyForm);
    setAddErrors({});
  }

  function startEdit(item) {
    setEditingName(item.name);
    setEditForm({ name: item.name, qty: item.qty, unit: item.unit, par: item.par });
    setEditErrors({});
    setDeleteMessage(null);
  }

  function cancelEdit() {
    setEditingName(null);
    setEditErrors({});
  }

  function handleEditSubmit(e, originalName) {
    e.preventDefault();
    const { valid, errors } = validateIngredient(editForm, stock, {
      editingName: originalName,
    });
    if (!valid) {
      setEditErrors(errors);
      return;
    }
    onEdit(originalName, {
      name: editForm.name.trim(),
      qty: Number(editForm.qty),
      unit: editForm.unit,
      par: Number(editForm.par),
    });
    setEditingName(null);
  }

  function handleDelete(item) {
    const { canDelete, message } = canDeleteIngredient(stock, recipes, item.name);
    if (!canDelete) {
      setDeleteMessage(message);
      return;
    }
    setDeleteMessage(null);
    onDelete(item.name);
  }

  return (
    <section className="panel">
      <h2>Kitchen Stock</h2>

      <input
        className="search-input"
        type="text"
        placeholder="Search ingredients..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {deleteMessage && <div className="banner banner-warn">{deleteMessage}</div>}

      <table className="stock-table">
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>Quantity</th>
            <th>Par</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) =>
            editingName === item.name ? (
              <tr key={item.name} className="editing-row">
                <td colSpan={4}>
                  <form
                    className="edit-form"
                    onSubmit={(e) => handleEditSubmit(e, item.name)}
                  >
                    <input
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, name: e.target.value }))
                      }
                    />
                    <input
                      type="number"
                      value={editForm.qty}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, qty: e.target.value }))
                      }
                    />
                    <select
                      value={editForm.unit}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, unit: e.target.value }))
                      }
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={editForm.par}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, par: e.target.value }))
                      }
                    />
                    <button type="submit">Save</button>
                    <button type="button" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </form>
                  {(editErrors.name || editErrors.qty || editErrors.par) && (
                    <div className="field-errors">
                      {editErrors.name && <span>{editErrors.name}</span>}
                      {editErrors.qty && <span>{editErrors.qty}</span>}
                      {editErrors.par && <span>{editErrors.par}</span>}
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              <tr key={item.name}>
                <td>{item.name}</td>
                <td>
                  {item.qty} {item.unit}
                </td>
                <td>
                  {item.par} {item.unit}
                </td>
                <td className="row-actions">
                  <button onClick={() => startEdit(item)}>Edit</button>
                  <button onClick={() => handleDelete(item)}>Delete</button>
                </td>
              </tr>
            )
          )}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-state">
                No ingredients match "{search}".
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h3>Add ingredient</h3>
      <form className="add-form" onSubmit={handleAddSubmit}>
        <input
          placeholder="Name"
          value={addForm.name}
          onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          type="number"
          placeholder="Quantity"
          value={addForm.qty}
          onChange={(e) => setAddForm((f) => ({ ...f, qty: e.target.value }))}
        />
        <select
          value={addForm.unit}
          onChange={(e) => setAddForm((f) => ({ ...f, unit: e.target.value }))}
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Par level"
          value={addForm.par}
          onChange={(e) => setAddForm((f) => ({ ...f, par: e.target.value }))}
        />
        <button type="submit">Add</button>
      </form>
      {(addErrors.name || addErrors.qty || addErrors.par) && (
        <div className="field-errors">
          {addErrors.name && <span>{addErrors.name}</span>}
          {addErrors.qty && <span>{addErrors.qty}</span>}
          {addErrors.par && <span>{addErrors.par}</span>}
        </div>
      )}
    </section>
  );
}
