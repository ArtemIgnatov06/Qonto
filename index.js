// server/index.js
const path = require('path');
const fs = require('fs');
const multer = require('multer');
// Читаем .env именно из папки server
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// +++ SOCKET.IO + HTTP
const http = require('http');
const { Server } = require('socket.io');

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

// === CORS
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',');

// === Express app (создаём ДО любых app.use)
const app = express();

// === Базовые middlewares
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// === Static uploads & multer storage for avatars ===
const uploadsRoot = path.resolve(__dirname, 'uploads');
const avatarDir = path.join(uploadsRoot, 'avatars');
try { fs.mkdirSync(avatarDir, { recursive: true }); } catch {}
app.use('/uploads', express.static(uploadsRoot));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg');
    const uid = (req.user && req.user.id) ? req.user.id : 'anon';
    cb(null, `${uid}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });
// === End uploads ===

// ==== Chat attachments upload (ниже ваших require и до роутов) ====
const chatUploadsDir = path.join(__dirname, 'uploads', 'chat');
fs.mkdirSync(chatUploadsDir, { recursive: true });

const chatStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, chatUploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safeName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, safeName);
  }
});

function isAllowedAttachment(file) {
  // разрешим картинки и общие вложения; при желании сузьте
  const ok = [
    'image/png','image/jpeg','image/webp','image/gif',
    'application/pdf','image/heic','image/heif'
  ];
  return ok.includes(file.mimetype);
}

const uploadChat = multer({
  storage: chatStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => cb(null, isAllowedAttachment(file))
});

// отдать статику
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- SOCKET.IO init (после CORS/парсеров, до маршрутов)
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: allowedOrigins, credentials: true }
});

// presence: карта кто онлайн
const onlineUsers = new Map(); // userId -> Set<socketId>

function _attach(userId, socketId) {
  if (!userId) return;
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId).add(socketId);
}
function _detach(userId, socketId) {
  const set = onlineUsers.get(userId);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) onlineUsers.delete(userId);
}

function isOnline(userId) {
  return onlineUsers.has(Number(userId));
}
function emitToUser(userId, event, payload) {
  io.to(`user:${userId}`).emit(event, payload);
}

// делаем хелперы доступными в роутерах/обработчиках дальше по файлу
app.locals.isOnline = isOnline;
app.locals.emitToUser = emitToUser;

io.on('connection', (socket) => {
  let userId = null;

  // клиент сразу после connect вызывает socket.emit('auth', <user.id>)
  socket.on('auth', (uid) => {
    userId = Number(uid);
    if (!userId) return;
    socket.join(`user:${userId}`);
    _attach(userId, socket.id);
    io.emit('presence:update', { userId, online: true });
  });

  // клиент присоединяется к комнате треда (для typing/моментальных сообщений)
  socket.on('thread:join', (threadId) => {
    if (!threadId) return;
    socket.join(`thread:${Number(threadId)}`);
  });

  // “печатает…”
  socket.on('thread:typing', ({ threadId, from }) => {
    socket.to(`thread:${Number(threadId)}`).emit('thread:typing', { threadId: Number(threadId), from });
  });

  socket.on('disconnect', () => {
    if (userId) {
      _detach(userId, socket.id);
      if (!isOnline(userId)) {
        io.emit('presence:update', { userId, online: false });
      }
    }
  });
});

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

(async () => {
  try {
    const [r] = await db.query('SELECT DATABASE() AS db');
    console.log('Connected DB =', r[0].db);
  } catch (e) {
    console.error('DB ping failed:', e.message || e);
  }
})();

const DB_NAME = process.env.DB_NAME;

async function ensureUsersExtraSchema() {
  try {
    const [c1] = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'contact_email'`,
      [DB_NAME]
    );
    if (!c1[0].cnt) {
      await db.query(`ALTER TABLE users ADD COLUMN contact_email VARCHAR(255) NULL AFTER email`);
      console.log('✅ users.contact_email added');
    }
    const [c2] = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url'`,
      [DB_NAME]
    );
    if (!c2[0].cnt) {
      await db.query(`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NULL AFTER contact_email`);
      console.log('✅ users.avatar_url added');
    }
  } catch (e) {
    console.error('ensureUsersExtraSchema error:', e?.message || e);
  }
}

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
    `SELECT id, first_name, last_name, username, phone, email, contact_email, avatar_url, role, seller_status, seller_rejection_reason FROM users WHERE id=? LIMIT 1`,
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

