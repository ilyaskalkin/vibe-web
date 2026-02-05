import React, { useState } from "react";

const CATEGORIES = [
  { id: 1, label: "Еда" },
  { id: 2, label: "Здоровье" },
  { id: 3, label: "Спорт" },
  { id: 4, label: "Прочее" },
  { id: 5, label: "Алкоголь" },
  { id: 6, label: "Регулярное" },
] as const;

/** Operation schema: POST /api/operations/add (OpenAPI) */
interface Operation {
  id?: number;
  date?: string;
  amount: number;
  description?: string;
  kind: number;
  account?: number;
  storned?: boolean;
}

const ACCOUNT_OPTIONS = [
  { value: 1, label: "Cash" },
  { value: 2, label: "Card" },
  { value: 3, label: "Savings" },
] as const;

export const App: React.FC = () => {
  const [date, setDate] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [account, setAccount] = useState<number | "">("");
  const [kind, setKind] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (kind === null) {
      setError("Выберите категорию");
      return;
    }
    setLoading(true);
    try {
      const body: Operation = {
        amount: parseFloat(amount),
        kind,
        ...(date && { date }),
        ...(description.trim() && { description: description.trim() }),
        ...(account !== "" && { account }),
      };
      const res = await fetch("/api/operations/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status !== 201) {
        const text = await res.text();
        throw new Error(text || `Ошибка ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="card">
        <header className="card-header">
          <h1 className="title">MVP Testing</h1>
          <p className="subtitle">Enter transaction details below</p>
        </header>

        <form className="form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="label" htmlFor="date">
              Date
            </label>
            <div className="input-wrapper">
              <input
                id="date"
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="amount">
              Amount
            </label>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              className="input"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="description">
              Description
            </label>
            <input
              id="description"
              type="text"
              className="input"
              placeholder="Enter description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="account">
              Account
            </label>
            <select
              id="account"
              className="select"
              value={account === "" ? "" : account}
              onChange={(e) =>
                setAccount(e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">Select account</option>
              {ACCOUNT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="select"
              value={kind ?? ""}
              onChange={(e) =>
                setKind(e.target.value === "" ? null : Number(e.target.value))
              }
            >
              <option value="">Select category</option>
              {CATEGORIES.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            className="submit-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Отправка…" : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
};



