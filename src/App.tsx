import React, { useState, useEffect } from "react";
import Fuse from "fuse.js";

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

// ── Общая форма (добавление / редактирование) ────────────────────────────────

interface OperationFormProps {
  mode: "add" | "edit";
  initial?: Operation;
  onSaved?: (op: Operation) => void;
  lockAccount?: boolean;
}

const OperationForm: React.FC<OperationFormProps> = ({ mode, initial, onSaved, lockAccount }) => {
  const [date, setDate] = useState<string>(initial?.date ?? "");
  const [amount, setAmount] = useState<string>(initial?.amount != null ? String(initial.amount) : "");
  const [description, setDescription] = useState<string>(initial?.description ?? "");
  const [account, setAccount] = useState<number | "">(lockAccount ? 2 : (initial?.account ?? ""));
  const [kind, setKind] = useState<number | null>(initial?.kind ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingBody, setPendingBody] = useState<Operation | null>(null);

  const doSave = async (body: Operation) => {
    setLoading(true);
    try {
      let res: Response;
      if (mode === "edit" && initial?.id != null) {
        res = await fetch(`/api/operations/${initial.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `Ошибка ${res.status}`);
        }
        const updated: Operation = await res.json();
        setSuccess("Отредактировано");
        onSaved?.(updated);
      } else {
        res = await fetch("/api/operations/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.status !== 201) {
          const text = await res.text();
          throw new Error(text || `Ошибка ${res.status}`);
        }
        const added: Operation = await res.json();
        setSuccess(`«${body.description || "—"}» на сумму ${body.amount} сохранено`);
        onSaved?.(added);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отправки");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (kind === null) {
      setError("Выберите категорию");
      return;
    }

    const body: Operation = {
      amount: parseFloat(amount),
      kind,
      ...(date && { date }),
      ...(description.trim() && { description: description.trim() }),
      ...(account !== "" && { account }),
    };

    // Проверка дублей только при добавлении
    if (mode === "add" && date && description.trim()) {
      setLoading(true);
      try {
        const checkRes = await fetch("/api/operations/find", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromDate: date, toDate: date, description: description.trim() }),
        });
        if (checkRes.ok) {
          const existing: Operation[] = await checkRes.json();
          const duplicate = existing.find((op) => op.amount === parseFloat(amount) && !op.storned);
          if (duplicate) {
            setLoading(false);
            setPendingBody(body);
            return;
          }
        }
      } catch {
        // если проверка упала — не блокируем сохранение
      } finally {
        setLoading(false);
      }
    }

    await doSave(body);
  };

  return (
    <>
    {pendingBody && (
      <div className="modal-overlay">
        <div className="modal">
          <p className="modal-text">Такая запись уже есть. Сохранить повторно?</p>
          <div className="modal-actions">
            <button className="modal-btn modal-btn--confirm" onClick={() => { setPendingBody(null); doSave(pendingBody); }}>Да</button>
            <button className="modal-btn modal-btn--cancel" onClick={() => setPendingBody(null)}>Нет</button>
          </div>
        </div>
      </div>
    )}
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
          disabled={lockAccount}
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
        {loading ? "Отправка…" : mode === "edit" ? "Сохранить" : "Записать"}
      </button>
    </form>
    </>
  );
};

const AddForm: React.FC<{ prefill?: Partial<Operation> }> = ({ prefill }) => (
  <OperationForm mode="add" initial={prefill as Operation | undefined} />
);

// ── Память категорий ─────────────────────────────────────────────────────────

const CATEGORY_MEMORY_KEY = "moneycoach_category_memory";

interface CategoryMemoryEntry { kind: number; description: string; }

function loadCategoryMemory(): Record<string, CategoryMemoryEntry> {
  try { return JSON.parse(localStorage.getItem(CATEGORY_MEMORY_KEY) ?? "{}"); }
  catch { return {}; }
}

function saveCategoryAssociation(originalDescription: string, kind: number, description: string) {
  const memory = loadCategoryMemory();
  memory[originalDescription.toLowerCase().trim()] = { kind, description };
  localStorage.setItem(CATEGORY_MEMORY_KEY, JSON.stringify(memory));
}

function lookupMemory(description: string): CategoryMemoryEntry | null {
  const memory = loadCategoryMemory();
  return memory[description.toLowerCase().trim()] ?? null;
}

// ── Скан ─────────────────────────────────────────────────────────────────────

interface ParsedTransaction {
  description: string;
  amount: number;
  date: string;
}

const ScanTab: React.FC = () => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ParsedTransaction | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());

  const loadFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setTransactions(null);
    setSelected(null);
    setSelectedIndex(null);
    setSavedIndices(new Set());
    setError(null);
  };

  const handleParse = async () => {
    if (!imageFile) return;
    setParsing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      const res = await fetch("/gigachat/parse", { method: "POST", body: fd });
      let data: { transactions?: ParsedTransaction[]; error?: string };
      try {
        data = await res.json();
      } catch {
        throw new Error(`Пустой ответ от сервера (${res.status}). Убедитесь что прокси-сервер запущен.`);
      }
      if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
      setTransactions(data.transactions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка парсинга");
    } finally {
      setParsing(false);
    }
  };

  const handleSelect = (t: ParsedTransaction, i: number) => {
    if (savedIndices.has(i)) return;
    setSelected(t);
    setSelectedIndex(i);
    setFormKey((k) => k + 1);
  };

  const handleSaved = (op: Operation) => {
    if (selectedIndex !== null) {
      setSavedIndices((prev) => new Set(prev).add(selectedIndex));
    }
    if (selected && op.kind) {
      saveCategoryAssociation(selected.description, op.kind, op.description ?? selected.description);
    }
  };

  return (
    <div className="scan">
      <div className="scan-left">
        <div
          className={`drop-zone${dragging ? " drop-zone--active" : ""}${imageUrl ? " drop-zone--filled" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}
          onClick={() => document.getElementById("scan-file-input")?.click()}
        >
          {imageUrl
            ? <img src={imageUrl} className="scan-image" alt="скриншот" />
            : <p className="drop-zone-hint">Перетащите скриншот сюда<br />или кликните для выбора</p>
          }
        </div>
        <input
          id="scan-file-input"
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
        />
        <button className="submit-button" onClick={handleParse} disabled={parsing || !imageUrl}>
          {parsing ? "Анализ…" : "Начать анализ"}
        </button>
        {error && <p className="form-error">{error}</p>}
      </div>

      <div className="scan-right">
        {transactions !== null && (
          <>
            {transactions.length === 0
              ? <p className="report-empty">Операции не найдены</p>
              : (
                <ul className="scan-transactions">
                  {transactions.map((t, i) => (
                    <li
                      key={i}
                      className={`scan-transaction${selectedIndex === i ? " scan-transaction--active" : ""}${savedIndices.has(i) ? " scan-transaction--saved" : ""}`}
                      onClick={() => handleSelect(t, i)}
                    >
                      <span className="scan-tr-date">{formatDate(t.date)}</span>
                      <span className="scan-tr-desc">{t.description}</span>
                      <span className="scan-tr-amount amount-positive">{formatAmount(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              )
            }
            <div className="scan-divider" />
          </>
        )}
        <OperationForm
          key={formKey}
          mode="add"
          lockAccount
          onSaved={handleSaved}
          initial={selected
            ? { amount: selected.amount, description: lookupMemory(selected.description)?.description ?? selected.description, date: selected.date, kind: lookupMemory(selected.description)?.kind ?? 0 } as Operation
            : undefined
          }
        />
      </div>
    </div>
  );
};

// ── Отчёт ────────────────────────────────────────────────────────────────────

const Report: React.FC<{ onEdit: (op: Operation) => void; updatedOp?: Operation | null }> = ({ onEdit, updatedOp }) => {
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
  const [searchQuery, setSearchQuery] = useState("");
  const [fuzzySearch, setFuzzySearch] = useState(true);

  useEffect(() => {
    if (updatedOp) {
      setRows((prev) => prev ? prev.map((r) => r.id === updatedOp.id ? updatedOp : r) : prev);
    }
  }, [updatedOp]);

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

  const searchedRows = searchQuery.trim() && filteredRows
    ? fuzzySearch
      ? new Fuse(filteredRows, { keys: ["description"], threshold: 0.4, ignoreLocation: true })
          .search(searchQuery)
          .map((r) => r.item)
      : filteredRows.filter((r) =>
          r.description?.toLowerCase().includes(searchQuery.trim().toLowerCase())
        )
    : filteredRows;

  const sortedRows = searchedRows
    ? [...searchedRows].sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortField === "amount") return (a.amount - b.amount) * dir;
        const da = a.date ?? "";
        const db = b.date ?? "";
        return da.localeCompare(db) * dir;
      })
    : null;

  const total = searchedRows?.reduce((sum, r) => sum + r.amount, 0) ?? 0;

  return (
    <div className="report">
      <div className="filter-row filter-row--4">
        <div className="field">
          <label className="label">С</label>
          <input
            type="date"
            className="input"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setRows(null); }}
          />
        </div>
        <div className="field">
          <label className="label">По</label>
          <input
            type="date"
            className="input"
            value={to}
            onChange={(e) => { setTo(e.target.value); setRows(null); }}
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
            onChange={(e) => {
              setKind(e.target.value === "" ? null : Number(e.target.value));
              setRows(null);
            }}
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
              onChange={(e) => { setIncludeStorned(e.target.checked); setRows(null); }}
            />
            Показывать сторнированные
          </label>
        </div>
      </div>

      <div className="field">
        <label className="label">Поиск по описанию</label>
        <input
          type="text"
          className="input"
          placeholder="Начните вводить…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <label className="checkbox-label" style={{ paddingTop: 0 }}>
          <input
            type="checkbox"
            checked={fuzzySearch}
            onChange={(e) => setFuzzySearch(e.target.checked)}
          />
          Нечёткий поиск
        </label>
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
                      <button className="row-action" title="Редактировать" onClick={() => onEdit(row)}>
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
  const [tab, setTab] = useState<"add" | "report" | "edit" | "scan">("add");
  const [editingOp, setEditingOp] = useState<Operation | null>(null);
  const [updatedOp, setUpdatedOp] = useState<Operation | null>(null);
  const [prefillOp] = useState<Partial<Operation> | undefined>(undefined);
  const [prefillKey] = useState(0);

  const handleEdit = (op: Operation) => {
    setEditingOp(op);
    setUpdatedOp(null);
    setTab("edit");
  };

  return (
    <div className="page">
      <div className={`card${tab === "report" || tab === "scan" ? " card--wide" : ""}`}>
        <header className="card-header">
          <h1 className="title">MoneyCoach</h1>
          {tab !== "edit" && (
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
              <button
                className={`tab${tab === "scan" ? " tab--active" : ""}`}
                onClick={() => setTab("scan")}
              >
                📷 Скан
              </button>
            </div>
          )}
        </header>

        {tab === "add" && <AddForm key={prefillKey} prefill={prefillOp} />}
        <div style={{ display: tab === "report" ? undefined : "none" }}>
          <Report onEdit={handleEdit} updatedOp={updatedOp} />
        </div>
        {tab === "edit" && editingOp && (
          <>
            <button className="back-button" onClick={() => setTab("report")}>← Назад</button>
            <OperationForm mode="edit" initial={editingOp} onSaved={setUpdatedOp} />
          </>
        )}
        {tab === "scan" && <ScanTab />}
      </div>
    </div>
  );
};
