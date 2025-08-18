// server/index.js
const path = require('path');
// Читаем .env именно из папки server
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2/promise');
const axios = require('axios');

const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

// === SMS (Twilio, опционально)
const SMS_PROVIDER = (process.env.SMS_PROVIDER || '').toLowerCase();
let twilioClient = null;
if (SMS_PROVIDER === 'twilio') {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  } catch (e) {
    console.warn('Twilio SDK не установлен или переменные не заданы. SMS отправка будет недоступна до настройки.');
  }
}

const app = express();

// === CORS
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',');
app.use(cors({ origin: allowedOrigins, credentials: true }));

// === Парсеры
app.use(express.json());
app.use(cookieParser());

// === MySQL
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+00:00',
});

const DB_NAME = process.env.DB_NAME;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

// ---------- OpenRouter (ИИ) ----------
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_SITE_URL = (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',')[0];
const OPENROUTER_TITLE = process.env.OPENROUTER_APP_TITLE || 'MyShop Assistant';

if (!OPENROUTER_API_KEY) {
  console.warn('⚠️  OPENROUTER_API_KEY не найден. /api/chat будет возвращать 503, пока не настроите ключ в server/.env');
}

/* ===================== helpers ===================== */
const random6 = () => Math.floor(100000 + Math.random() * 900000).toString();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const normalizePhone = (raw) => {
  if (!raw) return '';
  let p = String(raw).replace(/[^\d+]/g, '');
  if (!p.startsWith('+') && /^\d+$/.test(p)) p = '+' + p;
  return p;
};

async function getUserById(id) {
  const [rows] = await db.query(
    `SELECT id, first_name, last_name, username, phone, email, role, seller_status, seller_rejection_reason
     FROM users WHERE id=? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findUserByEmail(email) {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}
async function findUserByPhone(phone) {
  const [rows] = await db.query('SELECT * FROM users WHERE phone = ? LIMIT 1', [phone]);
  return rows[0] || null;
}

async function ensureUniqueUsername(base) {
  let u = (base || 'user').toString().replace(/[^a-z0-9._-]/gi, '').toLowerCase();
  if (!u) u = 'user';
  let candidate = u, i = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [r] = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [candidate]);
    if (!r.length) return candidate;
    i += 1;
    candidate = `${u}${i}`;
    if (i > 50) candidate = `${u}-${Date.now().toString().slice(-6)}`;
  }
}

async function createUserByEmail({ email, first_name, last_name }) {
  const base = (email || '').split('@')[0] || 'user';
  const username = await ensureUniqueUsername(base);
  const password_hash = '';
  const phone = '';
  const [res] = await db.query(
    `INSERT INTO users (first_name, last_name, username, password_hash, phone, email)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [first_name || '', last_name || '', username, password_hash, phone, email]
  );
  return { id: res.insertId, email, first_name, last_name, username };
}

async function sendOtpEmail(to, code) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  const from = process.env.SMTP_FROM || 'no-reply@example.com';
  const info = await transporter.sendMail({
    from, to,
    subject: 'Ваш код подтверждения',
    text: `Ваш шестизначный код: ${code}. Он действителен 10 минут.`,
    html: `<p>Ваш шестизначный код: <b>${code}</b></p><p>Срок действия: 10 минут.</p>`
  });
  console.log('✉️ Отправлено письмо:', info.messageId);
}

async function sendOtpSms(to, code) {
  if (SMS_PROVIDER !== 'twilio') throw new Error('SMS_PROVIDER не настроен (twilio)');
  if (!twilioClient) throw new Error('Twilio клиент не инициализирован');
  const from = process.env.TWILIO_FROM;
  if (!from) throw new Error('TWILIO_FROM не задан в .env');
  const resp = await twilioClient.messages.create({ from, to, body: `Ваш код: ${code} (действителен 10 минут)` });
  console.log('📲 SMS отправлено:', resp.sid);
}

async function verifyGoogleIdToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID не задан в .env');
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  return ticket.getPayload();
}

/* ===================== авторизация ===================== */
function extractToken(req) {
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  return bearer || req.cookies.token || null;
}

app.use(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) { req.user = null; return next(); }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = await getUserById(payload.id);
  } catch {
    req.user = null;
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  next();
}
function requireApprovedSeller(req, res, next) {
  if (!req.user || req.user.seller_status !== 'approved') {
    return res.status(403).json({ message: 'Seller not approved' });
  }
  next();
}

