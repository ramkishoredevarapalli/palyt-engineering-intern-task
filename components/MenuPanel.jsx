import { getMenuAvailability } from "../utils/inventory";

export default function MenuPanel({ recipes, stock, onOrder }) {
  const menu = getMenuAvailability(recipes, stock);

  return (
    <section className="panel">
      <h2>Menu</h2>
      <ul className="menu-list">
        {menu.map(({ dish, available, reasons }) => (
          <li key={dish.dish} className="menu-item">
            <div className="menu-item-main">
              <span className="dish-name">{dish.dish}</span>
              <span className="dish-price">₹{dish.price}</span>
              <span className={available ? "badge badge-available" : "badge badge-unavailable"}>
                {available ? "Available" : "Unavailable"}
              </span>
              <button
                disabled={!available}
                onClick={() => onOrder(dish)}
                title={available ? "Order this dish" : reasons.join(", ")}
              >
                Order
              </button>
            </div>
            {!available && (
              <div className="dish-reasons">{reasons.join(" · ")}</div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
