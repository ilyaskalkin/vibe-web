import React, { useState } from "react";

const CATEGORIES = [
  { id: 1, label: "Еда" },
  { id: 2, label: "Здоровье" },
  { id: 3, label: "Спорт" },
  { id: 4, label: "Прочее" },
  { id: 5, label: "Алкоголь" },
  { id: 6, label: "Регулярное" },
  { id: 7, label: "Автомобиль" },
] as const;

const ACCOUNT_OPTIONS = [
  { value: 1, label: "Cash" },
  { value: 2, label: "Card" },
  { value: 3, label: "Savings" },
] as const;

const ACCOUNT_LABELS: Record<number, string> = {
  1: "Наличные",
  2: "Карта",
  3: "Накопления",
};

interface Operation {
  id?: number;
  date?: string;
  amount: number;
  description?: string;
  kind: number;
  account?: number;
  storned?: boolean;
}

/** Если дата — суббота или воскресенье, возвращает предыдущую пятницу */
function effectiveDate(d: Date): Date {
  const day = d.getDay();
  const offset = day === 6 ? -1 : day === 0 ? -2 : 0;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
}

function defaultDates(): { from: string; to: string } {
  const today = new Date();

  // Начало: эффективное 5-е текущего месяца + 1 день
  const fifth = new Date(today.getFullYear(), today.getMonth(), 5);
  const effFifth = effectiveDate(fifth);
  const start = new Date(effFifth.getFullYear(), effFifth.getMonth(), effFifth.getDate() + 1);

  // Конец: эффективное 5-е следующего месяца
  const nextFifth = new Date(today.getFullYear(), today.getMonth() + 1, 5);
  const end = effectiveDate(nextFifth);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(start), to: fmt(end) };
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function formatAmount(amount: number): string {
  const sign = amount < 0 ? "−\u202f" : "";
  return `${sign}${Math.abs(amount).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}\u00a0₽`;
}

// ── Форма добавления ─────────────────────────────────────────────────────────

const AddForm: React.FC = () => {
  const [date, setDate] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [account, setAccount] = useState<number | "">("");
  const [kind, setKind] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
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
      setSuccess(
        `«${description.trim() || "—"}» на сумму ${parseFloat(amount)} сохранено`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  };

  return (
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
      {success && <p className="form-success">{success}</p>}

      <button className="submit-button" type="submit" disabled={loading}>
        {loading ? "Отправка…" : "Submit"}
      </button>
    </form>
  );
};

// ── Отчёт ────────────────────────────────────────────────────────────────────

const Report: React.FC = () => {
  const defaults = defaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [kind, setKind] = useState<number | null>(null);
  const [rows, setRows] = useState<Operation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountFrom, setAmountFrom] = useState<string>("");
  const [amountTo, setAmountTo] = useState<string>("");
  const [includeStorned, setIncludeStorned] = useState(false);
  const [sortField, setSortField] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "date" | "amount") => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const handleFind = async () => {
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = { fromDate: from, toDate: to, includeStorned };
      if (kind !== null) body.kind = kind;
      const res = await fetch("/api/operations/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Ошибка ${res.status}`);
      const data: Operation[] = await res.json();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  };

  const handleStorno = async (id: number) => {
    try {
      const res = await fetch(`/api/operations/${id}/storno`, { method: "PATCH" });
      if (!res.ok) throw new Error(`Ошибка ${res.status}`);
      setRows((prev) => prev ? prev.map((r) => r.id === id ? { ...r, storned: true } : r) : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сторнирования");
    }
  };

  const filteredRows = rows
    ? rows.filter((r) => {
        const af = amountFrom !== "" ? r.amount >= parseFloat(amountFrom) : true;
        const at = amountTo !== "" ? r.amount <= parseFloat(amountTo) : true;
        return af && at;
      })
    : null;

  const sortedRows = filteredRows
    ? [...filteredRows].sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortField === "amount") return (a.amount - b.amount) * dir;
        const da = a.date ?? "";
        const db = b.date ?? "";
        return da.localeCompare(db) * dir;
      })
    : null;

  const total = filteredRows?.reduce((sum, r) => sum + r.amount, 0) ?? 0;

  return (
    <div className="report">
      <div className="filter-row filter-row--4">
        <div className="field">
          <label className="label">С</label>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">По</label>
          <input
            type="date"
            className="input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Сумма от</label>
          <input
            type="number"
            step="0.01"
            className="input"
            placeholder="—"
            value={amountFrom}
            onChange={(e) => setAmountFrom(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Сумма до</label>
          <input
            type="number"
            step="0.01"
            className="input"
            placeholder="—"
            value={amountTo}
            onChange={(e) => setAmountTo(e.target.value)}
          />
        </div>
      </div>
      <div className="filter-row filter-row--1">
        <div className="field">
          <label className="label">Категория</label>
          <select
            className="select"
            value={kind ?? ""}
            onChange={(e) =>
              setKind(e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">Все</option>
            {CATEGORIES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field field--checkbox">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeStorned}
              onChange={(e) => setIncludeStorned(e.target.checked)}
            />
            Показывать сторнированные
          </label>
        </div>
      </div>

      <button
        className="submit-button"
        onClick={handleFind}
        disabled={loading}
      >
        {loading ? "Загрузка…" : "Показать"}
      </button>

      {error && <p className="form-error">{error}</p>}

      {sortedRows !== null && (
        sortedRows.length === 0 ? (
          <p className="report-empty">Записей не найдено</p>
        ) : (
          <div className="table-wrapper">
            <table className="report-table">
              <thead>
                <tr>
                  <th
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => handleSort("date")}
                  >
                    Дата {sortField === "date" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => handleSort("amount")}
                  >
                    Сумма {sortField === "amount" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <th>Счёт</th>
                  <th>Описание</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.id} className={row.storned ? "row--storned" : ""}>
                    <td className="cell-date">
                      {row.date ? formatDate(row.date) : "—"}
                    </td>
                    <td className={row.amount < 0 ? "amount-negative" : "amount-positive"}>
                      {formatAmount(row.amount)}
                    </td>
                    <td>{row.account ? ACCOUNT_LABELS[row.account] : "—"}</td>
                    <td className="cell-description">{row.description || "—"}</td>
                    <td className="cell-actions">
                      {!row.storned && (
                        <button
                          className="row-action row-action--storno"
                          title="Сторнировать"
                          onClick={() => row.id !== undefined && handleStorno(row.id)}
                        >
                          ✕
                        </button>
                      )}
                      <button className="row-action" title="Редактировать">
                        →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="report-total">
              Итого:{" "}
              <span className={total < 0 ? "amount-negative" : "amount-positive"}>
                {formatAmount(total)}
              </span>
            </div>
          </div>
        )
      )}
    </div>
  );
};

// ── Корневой компонент ────────────────────────────────────────────────────────

export const App: React.FC = () => {
  const [tab, setTab] = useState<"add" | "report">("add");

  return (
    <div className="page">
      <div className={`card${tab === "report" ? " card--wide" : ""}`}>
        <header className="card-header">
          <h1 className="title">MoneyCoach</h1>
          <div className="tabs">
            <button
              className={`tab${tab === "add" ? " tab--active" : ""}`}
              onClick={() => setTab("add")}
            >
              + Добавить
            </button>
            <button
              className={`tab${tab === "report" ? " tab--active" : ""}`}
              onClick={() => setTab("report")}
            >
              ≡ Отчёт
            </button>
          </div>
        </header>

        {tab === "add" ? <AddForm /> : <Report />}
      </div>
    </div>
  );
};