/* ===================== ensure schema: products ===================== */
/** Автодобавляем недостающие поля/индексы для products (MySQL) */
async function ensureProductsSchema() {
  try {
    // category
    const [c1] = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'category'`,
      [DB_NAME]
    );
    if (!c1[0].cnt) {
      await db.query(`ALTER TABLE products ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT 'Разное' AFTER price`);
      console.log('✅ products.category добавлен');
    }

    // created_at
    const [c2] = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'created_at'`,
      [DB_NAME]
    );
    if (!c2[0].cnt) {
      await db.query(`ALTER TABLE products ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      console.log('✅ products.created_at добавлен');
    }

    // idx category
    const [i1] = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_category'`,
      [DB_NAME]
    );
    if (!i1[0].cnt) {
      await db.query(`CREATE INDEX idx_products_category ON products(category)`);
      console.log('✅ индекс idx_products_category создан');
    }

    // idx created_at
    const [i2] = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_created_at'`,
      [DB_NAME]
    );
    if (!i2[0].cnt) {
      await db.query(`CREATE INDEX idx_products_created_at ON products(created_at)`);
      console.log('✅ индекс idx_products_created_at создан');
    }
  } catch (e) {
    console.error('ensureProductsSchema error:', e.message || e);
  }
}

/* ===================== init OTP tables ===================== */
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS email_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS phone_otps (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone VARCHAR(64) NOT NULL,
        code_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_phone (phone)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ email_otps / phone_otps tables ensured');

    // гарантируем схему products
    await ensureProductsSchema();
  } catch (e) {
    console.error('Не удалось инициализировать таблицы:', e?.message || e);
  }
})();

