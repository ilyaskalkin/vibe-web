import React, { useState } from "react";

export const App: React.FC = () => {
  const [date, setDate] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [account, setAccount] = useState<string>("");
  const [category, setCategory] = useState<string>("");

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    // For now just log the values – later you can wire this up to real logic
    console.table({ date, amount, description, account, category });
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
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="">Select account</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="savings">Savings</option>
            </select>
          </div>

          <div className="field">
            <label className="label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select category</option>
              <option value="food">Food</option>
              <option value="transport">Transport</option>
              <option value="shopping">Shopping</option>
            </select>
          </div>

          <button className="submit-button" type="submit">
            Submit
          </button>
        </form>
      </div>
    </div>
  );
};



