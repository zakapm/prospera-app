const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const SECRET_KEY = "prospera_chave_secreta_jwt"; // Em produção, altere esta chave

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Conexão com o Banco de Dados SQLite
const db = new sqlite3.Database('./prospera.db', (err) => {
    if (err) console.error("Erro ao abrir banco de dados:", err.message);
    else console.log("Banco de dados SQLite conectado.");
});

// 2. Criar Tabelas caso não existam
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        descricao TEXT NOT NULL,
        valor REAL NOT NULL,
        tipo TEXT NOT NULL,
        categoria TEXT NOT NULL,
        data TEXT NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS financiamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        valorTotal REAL NOT NULL,
        valorParcela REAL NOT NULL,
        totalParcelas INTEGER NOT NULL,
        parcelasPagas INTEGER NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS metas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        valorAlvo REAL NOT NULL,
        valorAtual REAL NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`);
});

// 3. Middleware para validar o Token JWT
function autenticarToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ erro: "Acesso negado. Faça login." });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ erro: "Sessão expirada ou inválida." });
        req.user = user;
        next();
    });
}

// --- ROTAS DE AUTENTICAÇÃO ---

app.post('/api/registrar', (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) return res.status(400).json({ erro: "Preencha todos os campos." });

    const hashSenha = bcrypt.hashSync(senha, 10);
    const sql = `INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)`;

    db.run(sql, [nome, email, hashSenha], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(400).json({ erro: "E-mail já cadastrado." });
            return res.status(500).json({ erro: "Erro ao cadastrar usuário." });
        }
        res.json({ mensagem: "Usuário cadastrado com sucesso!" });
    });
});

app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;
    const sql = `SELECT * FROM usuarios WHERE email = ?`;

    db.get(sql, [email], (err, usuario) => {
        if (err || !usuario) return res.status(400).json({ erro: "E-mail ou senha inválidos." });

        const senhaValida = bcrypt.compareSync(senha, usuario.senha);
        if (!senhaValida) return res.status(400).json({ erro: "E-mail ou senha inválidos." });

        const token = jwt.sign({ id: usuario.id, nome: usuario.nome }, SECRET_KEY, { expiresIn: '8h' });
        res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email } });
    });
});

// --- ROTAS DE TRANSAÇÕES ---

app.get('/api/transacoes', autenticarToken, (req, res) => {
    db.all(`SELECT * FROM transacoes WHERE usuario_id = ? ORDER BY data DESC`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

app.post('/api/transacoes', autenticarToken, (req, res) => {
    const { descricao, valor, tipo, categoria, data } = req.body;
    const sql = `INSERT INTO transacoes (usuario_id, descricao, valor, tipo, categoria, data) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [req.user.id, descricao, valor, tipo, categoria, data], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ id: this.lastID, usuario_id: req.user.id, descricao, valor, tipo, categoria, data });
    });
});

app.delete('/api/transacoes/:id', autenticarToken, (req, res) => {
    db.run(`DELETE FROM transacoes WHERE id = ? AND usuario_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Transação removida." });
    });
});

// --- ROTAS DE FINANCIAMENTOS ---

app.get('/api/financiamentos', autenticarToken, (req, res) => {
    db.all(`SELECT * FROM financiamentos WHERE usuario_id = ?`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

app.post('/api/financiamentos', autenticarToken, (req, res) => {
    const { nome, valorTotal, valorParcela, totalParcelas, parcelasPagas } = req.body;
    const sql = `INSERT INTO financiamentos (usuario_id, nome, valorTotal, valorParcela, totalParcelas, parcelasPagas) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [req.user.id, nome, valorTotal, valorParcela, totalParcelas, parcelasPagas], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ id: this.lastID, usuario_id: req.user.id, nome, valorTotal, valorParcela, totalParcelas, parcelasPagas });
    });
});

app.put('/api/financiamentos/:id', autenticarToken, (req, res) => {
    const { parcelasPagas } = req.body;
    db.run(`UPDATE financiamentos SET parcelasPagas = ? WHERE id = ? AND usuario_id = ?`, [parcelasPagas, req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Financiamento atualizado." });
    });
});

app.delete('/api/financiamentos/:id', autenticarToken, (req, res) => {
    db.run(`DELETE FROM financiamentos WHERE id = ? AND usuario_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Financiamento removido." });
    });
});

// --- ROTAS DE METAS ---

app.get('/api/metas', autenticarToken, (req, res) => {
    db.all(`SELECT * FROM metas WHERE usuario_id = ?`, [req.user.id], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

app.post('/api/metas', autenticarToken, (req, res) => {
    const { nome, valorAlvo, valorAtual } = req.body;
    const sql = `INSERT INTO metas (usuario_id, nome, valorAlvo, valorAtual) VALUES (?, ?, ?, ?)`;
    db.run(sql, [req.user.id, nome, valorAlvo, valorAtual], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ id: this.lastID, usuario_id: req.user.id, nome, valorAlvo, valorAtual });
    });
});

app.put('/api/metas/:id', autenticarToken, (req, res) => {
    const { valorAtual } = req.body;
    db.run(`UPDATE metas SET valorAtual = ? WHERE id = ? AND usuario_id = ?`, [valorAtual, req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Meta atualizada." });
    });
});

app.delete('/api/metas/:id', autenticarToken, (req, res) => {
    db.run(`DELETE FROM metas WHERE id = ? AND usuario_id = ?`, [req.params.id, req.user.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ mensagem: "Meta removida." });
    });
});

// Iniciar Servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor Prospera rodando em http://localhost:${PORT}`);
});