/* ===================== ensure schema: categories ===================== */
async function ensureCategoriesSchema() {
  try {
    await db.query(
      `CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
    );
  } catch (err) {
    console.error('ensureCategoriesSchema error:', err);
  }
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
      await db.query(`ALTER TABLE products ADD COLUMN category VARCHAR(100) NOT NULL DEFAULT '' AFTER description`);
      console.log('✅ products.category добавлен');
    }

    // status
    const [cStat] = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'status'`,
      [DB_NAME]
    );
    if (!cStat[0].cnt) {
      await db.query(`ALTER TABLE products ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER qty`);
      console.log('✅ products.status добавлен');
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

    // preview_image_url
    const [cPrev] = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND COLUMN_NAME = 'preview_image_url'`,
      [DB_NAME]
    );
    if (!cPrev[0].cnt) {
      await db.query(`ALTER TABLE products ADD COLUMN preview_image_url VARCHAR(500) NULL DEFAULT NULL AFTER status`);
      console.log('✅ products.preview_image_url добавлен');
    }

    // индексы
    const [i1] = await db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'products' AND INDEX_NAME = 'idx_products_category'`,
      [DB_NAME]
    );
    if (!i1[0].cnt) {
      await db.query(`CREATE INDEX idx_products_category ON products(category)`);
      console.log('✅ индекс idx_products_category создан');
    }

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

    // гарантируем схему categories и products
    await ensureUsersExtraSchema();
await ensureCategoriesSchema();
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
       ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), created_at = CURRENT_TIMESTAMP`,
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
    let { first_name, last_name, email, contact_email } = req.body || {};
    first_name = (first_name || '').trim();
    last_name = (last_name || '').trim();
    email = (email || '').trim();

    contact_email = (contact_email || '').trim();
if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'Имя, фамилия и email обязательны' });
    }
    const [exists] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [email, req.user.id]);
    if (exists.length) return res.status(400).json({ error: 'Этот email уже используется' });

    await db.query('UPDATE users SET first_name=?, last_name=?, email=?, contact_email=? WHERE id=?', [ first_name, last_name, email, contact_email || null, req.user.id ]);

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

app.post('/api/heartbeat', requireAuth, async (req, res) => {
  try {
    await db.query('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [req.user.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

/* ===================== Chats ===================== */

// безопасный emit (если socket.io не инициализирован – просто молча пропускаем)
function _emitTo(req, userId, event, payload) {
  try {
    const fn = req.app?.locals?.emitToUser;
    if (typeof fn === 'function') fn(userId, event, payload);
  } catch (_) {}
}

// создать/получить существующий диалог покупатель->продавец
app.post('/api/chats/start', requireAuth, async (req, res) => {
  try {
    const seller_id = Number(req.body?.seller_id);
    const buyer_id  = Number(req.user.id);

    if (!seller_id || seller_id === buyer_id) {
      return res.status(400).json({ error: 'Некорректный продавец' });
    }

    // проверим, что продавец существует
    const [se] = await db.query('SELECT id FROM users WHERE id=? LIMIT 1', [seller_id]);
    if (!se.length) return res.status(404).json({ error: 'Продавец не найден' });

    // если тред уже есть — отдадим его id
    const [ex] = await db.query(
      'SELECT id FROM chat_threads WHERE seller_id=? AND buyer_id=? LIMIT 1',
      [seller_id, buyer_id]
    );
    if (ex.length) return res.json({ id: ex[0].id });

    // создаём, избегая гонок
    await db.query(
      'INSERT IGNORE INTO chat_threads (seller_id, buyer_id) VALUES (?, ?)',
      [seller_id, buyer_id]
    );

    // гарантированно читаем id созданного/существующего треда
    const [rows] = await db.query(
      'SELECT id FROM chat_threads WHERE seller_id=? AND buyer_id=? LIMIT 1',
      [seller_id, buyer_id]
    );
    if (!rows.length) return res.status(500).json({ error: 'Не удалось создать чат' });

    return res.json({ id: rows[0].id });
  } catch (e) {
    console.error('POST /api/chats/start', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// список моих диалогов (role=seller|buyer|all)
app.get('/api/chats/my', requireAuth, async (req, res) => {
  try {
    const role = String(req.query.role || 'all');
    const me = req.user.id;

    let where = 't.seller_id=? OR t.buyer_id=?';
    let params = [me, me];
    if (role === 'seller') { where = 't.seller_id=?'; params = [me]; }
    if (role === 'buyer')  { where = 't.buyer_id=?';  params = [me]; }

    const [rows] = await db.query(
      `
      SELECT
        t.id, t.seller_id, t.buyer_id, t.updated_at,
        s.first_name AS seller_first_name, s.last_name AS seller_last_name, s.avatar_url AS seller_avatar,
        b.first_name AS buyer_first_name,  b.last_name AS buyer_last_name,  b.avatar_url AS buyer_avatar,
        (SELECT body       FROM chat_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) AS last_text,
        (SELECT created_at FROM chat_messages m WHERE m.thread_id=t.id ORDER BY m.id DESC LIMIT 1) AS last_at,
        (SELECT COUNT(*)   FROM chat_messages m WHERE m.thread_id=t.id AND m.sender_id<>? AND m.read_at IS NULL) AS unread
      FROM chat_threads t
      JOIN users s ON s.id=t.seller_id
      JOIN users b ON b.id=t.buyer_id
      WHERE ${where}
      ORDER BY COALESCE(last_at, t.updated_at) DESC
      `,
      [me, ...params]
    );

    res.json({ items: rows });
  } catch (e) {
    console.error('GET /api/chats/my', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// сообщения в диалоге
// до хэндлера: заверните middleware uploadChat.array(...)
app.post('/api/chats/:id/messages', requireAuth, uploadChat.array('files', 8), async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const me = req.user.id;
    const body = String(req.body?.body || '').trim();

    // получим тред
    const [[t]] = await db.query('SELECT * FROM chat_threads WHERE id=? LIMIT 1', [threadId]);
    if (!t) return res.status(404).json({ error: 'Диалог не найден' });
    if (t.seller_id !== me && t.buyer_id !== me) {
      return res.status(403).json({ error: 'Нет доступа к диалогу' });
    }

    // Проверка блокировки со стороны получателя
    const receiver = me === t.seller_id ? t.buyer_id : t.seller_id;
    const blockedForMe =
      (receiver === t.seller_id && t.blocked_by_seller) ||
      (receiver === t.buyer_id  && t.blocked_by_buyer);
    if (blockedForMe) {
      return res.status(403).json({ error: 'Пользователь заблокировал вас' });
    }

    const files = Array.isArray(req.files) ? req.files : [];

    // 1) Если есть текст без файлов — отдельная запись
    const created = [];
    if (body && !files.length) {
      const [r] = await db.query(
        `INSERT INTO chat_messages (thread_id, sender_id, body)
         VALUES (?, ?, ?)`,
        [threadId, me, body]
      );
      created.push({ id: r.insertId, body });
    }

    // 2) Файлы — каждая запись отдельно (body можно прикрепить к первой, если нужно)
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const attachUrl = `/uploads/chat/${f.filename}`;
      const attachType = f.mimetype;
      const attachName = f.originalname || f.filename;
      const attachSize = f.size || null;

      const thisBody = (i === 0 ? body : ''); // текст пойдёт в первую запись

      const [r2] = await db.query(
        `INSERT INTO chat_messages
           (thread_id, sender_id, body, attachment_url, attachment_type, attachment_name, attachment_size)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [threadId, me, thisBody, attachUrl, attachType, attachName, attachSize]
      );
      created.push({
        id: r2.insertId,
        body: thisBody,
        attachment_url: attachUrl,
        attachment_type: attachType,
        attachment_name: attachName,
        attachment_size: attachSize
      });
    }

    // если вообще ничего не пришло
    if (!created.length) {
      return res.status(400).json({ error: 'Пустое сообщение' });
    }

    // MUTE-логика: если получатель замутил — копим серый счётчик и НЕ триггерим всплытие
    const receiverMuted =
      (receiver === t.seller_id && t.muted_by_seller) ||
      (receiver === t.buyer_id  && t.muted_by_buyer);

    if (receiverMuted) {
      if (receiver === t.seller_id) {
        await db.query(`UPDATE chat_threads SET muted_unread_seller = muted_unread_seller + ? WHERE id=?`,
                       [created.length, threadId]);
      } else {
        await db.query(`UPDATE chat_threads SET muted_unread_buyer = muted_unread_buyer + ? WHERE id=?`,
                       [created.length, threadId]);
      }
    } else {
      // обычный «всплывающий» сценарий
      _emitTo(req, receiver, 'chat:message', {
        thread_id: threadId,
        items: created
      });
      _emitTo(req, receiver, 'chat:unread', { delta: created.length });
    }

    // Отправителю — мгновенная доставка
    _emitTo(req, me, 'chat:message:ack', { thread_id: threadId, items: created });

    res.json({ ok: true, items: created });
  } catch (e) {
    console.error('POST /api/chats/:id/messages', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// отправка сообщения (с сокет-пушами)
app.post('/api/chats/:id/messages', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const me = req.user.id;
    const text = String(req.body?.body || '').trim();
    if (!text) return res.status(400).json({ error: 'Пустое сообщение' });

    const [tt] = await db.query('SELECT * FROM chat_threads WHERE id=? LIMIT 1', [id]);
    const t = tt[0];
    if (!t || (t.seller_id !== me && t.buyer_id !== me)) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const [r] = await db.query(
      'INSERT INTO chat_messages (thread_id, sender_id, body) VALUES (?, ?, ?)',
      [id, me, text]
    );
    await db.query('UPDATE chat_threads SET updated_at=NOW() WHERE id=?', [id]);

    const payload = {
      id: r.insertId,
      thread_id: id,
      sender_id: me,
      body: text,
      created_at: new Date()
    };

    // пушим новое сообщение обоим участникам (если socket.io включён)
    _emitTo(req, t.seller_id, 'chat:message', payload);
    _emitTo(req, t.buyer_id,  'chat:message', payload);

    // инкремент непрочитанного собеседнику
    const receiver = me === t.seller_id ? t.buyer_id : t.seller_id;
    _emitTo(req, receiver, 'chat:unread', { delta: +1 });

    res.json({ ok: true, ...payload });
  } catch (e) {
    console.error('POST /api/chats/:id/messages', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// пометить входящие как прочитанные, обнулить «серый» счётчик и вернуть новое значение
app.post('/api/chats/:id/read', requireAuth, async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const me = req.user.id;

    // 1) Прочитать входящие
    await db.query(
      `UPDATE chat_messages m
       JOIN chat_threads t ON t.id = m.thread_id
       SET m.read_at = NOW()
       WHERE m.thread_id = ?
         AND m.sender_id <> ?
         AND m.read_at IS NULL`,
      [threadId, me]
    );

    // 2) Сброс «серого» счётчика для моей стороны
    await db.query(
      `UPDATE chat_threads
       SET muted_unread_seller = IF(seller_id = ?, 0, muted_unread_seller),
           muted_unread_buyer  = IF(buyer_id  = ?, 0, muted_unread_buyer)
       WHERE id = ?`,
      [me, me, threadId]
    );

    // 3) Посчитать актуальный непрочитанный (если у тебя это нужно для бейджа)
    const [[{ c }]] = await db.query(
      `SELECT COUNT(*) AS c
       FROM chat_messages m
       JOIN chat_threads t ON t.id = m.thread_id
       WHERE m.thread_id = ?
         AND (t.seller_id = ? OR t.buyer_id = ?)
         AND m.sender_id <> ?
         AND m.read_at IS NULL`,
      [threadId, me, me, me]
    );

    // 4) Обновить бейдж клиенту этой же стороне
    _emitTo(req, me, 'chat:unread:replace', { total: c });

    res.json({ ok: true, unread: c });
  } catch (e) {
    console.error('POST /api/chats/:id/read', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// helper: роль стороны
function sideColumns(me, t) {
  if (me === t.seller_id) {
    return {
      archived: 'archived_by_seller',
      muted:    'muted_by_seller',
      blocked:  'blocked_by_seller',
      muted_unread: 'muted_unread_seller'
    };
  }
  if (me === t.buyer_id) {
    return {
      archived: 'archived_by_buyer',
      muted:    'muted_by_buyer',
      blocked:  'blocked_by_buyer',
      muted_unread: 'muted_unread_buyer'
    };
  }
  return null;
}

// Архив / разархивировать
app.post('/api/chats/:id/archive', requireAuth, async (req,res)=>{
  try {
    const threadId = Number(req.params.id);
    const me = req.user.id;
    const { archive } = req.body; // true/false

    const [[t]] = await db.query('SELECT * FROM chat_threads WHERE id=? LIMIT 1',[threadId]);
    if (!t) return res.status(404).json({error:'Диалог не найден'});

    const cols = sideColumns(me, t);
    if (!cols) return res.status(403).json({error:'Нет доступа'});

    await db.query(`UPDATE chat_threads SET ${cols.archived}=? WHERE id=?`, [archive?1:0, threadId]);
    res.json({ ok:true, archived: !!archive });
  } catch(e){
    console.error('archive', e); res.status(500).json({error:'Server error'});
  }
});

// Мут / размутить
app.post('/api/chats/:id/mute', requireAuth, async (req,res)=>{
  try {
    const threadId = Number(req.params.id);
    const me = req.user.id;
    const { mute } = req.body; // true/false

    const [[t]] = await db.query('SELECT * FROM chat_threads WHERE id=? LIMIT 1',[threadId]);
    if (!t) return res.status(404).json({error:'Диалог не найден'});

    const cols = sideColumns(me, t);
    if (!cols) return res.status(403).json({error:'Нет доступа'});

    await db.query(`UPDATE chat_threads SET ${cols.muted}=? WHERE id=?`, [mute?1:0, threadId]);
    if (!mute) {
      // при размуте можно "посеревшие" обнулить (опционально)
      await db.query(`UPDATE chat_threads SET ${cols.muted_unread}=0 WHERE id=?`, [threadId]);
    }
    res.json({ ok:true, muted: !!mute });
  } catch(e){
    console.error('mute', e); res.status(500).json({error:'Server error'});
  }
});

// Блок / разблок
app.post('/api/chats/:id/block', requireAuth, async (req,res)=>{
  try{
    const threadId = Number(req.params.id);
    const me = req.user.id;
    const { block } = req.body; // true/false

    const [[t]] = await db.query('SELECT * FROM chat_threads WHERE id=? LIMIT 1',[threadId]);
    if (!t) return res.status(404).json({error:'Диалог не найден'});

    const cols = sideColumns(me, t);
    if (!cols) return res.status(403).json({error:'Нет доступа'});

    await db.query(`UPDATE chat_threads SET ${cols.blocked}=? WHERE id=?`, [block?1:0, threadId]);
    res.json({ ok:true, blocked: !!block });
  } catch(e){
    console.error('block', e); res.status(500).json({error:'Server error'});
  }
});

// сколько непрочитанных у меня (для хедера при загрузке)
app.get('/api/chats/unread-count', requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const [[{ c }]] = await db.query(
      `SELECT COUNT(*) AS c
         FROM chat_messages m
         JOIN chat_threads t ON t.id=m.thread_id
        WHERE (t.seller_id=? OR t.buyer_id=?)
          AND m.sender_id<>?
          AND m.read_at IS NULL`,
      [me, me, me]
    );
    res.json({ count: c });
  } catch (e) {
    console.error('GET /api/chats/unread-count', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// получить список сообщений в треде
app.get('/api/chats/:id/messages', requireAuth, async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const me = req.user.id;

    const [[thread]] = await db.query(
      'SELECT * FROM chat_threads WHERE id=? AND (seller_id=? OR buyer_id=?)',
      [threadId, me, me]
    );
    if (!thread) return res.status(404).json({ error: 'Диалог не найден' });

    const [items] = await db.query(
      `SELECT id, thread_id, sender_id, body, attachment_url, attachment_type,
              attachment_name, attachment_size, created_at, read_at, edited_at, deleted_at
       FROM chat_messages
       WHERE thread_id=?
       ORDER BY created_at ASC`,
      [threadId]
    );

    res.json({ thread, items });
  } catch (e) {
    console.error('GET /api/chats/:id/messages', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/messages/:id — редактировать (только автор, если не удалено)
app.patch('/api/messages/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const me = req.user.id;
    const body = String(req.body?.body || '').trim();

    const [[m]] = await db.query(
      `SELECT m.*, t.seller_id, t.buyer_id
       FROM chat_messages m
       JOIN chat_threads t ON t.id = m.thread_id
       WHERE m.id=? LIMIT 1`, [id]
    );
    if (!m) return res.status(404).json({ error: 'Сообщение не найдено' });
    if (m.sender_id !== me) return res.status(403).json({ error: 'Можно редактировать только свои сообщения' });
    if (m.deleted_at) return res.status(400).json({ error: 'Сообщение удалено' });

    await db.query(`UPDATE chat_messages SET body=?, edited_at=NOW() WHERE id=?`, [body, id]);
    const [[updated]] = await db.query(
      `SELECT id, thread_id, sender_id, body, attachment_url, attachment_type,
              attachment_name, attachment_size, created_at, read_at, edited_at, deleted_at
       FROM chat_messages WHERE id=?`, [id]
    );

    // уведомим обе стороны
    _emitTo(req, m.seller_id, 'chat:message:update', { thread_id: m.thread_id, item: updated });
    _emitTo(req, m.buyer_id,  'chat:message:update', { thread_id: m.thread_id, item: updated });

    res.json({ ok: true, item: updated });
  } catch (e) {
    console.error('PATCH /api/messages/:id', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/messages/:id — мягкое удаление (только автор)
app.delete('/api/messages/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const me = req.user.id;

    const [[m]] = await db.query(
      `SELECT m.*, t.seller_id, t.buyer_id
       FROM chat_messages m
       JOIN chat_threads t ON t.id = m.thread_id
       WHERE m.id=? LIMIT 1`, [id]
    );
    if (!m) return res.status(404).json({ error: 'Сообщение не найдено' });
    if (m.sender_id !== me) return res.status(403).json({ error: 'Можно удалять только свои сообщения' });
    if (m.deleted_at) {
      // уже удалено — просто отдать как есть
      return res.json({
        ok: true,
        item: {
          id: m.id,
          thread_id: m.thread_id,
          sender_id: m.sender_id,
          body: m.body, // оставляем как есть
          attachment_url: null,
          attachment_type: null,
          attachment_name: null,
          attachment_size: null,
          created_at: m.created_at,
          read_at: m.read_at,
          edited_at: m.edited_at,
          deleted_at: m.deleted_at
        }
      });
    }

    // Мягко: вложения чистим, ставим deleted_at, body оставляем (или делаем пустым)
    await db.query(
      `UPDATE chat_messages
         SET attachment_url=NULL,
             attachment_type=NULL,
             attachment_name=NULL,
             attachment_size=NULL,
             edited_at=NULL,
             deleted_at=NOW(),
             body=''  -- безопасно для NOT NULL
       WHERE id=?`,
      [id]
    );

    const [[updated]] = await db.query(
      `SELECT id, thread_id, sender_id, body, attachment_url, attachment_type,
              attachment_name, attachment_size, created_at, read_at, edited_at, deleted_at
       FROM chat_messages WHERE id=?`, [id]
    );

    _emitTo(req, m.seller_id, 'chat:message:update', { thread_id: m.thread_id, item: updated });
    _emitTo(req, m.buyer_id,  'chat:message:update', { thread_id: m.thread_id, item: updated });

    res.json({ ok: true, item: updated });
  } catch (e) {
    console.error('DELETE /api/messages/:id', e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ===================== Categories ===================== */
async function isCategoryExists(name) {
  const [rows] = await db.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [String(name || '').trim()]);
  return rows.length > 0;
}

app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name FROM categories ORDER BY name ASC');
    res.json({ items: rows });
  } catch (e) {
    console.error('GET /api/categories error:', e);
    res.status(500).json({ message: 'Не удалось загрузить категории' });
  }
});

app.post('/admin/categories', requireAuth, requireAdmin, async (req, res) => {
  try {
    let { name } = req.body || {};
    name = (name || '').toString().trim();
    if (!name) return res.status(400).json({ message: 'Название категории обязательно' });
    if (name.length > 100) return res.status(400).json({ message: 'Слишком длинное название' });

    await db.query('INSERT INTO categories (name) VALUES (?)', [name]);
    const [rows] = await db.query('SELECT id, name FROM categories WHERE name = ? LIMIT 1', [name]);
    res.status(201).json({ item: rows[0] });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Такая категория уже существует' });
    }
    console.error('POST /admin/categories error:', e);
    res.status(500).json({ message: 'Не удалось добавить категорию' });
  }
});

/* ===================== Products (public) ===================== */
/** общий обработчик листинга с ?category=... */
// server/index.js
async function listProducts(req, res) {
  try {
    const { category } = req.query;
    const params = [];
    let where = "p.status = 'active'";

    if (category) {
      where += " AND p.category = ?";
      params.push(category);
    }

    const [rows] = await db.query(
      `
      SELECT
        p.id,
        p.title,
        p.description,
        p.price,
        p.qty,
        p.status,
        p.category,
        p.created_at,
        p.preview_image_url, -- <— ВАЖНО!
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS seller_name
      FROM products p
      JOIN users u ON u.id = p.seller_id
      WHERE ${where}
      ORDER BY p.created_at DESC
      `,
      params
    );

    res.json({ items: rows });
  } catch (e) {
    console.error('GET /products error', e);
    res.status(500).json({ message: 'Server error' });
  }
}

// и маршруты
app.get('/products', listProducts);
app.get('/api/products', listProducts);

// ── NEW: проверяем, что категория существует в таблице categories
async function isCategoryExists(name) {
  const cat = String(name || '').trim();
  if (!cat) return false;
  const [rows] = await db.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [cat]);
  return rows.length > 0;
}

/** общий обработчик создания товара */
const createProduct = async (req, res) => {
  try {
    const { title, description, price, qty, category, preview_image_url } = req.body || {};
    if (!title || price == null || !category || String(category).trim() === '') {
      return res.status(400).json({ message: 'title, price и category обязательны' });
    }

    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) {
      return res.status(400).json({ message: 'price должен быть неотрицательным числом' });
    }
    const q = Number.isFinite(Number(qty)) ? Math.max(0, parseInt(qty, 10)) : 1;

    const preview = (preview_image_url && String(preview_image_url).trim()) || null;
    if (preview && !/^https?:\/\//i.test(preview)) {
      return res.status(400).json({ message: 'preview_image_url должен быть абсолютным URL' });
    }

    const cat = String(category).trim();

    // ── NEW: НЕ-админ не может создавать новую категорию — только выбирать существующую
    if (req.user?.role !== 'admin') {
      const exists = await isCategoryExists(cat);
      if (!exists) {
        return res.status(400).json({ message: 'Категория должна существовать. Обратитесь к администратору.' });
      }
    }

    // создаём товар сразу активным
    const [result] = await db.query(
      `INSERT INTO products (seller_id, title, description, price, qty, category, status, preview_image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, NOW())`,
      [req.user.id, title, description || null, p, q, cat, preview]
    );

    const newId = result.insertId;

    // отдаём созданный товар
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
         p.preview_image_url,
         TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS seller_name
       FROM products p
       JOIN users u ON u.id = p.seller_id
       WHERE p.id = ?
       LIMIT 1`,
      [newId]
    );

    res.status(201).json({ ok: true, item: rows[0] });
  } catch (e) {
    console.error('POST /products error', e);
    res.status(500).json({ message: 'Server error' });
  }
};

// Листинг
app.get('/products', listProducts);
app.get('/api/products', listProducts);

// Создание (оба пути) — только для одобренных продавцов
app.post('/products', requireAuth, requireApprovedSeller, createProduct);
app.post('/api/products', requireAuth, requireApprovedSeller, createProduct);

/* ===================== Products: управление продавца ===================== */

// список товаров конкретного продавца
// список товаров текущего пользователя (для страницы "Мои товары")
app.get('/api/my/products', requireAuth, requireApprovedSeller, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         p.id,
         p.title,
         p.description,
         p.price,
         p.qty,
         p.category,
         p.status,
         p.created_at,
         p.preview_image_url
       FROM products p
       WHERE p.seller_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error('GET /api/my/products error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// fallback без /api (если фронт вдруг обратится на /my/products)
app.get('/my/products', requireAuth, requireApprovedSeller, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         p.id,
         p.title,
         p.description,
         p.price,
         p.qty,
         p.category,
         p.status,
         p.created_at,
         p.preview_image_url
       FROM products p
       WHERE p.seller_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error('GET /my/products error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// редактирование товара
app.put('/api/products/:id', requireAuth, requireApprovedSeller, async (req, res) => {
  const { id } = req.params;
  const { title, description, price, qty, category } = req.body || {};

  try {
    // ── NEW: нормализуем категорию и проверяем её существование для НЕ-админа
    const cat = category != null ? String(category).trim() : category;
    if (cat && req.user?.role !== 'admin') {
      const exists = await isCategoryExists(cat);
      if (!exists) {
        return res.status(400).json({ message: 'Категория должна существовать. Обратитесь к администратору.' });
      }
    }

    const [result] = await db.query(
      `UPDATE products
         SET title = ?, description = ?, price = ?, qty = ?, category = ?
       WHERE id = ? AND seller_id = ?`,
      [title, description, price, qty, cat, id, req.user.id] // <- используем cat
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

/* ------- Product details (public) ------- */
app.get('/api/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });

  try {
    const [rows] = await db.query(
      `
      SELECT
        p.id, p.title, p.description, p.price, p.qty, p.status, p.category, p.created_at,
        u.id AS seller_id,
        TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS seller_name,
        /* подзапросы вместо GROUP BY */
        COALESCE((
          SELECT ROUND(AVG(r2.rating), 1)
          FROM product_reviews r2
          WHERE r2.product_id = p.id
        ), 0) AS avg_rating,
        (
          SELECT COUNT(*) FROM product_reviews r3 WHERE r3.product_id = p.id
        ) AS reviews_count
      FROM products p
      JOIN users u ON u.id = p.seller_id
      WHERE p.id = ?
      LIMIT 1
      `,
      [id]
    );

    const item = rows[0];
    if (!item) return res.status(404).json({ message: 'Товар не найден' });
    return res.json({ item });
  } catch (e) {
    console.error('GET /api/products/:id error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ------- Reviews: list (public) ------- */
app.get('/api/products/:id/reviews', async (req, res) => {
  const productId = Number(req.params.id);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '20', 10)));
  const offset = Math.max(0, parseInt(req.query.offset ?? '0', 10));

  if (!Number.isFinite(productId)) {
    return res.status(400).json({ message: 'Invalid id' });
  }

  try {
    const [rows] = await db.query(
      `
      SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        r.updated_at,
        r.user_id,
        -- удобное отображаемое имя
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name,
        u.username
      FROM product_reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ? OFFSET ?
      `,
      [productId, limit, offset]
    );

    res.json({ items: rows || [], limit, offset });
  } catch (e) {
    console.error('GET /api/products/:id/reviews error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ------- Reviews: create/update (auth) ------- */
app.post('/api/products/:id/reviews', requireAuth, async (req, res) => {
  const productId = Number(req.params.id);
  let { rating, comment } = req.body || {};

  if (!Number.isFinite(productId)) {
    return res.status(400).json({ message: 'Invalid id' });
  }

  rating = parseInt(rating, 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'rating должен быть целым числом от 1 до 5' });
  }

  comment = (comment ?? '').toString().trim() || null;

  try {
    // один отзыв на пользователя для товара (upsert)
    await db.query(
      `
      INSERT INTO product_reviews (product_id, user_id, rating, comment)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        rating     = VALUES(rating),
        comment    = VALUES(comment),
        updated_at = CURRENT_TIMESTAMP
      `,
      [productId, req.user.id, rating, comment]
    );

    // отдаем актуальный отзыв тем же форматом, что GET
    const [rows] = await db.query(
      `
      SELECT
        r.id,
        r.rating,
        r.comment,
        r.created_at,
        r.updated_at,
        r.user_id,
        TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name,
        u.username
      FROM product_reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ? AND r.user_id = ?
      ORDER BY r.updated_at DESC, r.id DESC
      LIMIT 1
      `,
      [productId, req.user.id]
    );

    return res.status(201).json({ item: rows[0] });
  } catch (e) {
    console.error('POST /api/products/:id/reviews error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ===================== CART ===================== */

/* List cart items for current user */
app.get('/api/cart', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT
        ci.product_id,
        ci.qty,
        p.title,
        p.price
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = ?
      ORDER BY ci.updated_at DESC, ci.id DESC
      `,
      [req.user.id]
    );
    res.json({ items: rows || [] });
  } catch (e) {
    console.error('GET /api/cart error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

/* Add to cart (upsert) */
app.post('/api/cart', requireAuth, async (req, res) => {
  let { product_id, qty } = req.body || {};
  const pid = Number(product_id);
  const q = Math.max(1, parseInt(qty ?? '1', 10));
  if (!Number.isFinite(pid)) return res.status(400).json({ message: 'Invalid product_id' });

  try {
    await db.query(
      `
      INSERT INTO cart_items (user_id, product_id, qty)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE qty = qty + VALUES(qty), updated_at = CURRENT_TIMESTAMP
      `,
      [req.user.id, pid, q]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error('POST /api/cart error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

/* Update quantity (set) */
app.patch('/api/cart/:productId', requireAuth, async (req, res) => {
  const pid = Number(req.params.productId);
  const q = parseInt((req.body || {}).qty, 10);
  if (!Number.isFinite(pid)) return res.status(400).json({ message: 'Invalid id' });

  try {
    if (!Number.isInteger(q) || q <= 0) {
      await db.query(`DELETE FROM cart_items WHERE user_id=? AND product_id=?`, [req.user.id, pid]);
      return res.json({ ok: true, removed: true });
    }
    await db.query(
      `UPDATE cart_items SET qty=?, updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND product_id=?`,
      [q, req.user.id, pid]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/cart/:productId error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

/* Remove item */
app.delete('/api/cart/:productId', requireAuth, async (req, res) => {
  const pid = Number(req.params.productId);
  if (!Number.isFinite(pid)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await db.query(`DELETE FROM cart_items WHERE user_id=? AND product_id=?`, [req.user.id, pid]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/cart/:productId error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ===================== CHECKOUT (demo) ===================== */

/* Create order from cart + address + demo payment */
app.post('/api/checkout', requireAuth, async (req, res) => {
  const { address, payment } = req.body || {};
  const country = (address?.country || '').trim();
  const city = (address?.city || '').trim();
  const street = (address?.street || '').trim();
  const postal = (address?.postal || '').trim();

  if (!country || !city || !street || !postal) {
    return res.status(400).json({ message: 'Не все поля адреса заполнены' });
  }

  try {
    // 1) читаем корзину
    const [cart] = await db.query(
      `
      SELECT ci.product_id, ci.qty, p.price
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = ?
      `,
      [req.user.id]
    );
    if (!cart || cart.length === 0) {
      return res.status(400).json({ message: 'Корзина пуста' });
    }

    // 2) создаём заказ
    const total = cart.reduce((s, row) => s + Number(row.price) * Number(row.qty), 0);
    const [insOrder] = await db.query(
      `INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, 'created')`,
      [req.user.id, total.toFixed(2)]
    );
    const orderId = insOrder.insertId;

    // 3) позиции заказа
    const values = cart.map(r => [orderId, r.product_id, r.qty, r.price]);
    await db.query(
      `INSERT INTO order_items (order_id, product_id, qty, price) VALUES ?`,
      [values]
    );

    // 4) адрес
    await db.query(
      `INSERT INTO order_addresses (order_id, country, city, street, postal_code) VALUES (?, ?, ?, ?, ?)`,
      [orderId, country, city, street, postal]
    );

    // 5) демо-платёж: валидируем Луна, определяем бренд, сохраняем только last4/brand
    const cardNumber = (payment?.cardNumber || '').replace(/\s+/g, '');
    const exp = (payment?.exp || '').trim(); // MM/YY
    const cvc = (payment?.cvc || '').trim(); // не сохраняем
    const luhnOk = /^[0-9]{12,19}$/.test(cardNumber) && luhn(cardNumber);
    if (!luhnOk || !/^\d{2}\/\d{2}$/.test(exp) || !/^\d{3,4}$/.test(cvc)) {
      return res.status(400).json({ message: 'Некорректные карточные данные (демо-валидация)' });
    }
    const last4 = cardNumber.slice(-4);
    const brand = detectBrand(cardNumber);

    // помечаем заказ оплаченным (демо)
    await db.query(`UPDATE orders SET status='paid' WHERE id=?`, [orderId]);
    await db.query(`INSERT INTO payments (order_id, provider, brand, last4, status) VALUES (?, 'demo', ?, ?, 'succeeded')`,
      [orderId, brand, last4]
    );

    // 6) чистим корзину
    await db.query(`DELETE FROM cart_items WHERE user_id=?`, [req.user.id]);

    res.status(201).json({ ok: true, order_id: orderId, total, brand, last4 });
  } catch (e) {
    console.error('POST /api/checkout error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

/* helpers */
function luhn(num) {
  let sum = 0, dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = +num[i];
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return sum % 10 === 0;
}
function detectBrand(n) {
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n) || /^2(2[2-9]|[3-6]|7[01])/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^6(?:011|5)/.test(n)) return 'discover';
  return 'card';
}

/* ===================== Users: online status ===================== */
(async () => {
  try {
    const [c1] = await db.query("SHOW COLUMNS FROM users LIKE 'last_seen_at'");
    if (!c1.length) {
      await db.query("ALTER TABLE users ADD COLUMN last_seen_at DATETIME NULL, ADD INDEX idx_last_seen (last_seen_at)");
      console.log('✅ added users.last_seen_at');
    }
  } catch (e) {
    console.error('ensure last_seen_at error:', e.message || e);
  }
})();

/* ===================== Chat schema ===================== */
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_threads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        seller_id INT NOT NULL,
        buyer_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_pair (seller_id, buyer_id),
        INDEX idx_seller (seller_id, updated_at),
        INDEX idx_buyer (buyer_id, updated_at),
        CONSTRAINT fk_chat_threads_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_threads_buyer  FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        thread_id INT NOT NULL,
        sender_id INT NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        read_at DATETIME NULL,
        INDEX idx_thread_created (thread_id, created_at),
        CONSTRAINT fk_chat_messages_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ chat tables ready');
  } catch (e) {
    console.error('ensure chat schema error:', e.message || e);
  }
})();

/* ===================== Запуск ===================== */
const PORT = process.env.PORT || 5050;

// Upload avatar
app.post('/api/me/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const url = `/uploads/avatars/${req.file.filename}`;
    await db.query('UPDATE users SET avatar_url=? WHERE id=?', [url, req.user.id]);
    res.json({ url });
  } catch (e) {
    console.error('avatar upload error:', e);
    res.status(500).json({ error: 'Failed to save avatar' });
  }
});

server.listen(PORT, () => {
  console.log(`✅ Сервер + Socket.IO на http://localhost:${PORT}`);
});

// Public user profile
app.get('/api/users/:id/public', async (req, res) => {
  const userId = Number(req.params.id);
  try {
    const [rows] = await db.query(
      `SELECT id, first_name, last_name, contact_email, avatar_url, last_seen_at
         FROM users
        WHERE id=? LIMIT 1`,
      [userId]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    const u = rows[0];

    // Average rating across user's products
    const [[r1]] = await db.query(
      `SELECT ROUND(AVG(r.rating), 2) AS rating
         FROM product_reviews r
         JOIN products p ON p.id = r.product_id
        WHERE p.seller_id = ?`,
      [userId]
    );

    // Items sold count (qty)
    const [[r2]] = await db.query(
      `SELECT COALESCE(SUM(oi.qty),0) AS soldCount
         FROM order_items oi
         JOIN orders o   ON o.id = oi.order_id
         JOIN products p ON p.id = oi.product_id
        WHERE p.seller_id = ?
          AND o.status IN ('paid','completed')`,
      [userId]
    );

    const online = req.app?.locals?.isOnline ? req.app.locals.isOnline(userId) : false;

    res.json({
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      contactEmail: u.contact_email,
      avatarUrl: u.avatar_url,
      rating: r1?.rating != null ? Number(r1.rating) : null,
      soldCount: Number(r2?.soldCount || 0),
      online,
      lastSeenAt: u.last_seen_at,
    });
  } catch (e) {
    console.error('GET /api/users/:id/public error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});
