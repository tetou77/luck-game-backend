
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const app = express();
const PORT = 3000;

app.use(bodyParser.json());

const db = new sqlite3.Database(':memory:');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    balance REAL DEFAULT 0
  )`);

  db.run(`CREATE TABLE deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_amount REAL,
    platform_profit REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER,
    user_id INTEGER,
    deposit_amount REAL,
    multiplier REAL,
    win_amount REAL
  )`);
});

// Register user
app.post('/register', (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO users (name) VALUES (?)', [name], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name });
  });
});

// Deposit money
app.post('/deposit', (req, res) => {
  const { user_id, amount } = req.body;
  db.run('INSERT INTO deposits (user_id, amount) VALUES (?, ?)', [user_id, amount], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, user_id]);
    res.json({ message: 'Deposit successful', deposit_id: this.lastID });
  });
});

// Start a round
app.post('/start-round', (req, res) => {
  const { players } = req.body; // [{ user_id, deposit_amount }]
  const multipliers = [2, 3, 4, 5, 6, 7, 8, 9];
  let totalAmount = 0;
  let results = [];

  for (const player of players) {
    totalAmount += player.deposit_amount;
  }

  const platformProfit = 1000;
  const distributable = totalAmount - platformProfit;

  for (const player of players) {
    const multiplier = multipliers[Math.floor(Math.random() * multipliers.length)];
    const winAmount = player.deposit_amount * multiplier;
    results.push({ ...player, multiplier, winAmount });
  }

  db.run('INSERT INTO rounds (total_amount, platform_profit) VALUES (?, ?)', [totalAmount, platformProfit], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const round_id = this.lastID;

    results.forEach(result => {
      db.run(`INSERT INTO results (round_id, user_id, deposit_amount, multiplier, win_amount)
              VALUES (?, ?, ?, ?, ?)`,
        [round_id, result.user_id, result.deposit_amount, result.multiplier, result.winAmount]);

      db.run('UPDATE users SET balance = balance + ? WHERE id = ?', [result.winAmount, result.user_id]);
    });

    res.json({ message: 'Round completed', round_id, results });
  });
});

// Get user balance
app.get('/balance/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT balance FROM users WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ user_id: id, balance: row ? row.balance : 0 });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
