const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para processar JSON e servir arquivos estáticos da pasta public
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Conexão com o banco de dados SQLite
const db = new sqlite3.Database('./prospera.db', (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados:', err.message);
  } else {
    console.log('Banco de dados SQLite conectado com sucesso.');
    
    // Criação da tabela de utilizadores se não existir
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )`);
  }
});

// Rota de registo de utilizador
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Por favor, preencha todos os campos.' });
  }

  const sql = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;
  db.run(sql, [name, email, password], function (err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Este e-mail já está registado.' });
      }
      return res.status(500).json({ error: 'Erro ao guardar utilizador no servidor.' });
    }
    return res.status(201).json({ message: 'Conta criada com sucesso!', userId: this.lastID });
  });
});

// Rota fallback para entregar o index.html (compatível com todas as versões do Express)
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// Inicialização do servidor
app.listen(PORT, () => {
  console.log(`Servidor Prospera a rodar na porta ${PORT}`);
});