import { useState } from "react";
import StockPanel from "./components/StockPanel";
import MenuPanel from "./components/MenuPanel";
import { orderDish } from "./utils/inventory";
import stockData from "./data/stock.json";
import recipesData from "./data/recipes.json";
import "./App.css";

export default function App() {
  // Both start from the provided JSON files and live only in memory —
  // per the assignment, no backend/database, so a page refresh resets state.
  const [stock, setStock] = useState(stockData);
  const [recipes] = useState(recipesData); // recipes/menu aren't edited in this assignment
  const [message, setMessage] = useState(null);

  function handleAdd(newItem) {
    setStock((prev) => [...prev, newItem]);
  }

  function handleEdit(originalName, updatedItem) {
    setStock((prev) =>
      prev.map((item) => (item.name === originalName ? updatedItem : item))
    );
  }

  function handleDelete(name) {
    setStock((prev) => prev.filter((item) => item.name !== name));
  }

  function handleOrder(dish) {
    try {
      const nextStock = orderDish(dish, stock);
      setStock(nextStock);
      setMessage({ type: "success", text: `Order placed: ${dish.dish}` });
    } catch (err) {
      // orderDish re-validates availability/negative-stock itself, so this
      // only fires if something changed between render and click.
      setMessage({ type: "error", text: err.message });
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Palyt — Kitchen Stock &amp; Menu</h1>
        <p className="subtitle">Order dish → stock deducts → menu availability updates</p>
      </header>

      {message && (
        <div className={`toast toast-${message.type}`} onClick={() => setMessage(null)}>
          {message.text}
        </div>
      )}

      <main className="two-panel">
        <StockPanel
          stock={stock}
          recipes={recipes}
          onAdd={handleAdd}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        <MenuPanel recipes={recipes} stock={stock} onOrder={handleOrder} />
      </main>
    </div>
  );
}
