require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2/promise');
const axios = require('axios');

const app = express();

// === CORS: подставь фронт, если не на localhost:3000 ===
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.options('*', cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

// === Парсеры ===
app.use(express.json()); // вместо body-parser
app.use(cookieParser());

// === Подключение к MySQL ===
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+00:00'
});

const JWT_SECRET = process.env.JWT_SECRET || 'eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWUsImlhdCI6MTczNjI5MjEyNH0.';
const API_KEY = process.env.OPENROUTER_API_KEY;

console.log('API_KEY из .env:', API_KEY);

// === Middleware: извлечь пользователя из JWT ===
async function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.query(
      'SELECT id, first_name, last_name, username, phone, email FROM users WHERE id = ?',
      [payload.id]
    );
    req.user = rows.length ? rows[0] : null;
  } catch (err) {
    req.user = null;
  }
  next();
}

app.use(authMiddleware);

// === Роуты авторизации / регистрации ===

// Регистрация (подробный с логированием)
app.post('/api/register', async (req, res) => {
  try {
    console.log('Запрос /api/register, тело:', req.body);

    const { firstName, lastName, username, password, phone, email } = req.body;
    if (!firstName || !lastName || !username || !password || !phone || !email) {
      return res.status(400).json({ error: 'Все поля обязательны.' });
    }

    // проверка существования
    const [exists] = await db.query(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (exists.length) {
      return res.status(400).json({ error: 'Пользователь с таким логином или email уже существует.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO users (first_name, last_name, username, password_hash, phone, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [firstName, lastName, username, password_hash, phone, email]
    );

    const userId = result.insertId;
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user: {
        first_name: firstName,
        last_name: lastName,
        username,
        phone,
        email
      }
    });
  } catch (err) {
    console.error('Register error (подробно):', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера.', detail: err.message });
  }
});

// Логин
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны.' });
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (!rows.length) return res.status(400).json({ error: 'Неверные учетные данные.' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ error: 'Неверные учетные данные.' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      user: {
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        phone: user.phone,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
  }
});

// Получить текущего пользователя
app.get('/api/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user });
});

// Выход
app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// === Твой ИИ-эндпоинт ===
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;

  try {
    let systemContext = 'Ты вежливый ИИ-помощник, консультирующий по интернет-магазину.';
    if (req.user) {
      systemContext += ` Пользователь: ${req.user.username}, email: ${req.user.email}.`;
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'mistralai/mistral-7b-instruct:free',
        messages: [
          { role: 'system', content: systemContext },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'MyShop Assistant'
        }
      }
    );

    const aiReply = response.data.choices[0].message.content;
    res.json({ reply: aiReply });
  } catch (error) {
    console.error('Ошибка обращения к OpenRouter:', error.response?.data || error.message);
    res.status(500).json({ reply: 'Ошибка при соединении с ИИ 😢' });
  }
});

// === Запуск ===
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Сервер работает на http://localhost:${PORT}`);
});