/* ===================== AUTH: username/password ===================== */
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, username, password, phone, email } = req.body;
    if (!firstName || !lastName || !username || !password || !phone || !email) {
      return res.status(400).json({ error: 'Все поля обязательны.' });
    }
    const [exists] = await db.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (exists.length) return res.status(400).json({ error: 'Пользователь с таким логином или email уже существует.' });

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO users (first_name, last_name, username, password_hash, phone, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [firstName, lastName, username, password_hash, phone, email]
    );

    const user = await getUserById(result.insertId);
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера.', detail: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны.' });
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    if (!rows.length) return res.status(400).json({ error: 'Неверные учетные данные.' });

    const userRow = rows[0];
    const match = await bcrypt.compare(password, userRow.password_hash);
    if (!match) return res.status(400).json({ error: 'Неверные учетные данные.' });

    const token = jwt.sign({ id: userRow.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

    const user = await getUserById(userRow.id);
    res.json({ success: true, user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
  }
});

/* ===================== AUTH: email/password ===================== */
app.post('/api/register-email', async (req, res) => {
  try {
    let { firstName, lastName, password, phone, email } = req.body;
    if (!firstName || !lastName || !password || !phone || !email) {
      return res.status(400).json({ error: 'Заполните все обязательные поля.' });
    }
    phone = normalizePhone(phone);

    const [emailExists] = await db.query('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (emailExists.length) return res.status(400).json({ error: 'Пользователь с таким email уже существует.' });

    const [phoneExists] = await db.query('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone]);
    if (phoneExists.length) return res.status(400).json({ error: 'Этот номер телефона уже используется.' });

    const base = (email || '').split('@')[0] || 'user';
    const username = await ensureUniqueUsername(base);
    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `INSERT INTO users (first_name, last_name, username, password_hash, phone, email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [firstName, lastName, username, password_hash, phone, email]
    );

    const user = await getUserById(result.insertId);
    res.json({ ok: true, id: result.insertId, user });
  } catch (e) {
    console.error('register-email error:', e);
    res.status(500).json({ error: e?.message || 'Ошибка регистрации.' });
  }
});

app.post('/api/login-email', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Укажите email и пароль.' });

    const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
    const userRow = rows?.[0];
    if (!userRow) return res.status(400).json({ error: 'Неверный email или пароль.' });

    const match = await bcrypt.compare(password, userRow.password_hash || '');
    if (!match) return res.status(400).json({ error: 'Неверный email или пароль.' });

    const token = jwt.sign({ id: userRow.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

    const user = await getUserById(userRow.id);
    res.json({ ok: true, user });
  } catch (e) {
    console.error('login-email error:', e);
    res.status(500).json({ error: 'Ошибка входа.' });
  }
});

/* ===================== Google OAuth + email OTP ===================== */
app.post('/api/auth/google/start', async (req, res) => {
  try {
    const { id_token } = req.body;
    if (!id_token) return res.status(400).json({ error: 'id_token is required' });
    const payload = await verifyGoogleIdToken(id_token);
    const email = payload.email;
    if (!email) return res.status(400).json({ error: 'Email не найден в токене' });

    const code = random6();
    const hash = sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      `INSERT INTO email_otps (email, code_hash, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), created_at = CURRENT_TIMESTAMP`,
      [email, hash, expiresAt]
    );

    await sendOtpEmail(email, code);
    res.json({ ok: true, email });
  } catch (e) {
    console.error('google/start error:', e);
    res.status(500).json({ error: 'Ошибка при старте Google входа' });
  }
});

app.post('/api/auth/google/verify', async (req, res) => {
  try {
    const { id_token, code } = req.body;
    if (!id_token || !code) return res.status(400).json({ error: 'id_token и code обязательны' });

    const payload = await verifyGoogleIdToken(id_token);
    const email = payload.email;
    if (!email) return res.status(400).json({ error: 'Email не найден в токене' });

    const [rows] = await db.query('SELECT * FROM email_otps WHERE email = ? LIMIT 1', [email]);
    const row = rows?.[0];
    if (!row) return res.status(400).json({ error: 'Код не запрошен или истёк' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Код истёк, запросите новый' });
    if (sha256(code) !== row.code_hash) return res.status(400).json({ error: 'Неверный код' });

    await db.query('DELETE FROM email_otps WHERE email = ?', [email]);

    let user = await findUserByEmail(email);
    if (!user) {
      user = await createUserByEmail({
        email,
        first_name: payload.given_name || '',
        last_name: payload.family_name || ''
      });
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

    const fullUser = await getUserById(user.id);
    res.json({ ok: true, user: fullUser });
  } catch (e) {
    console.error('google/verify error:', e);
    res.status(500).json({ error: 'Ошибка при подтверждении кода' });
  }
});

/* ===================== Привязка телефона + вход по телефону ===================== */
app.post('/api/me/update-phone', requireAuth, async (req, res) => {
  try {
    let { phone, password } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'Укажите номер телефона' });

    phone = normalizePhone(phone);

    const [exists] = await db.query('SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1', [phone, req.user.id]);
    if (exists.length) return res.status(400).json({ error: 'Этот номер уже привязан к другому аккаунту' });

    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
    }

    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET phone = ?, password_hash = ? WHERE id = ?', [phone, password_hash, req.user.id]);
    } else {
      await db.query('UPDATE users SET phone = ? WHERE id = ?', [phone, req.user.id]);
    }

    res.json({ ok: true, phone });
  } catch (e) {
    console.error('update-phone error:', e);
    res.status(500).json({ error: 'Не удалось сохранить номер' });
  }
});

/* ===================== Вход по телефону через SMS-код ===================== */
app.post('/api/auth/phone/start', async (req, res) => {
  try {
    let { phone } = req.body || {};
    phone = normalizePhone(phone);
    if (!phone) return res.status(400).json({ error: 'Укажите номер телефона' });

    const user = await findUserByPhone(phone);
    if (!user) return res.status(404).json({ error: 'Этот номер не привязан ни к одному аккаунту' });

    const [last] = await db.query('SELECT created_at FROM phone_otps WHERE phone=?', [phone]);
    if (last.length) {
      const lastTs = new Date(last[0].created_at).getTime();
      if (Date.now() - lastTs < 30 * 1000) {
        return res.status(429).json({ error: 'Слишком часто. Попробуйте через 30 секунд' });
      }
    }

    const code = random6();
    const hash = sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await db.query(
      `INSERT INTO phone_otps (phone, code_hash, expires_at)
       VALUES (?, ?, ?)
       ON DUPЛICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), created_at = CURRENT_TIMESTAMP`,
      [phone, hash, expiresAt]
    );

    await sendOtpSms(phone, code);
    res.json({ ok: true, phone });
  } catch (e) {
    console.error('phone/start error:', e);
    res.status(500).json({ error: e?.message || 'Не удалось отправить SMS' });
  }
});

app.post('/api/auth/phone/verify', async (req, res) => {
  try {
    let { phone, code } = req.body || {};
    phone = normalizePhone(phone);
    if (!phone || !code) return res.status(400).json({ error: 'Укажите телефон и код' });

    const [rows] = await db.query('SELECT * FROM phone_otps WHERE phone = ? LIMIT 1', [phone]);
    const row = rows?.[0];
    if (!row) return res.status(400).json({ error: 'Код не запрошен или истёк' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Код истёк, запросите новый' });
    if (sha256(code) !== row.code_hash) return res.status(400).json({ error: 'Неверный код' });

    await db.query('DELETE FROM phone_otps WHERE phone = ?', [phone]);

    const user = await findUserByPhone(phone);
    if (!user) return res.status(404).json({ error: 'Аккаунт не найден' });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

    const fullUser = await getUserById(user.id);
    res.json({ ok: true, user: fullUser });
  } catch (e) {
    console.error('phone/verify error:', e);
    res.status(500).json({ error: 'Ошибка подтверждения кода' });
  }
});

/* ===================== Профиль ===================== */
app.post('/api/me/update-profile', requireAuth, async (req, res) => {
  try {
    let { first_name, last_name, email } = req.body || {};
    first_name = (first_name || '').trim();
    last_name = (last_name || '').trim();
    email = (email || '').trim();

    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'Имя, фамилия и email обязательны' });
    }
    const [exists] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [email, req.user.id]);
    if (exists.length) return res.status(400).json({ error: 'Этот email уже используется' });

    await db.query('UPDATE users SET first_name=?, last_name=?, email=? WHERE id=?', [first_name, last_name, email, req.user.id]);

    const user = await getUserById(req.user.id);
    res.json({ ok: true, user });
  } catch (e) {
    console.error('update-profile error:', e);
    res.status(500).json({ error: 'Не удалось сохранить профиль' });
  }
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.user || null });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

/* ===================== Products (public) ===================== */
/** общий обработчик листинга с ?category=... */
const listProducts = async (req, res) => {
  const { category } = req.query;
  try {
    let sql =
      `SELECT
          p.id,
          p.title,
          p.description,
          p.price,
          p.qty,
          p.status,
          p.category,
          p.created_at,
          TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS seller_name
       FROM products p
       JOIN users u ON u.id = p.seller_id
       WHERE p.status = 'active' AND p.qty > 0`;
    const params = [];

    if (category) {
      sql += ` AND p.category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY p.created_at DESC LIMIT 100`;

    const [rows] = await db.query(sql, params);
    res.json({ items: rows });
  } catch (e) {
    console.error('GET /products error', e);
    res.status(500).json({ message: 'Server error' });
  }
};

/** общий обработчик создания товара */
const createProduct = async (req, res) => {
  const { title, description, price, qty, category } = req.body || {};
  if (!title || price == null || !category || String(category).trim() === '') {
    return res.status(400).json({ message: 'title, price и category обязательны' });
  }

  const p = Number(price);
  if (!Number.isFinite(p) || p < 0) {
    return res.status(400).json({ message: 'price должен быть неотрицательным числом' });
  }
  const q = Number.isFinite(Number(qty)) ? Math.max(0, parseInt(qty, 10)) : 1;

  try {
    // создаём товар сразу активным
    const [result] = await db.query(
      `INSERT INTO products (seller_id, title, description, price, qty, category, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())`,
      [req.user.id, title, description || null, p, q, String(category).trim()]
    );

    const newId = result.insertId;

    // отдаём созданный товар тем же форматом, что и в листинге
    const [rows] = await db.query(
      `SELECT
          p.id,
          p.title,
          p.description,
          p.price,
          p.qty,
          p.status,
          p.category,
          p.created_at,
          TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS seller_name
       FROM products p
       JOIN users u ON u.id = p.seller_id
       WHERE p.id = ?`,
      [newId]
    );

    res.json({ ok: true, item: rows[0] });
  } catch (e) {
    console.error('POST /products error', e);
    res.status(500).json({ message: 'Server error' });
  }
};

// Листинг (оба пути)
app.get('/products', listProducts);
app.get('/api/products', listProducts);

// Создание (оба пути) — только для одобренных продавцов
app.post('/products', requireAuth, requireApprovedSeller, createProduct);
app.post('/api/products', requireAuth, requireApprovedSeller, createProduct);

/* ===================== Products: управление продавца ===================== */

// список товаров конкретного продавца
app.get('/api/my-products', requireAuth, requireApprovedSeller, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, title, description, price, qty, category, status, created_at
         FROM products
        WHERE seller_id = ?
        ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error('GET /api/my-products error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// редактирование товара
app.put('/api/products/:id', requireAuth, requireApprovedSeller, async (req, res) => {
  const { id } = req.params;
  const { title, description, price, qty, category } = req.body || {};
  try {
    const [result] = await db.query(
      `UPDATE products
          SET title = ?, description = ?, price = ?, qty = ?, category = ?
        WHERE id = ? AND seller_id = ?`,
      [title, description, price, qty, category, id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Товар не найден' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /api/products/:id error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// удаление товара
app.delete('/api/products/:id', requireAuth, requireApprovedSeller, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query(
      `DELETE FROM products WHERE id = ? AND seller_id = ?`,
      [id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Товар не найден' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/products/:id error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ===================== Admin: удаление чужих товаров с причиной ===================== */
app.delete('/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  const productId = Number(req.params.id);
  const { reason } = req.body || {};
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ message: 'Укажите причину удаления' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1) читаем товар
    const [rows] = await conn.query(
      `SELECT id, seller_id, title, price, category
         FROM products
        WHERE id = ?`,
      [productId]
    );
    const prod = rows[0];
    if (!prod) {
      await conn.rollback();
      return res.status(404).json({ message: 'Товар не найден' });
    }

    // 2) логируем удаление
    await conn.query(
      `INSERT INTO product_deletions (product_id, seller_id, title, price, category, admin_id, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [prod.id, prod.seller_id, prod.title, prod.price, prod.category, req.user.id, String(reason).trim()]
    );

    // 3) физически удаляем товар
    const [delRes] = await conn.query(`DELETE FROM products WHERE id = ?`, [productId]);
    if (delRes.affectedRows === 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'Не удалось удалить (возможно, уже удалён)' });
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error('DELETE /admin/products/:id error:', e);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

/* ===================== Admin: история удалений товаров ===================== */
app.get('/admin/product-deletions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
          pd.id,
          pd.product_id,
          pd.seller_id,
          u.username        AS seller_username,
          u.first_name      AS seller_first_name,
          u.last_name       AS seller_last_name,
          pd.title,
          pd.price,
          pd.category,
          pd.admin_id,
          a.username        AS admin_username,
          a.first_name      AS admin_first_name,
          a.last_name       AS admin_last_name,
          pd.reason,
          pd.created_at
       FROM product_deletions pd
       JOIN users a ON a.id = pd.admin_id
       JOIN users u ON u.id = pd.seller_id
       ORDER BY pd.created_at DESC
       LIMIT 500`
    );
    res.json({ items: rows });
  } catch (e) {
    console.error('GET /admin/product-deletions error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});


/* ===================== Chat (Mistral FREE с фолбэком) ===================== */
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;
  const PRIMARY_MODEL = 'mistralai/mistral-7b-instruct:free';
  const FALLBACK_MODELS = [
    'meta-llama/llama-3.1-8b-instruct:free',
    'openrouter/auto'
  ];

  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'AI недоступен: отсутствует OPENROUTER_API_KEY на сервере.' });
  }

  let systemContext = 'Ты вежливый ИИ-помощник, консультирующий по интернет-магазину.';
  if (req.user) systemContext += ` Пользователь: ${req.user.username}, email: ${req.user.email}.`;

  async function callModel(model) {
    const { data } = await axios.post(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      {
        model,
        messages: [
          { role: 'system', content: systemContext },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': OPENROUTER_SITE_URL,
          'X-Title': OPENROUTER_TITLE
        }
      }
    );
    const aiReply = data?.choices?.[0]?.message?.content || 'Пустой ответ от модели';
    return { aiReply, usedModel: model };
  }

  try {
    try {
      const r = await callModel(PRIMARY_MODEL);
      return res.json({ reply: r.aiReply, model: r.usedModel });
    } catch (e) {
      const s = e.response?.status;
      if (![401, 402, 403].includes(s)) throw e;
    }
    for (const m of FALLBACK_MODELS) {
      try {
        const r = await callModel(m);
        return res.json({ reply: r.aiReply, model: r.usedModel });
      } catch (e) { }
    }
    return res.status(503).json({ error: 'AI недоступен для текущего ключа/модели. Проверьте ключ и Allowed Sites.' });
  } catch (error) {
    const status = error.response?.status || 500;
    const detail = error.response?.data || error.message;
    console.error('Ошибка обращения к OpenRouter:', detail);
    res.status(status).json({
      error:
        status === 401
          ? 'Неверный/отключённый OPENROUTER_API_KEY.'
          : status === 402
            ? 'Недостаточно кредитов/лимит.'
            : status === 403
              ? 'Доступ к выбранной модели ограничен (проверьте Allowed Sites/регион/политику).'
              : 'Не удалось связаться с AI.'
    });
  }
});

/* ===================== Заявки продавцов ===================== */
app.get('/admin/applications', requireAuth, requireAdmin, async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const [rows] = await db.query(`
    SELECT a.*, u.first_name, u.last_name, u.email, u.phone
    FROM seller_applications a
    JOIN users u ON u.id = a.user_id
    WHERE a.status = ?
    ORDER BY a.created_at DESC
  `, [status]);
  res.json(rows);
});

app.post('/seller/apply', requireAuth, async (req, res) => {
  const { company_name, tax_id, price_list_url, comment } = req.body || {};
  if (!company_name || !tax_id) return res.status(400).json({ message: 'company_name and tax_id are required' });

  const [u] = await db.query('SELECT seller_status FROM users WHERE id=?', [req.user.id]);
  if (!u.length) return res.status(404).json({ message: 'User not found' });
  if (u[0].seller_status === 'approved') return res.status(400).json({ message: 'Already seller' });
  if (u[0].seller_status === 'pending') return res.status(400).json({ message: 'Application already pending' });

  await db.query(`
    INSERT INTO seller_applications (user_id, company_name, tax_id, price_list_url, comment)
    VALUES (?, ?, ?, ?, ?)
  `, [req.user.id, company_name, tax_id, price_list_url || null, comment || null]);

  await db.query(`UPDATE users SET seller_status='pending', seller_rejection_reason=NULL WHERE id=?`, [req.user.id]);

  res.json({ ok: true });
});

app.patch('/admin/applications/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { action, reason } = req.body || {};
  if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: 'Invalid action' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [apps] = await conn.query('SELECT * FROM seller_applications WHERE id=? FOR UPDATE', [id]);
    if (!apps.length) { await conn.rollback(); return res.status(404).json({ message: 'Not found' }); }
    const appRow = apps[0];
    if (appRow.status !== 'pending') { await conn.rollback(); return res.status(400).json({ message: 'Already decided' }); }

    if (action === 'approve') {
      await conn.query(
        `UPDATE seller_applications SET status='approved', decided_at=NOW(), decided_by=? WHERE id=?`,
        [req.user.id, id]
      );
      await conn.query(
        `UPDATE users SET seller_status='approved', seller_rejection_reason=NULL WHERE id=?`,
        [appRow.user_id]
      );
    } else {
      await conn.query(
        `UPDATE seller_applications SET status='rejected', rejection_reason=?, decided_at=NOW(), decided_by=? WHERE id=?`,
        [reason || null, req.user.id, id]
      );
      await conn.query(
        `UPDATE users SET seller_status='rejected', seller_rejection_reason=? WHERE id=?`,
        [reason || null, appRow.user_id]
      );
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
});

/* ===================== Товары (для одобренных продавцов) ===================== */
/** POST /products — создать товар (только approved) */
app.post('/products', requireAuth, requireApprovedSeller, async (req, res) => {
  const { title, description, price, qty, category } = req.body || {};
  if (!title || price == null || category == null || String(category).trim() === '') {
    return res.status(400).json({ message: 'title, price и category обязательны' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO products (seller_id, title, description, price, qty, category, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [req.user.id, title, description || null, Number(price), qty ?? 0, String(category).trim()]
    );

    const newId = result.insertId;
    const [rows] = await db.query(
      `SELECT p.id, p.title, p.description, p.price, p.qty, p.status, p.category, p.created_at,
              u.username AS seller_username
         FROM products p
         JOIN users u ON u.id = p.seller_id
        WHERE p.id = ?`,
      [newId]
    );

    res.json({ ok: true, item: rows[0] });
  } catch (e) {
    console.error('POST /products error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ===================== Запуск ===================== */
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`✅ Сервер работает на http://localhost:${PORT}`);
});
