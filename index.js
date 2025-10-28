import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import mysql from 'mysql2/promise';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import multer from 'multer';
import http from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';

import countriesLib from 'i18n-iso-countries';



import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Register i18n-iso-countries locales (via createRequire to avoid ESM JSON assert issues)
countriesLib.registerLocale(require('i18n-iso-countries/langs/uk.json'));
countriesLib.registerLocale(require('i18n-iso-countries/langs/en.json'));
let ukLocale, enLocale;
try { ukLocale = require('i18n-iso-countries/langs/uk.json'); } catch { }
try { enLocale = require('i18n-iso-countries/langs/en.json'); } catch { }
if (ukLocale && !countriesLib.getAlpha2Codes().__ukRegistered) {

  countriesLib.getAlpha2Codes().__ukRegistered = true;
}
if (enLocale && !countriesLib.getAlpha2Codes().__enRegistered) {

  countriesLib.getAlpha2Codes().__enRegistered = true;
}

/* Optional SMS via Twilio (only if configured) */
let twilioClient = null;
const SMS_PROVIDER = process.env?.SMS_PROVIDER || '';
try {
  if (SMS_PROVIDER === 'twilio') {
    const { default: twilio } = await import('twilio');
    if (process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
      twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
    }
  }
} catch (_) { /* optional dependency */ }

// === .env from server/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

// === SQL loader (generated) ===
import { readFileSync } from 'fs';
import { resolve as _resolve } from 'path';

import { Country as CSCountry, State as CSState, City as CSCity } from 'country-state-city';
// --- AI Router (совместимо с CJS/ESM) ---
function getUserCtx(req) {
  return {
    id: req.user?.id || null,
    username: req.user?.username || null,
    email: req.user?.email || null,
  };
}
const hooks = {}; // при необходимости добавишь

let createAiRouter = null;
try {
  const mod = await import('./server/aiRouter.mjs');         // динамически
  createAiRouter = mod.default || mod.createAiRouter;         // CJS(default) | ESM(named)
} catch (e) {
  console.warn('AI router disabled:', e.message);
}

// подключаем, только если реально нашли экспорт


/* === Moderation utilities (auto-injected) === */
async function firstExistingTable(db, candidates) {
  for (const t of candidates) {
    try {
      const [rows] = await db.query('SHOW TABLES LIKE ?', [t]);
      if (rows && rows.length) return t;
    } catch (_) { /* ignore */ }
  }
  return null;
}

async function smartCount(db, table) {
  if (!table) return { count: 0, lastTime: null };
  const statusCols = ['status', 'state', 'moder_status', 'moder_state'];
  const createdCols = ['created_at', 'createdAt', 'created', 'date', 'created_time', 'timestamp'];
  // try pending-like filter first
  for (const col of statusCols) {
    try {
      const [rows] = await db.query(
        `SELECT COUNT(*) AS c FROM \`${table}\` WHERE \`${col}\` IN ('pending','new','open','created','waiting')`
      );
      let lastTime = null;
      for (const cc of createdCols) {
        try {
          const [lr] = await db.query(`SELECT MAX(\`${cc}\`) AS m FROM \`${table}\``);
          lastTime = (lr && lr[0] && (lr[0].m ?? lr[0].M)) || lastTime;
          if (lastTime) break;
        } catch (_) { }
      }
      if (rows && rows[0] && rows[0].c !== undefined) {
        return { count: Number(rows[0].c) || 0, lastTime: lastTime || null };
      }
    } catch (_) { }
  }
  // fallback: just count all
  try {
    const [rows] = await db.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
    let lastTime = null;
    for (const cc of createdCols) {
      try {
        const [lr] = await db.query(`SELECT MAX(\`${cc}\`) AS m FROM \`${table}\``);
        lastTime = (lr && lr[0] && (lr[0].m ?? lr[0].M)) || lastTime;
        if (lastTime) break;
      } catch (_) { }
    }
    return { count: Number(rows?.[0]?.c) || 0, lastTime: lastTime || null };
  } catch (e) {
    console.error('smartCount error:', e);
    return { count: 0, lastTime: null };
  }
}

function rowsToItems(rows) {
  return rows.map(r => ({
    id: r.id ?? r.ID ?? r.request_id ?? r.complaint_id,
    user_id: r.user_id ?? r.uid ?? r.author_id ?? r.customer_id,
    // ПРИОРИТЕТ: сначала ФИО, затем альтернативы, и только потом username
    user_name:
      [r.first_name || '', r.last_name || ''].join(' ').trim() ||
      r.full_name || r.user_name || r.customer_name || r.username || null,
    avatar_url: r.avatar_url || r.avatar || r.photo_url || null,
    store_name: r.store_name || r.shop_name || r.market_name || r.store || r.shop || null,
    created_at: r.created_at || r.createdAt || r.date || r.created_time || r.timestamp || null
  }));
}

function _parseQueries(filePath) {
  let src = '';
  try { src = readFileSync(filePath, 'utf8'); } catch (_) { /* optional */ }
  const map = {};
  let current = null, buf = [];
  const lines = src.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*--\s*name:\s*(\w+)/i);
    if (m) {
      if (current && buf.length) map[current] = buf.join('\n').trim();
      current = m[1];
      buf = [];
    } else {
      buf.push(line);
    }
  }
  if (current && buf.length) map[current] = buf.join('\n').trim();
  return map;
}

const SQL = Object.freeze({
  ..._parseQueries(_resolve(__dirname, 'sql/queries.sql')),
  ..._parseQueries(_resolve(__dirname, 'sql/schema.sql')),
});
// === /SQL loader ===

// === CORS
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',');

// === Express app
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN?.split(',') || '*',
  credentials: true
}));

// Static uploads
const uploadsRoot = path.resolve(__dirname, 'uploads');
fs.mkdirSync(uploadsRoot, { recursive: true });
app.use('/uploads', express.static(uploadsRoot));

// Base middlewares
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

/* ===== Avatars upload ===== */
const avatarDir = path.join(uploadsRoot, 'avatars');
try { fs.mkdirSync(avatarDir, { recursive: true }); } catch { }
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg');
    const uid = (req.user && req.user.id) ? req.user.id : 'anon';
    cb(null, `${uid}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });
/* ===== Product images upload ===== */
const productImagesDir = path.join(uploadsRoot, 'products');
fs.mkdirSync(productImagesDir, { recursive: true });

const productImagesStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const productId = req.params.id;
    const productDir = path.join(productImagesDir, String(productId));
    fs.mkdirSync(productDir, { recursive: true });
    cb(null, productDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg');
    const fieldName = file.fieldname;
    const timestamp = Date.now();
    cb(null, `${fieldName}_${timestamp}${ext}`);
  }
});

const uploadProductImages = multer({
  storage: productImagesStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  }
});
if (createAiRouter) {
  app.use('/api/ai', createAiRouter({ getUserCtx, hooks }));
}
//app.use('/api/ai', createAiRouter({ getUserCtx, hooks }));
/* ===== Chat attachments upload ===== */
const chatUploadsDir = path.join(uploadsRoot, 'chat');
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
  const ok = [
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf', 'image/heic', 'image/heif'
  ];
  return ok.includes(file.mimetype);
}
const uploadChat = multer({
  storage: chatStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => cb(null, isAllowedAttachment(file))
});
// --- Optional AI router (safe) ---
import { pathToFileURL } from 'url';

(async () => {
  const js = path.resolve(__dirname, 'server/aiRouter.js');
  const mjs = path.resolve(__dirname, 'server/aiRouter.mjs');
  const file = fs.existsSync(mjs) ? mjs : (fs.existsSync(js) ? js : null);

  if (!file) {
    console.warn('AI router missing — skipping /api/ai');
    return;
  }
  try {
    const mod = await import(pathToFileURL(file).href);
    const createAiRouter = mod.default || mod.createAiRouter;
    if (createAiRouter) app.use('/api/ai', createAiRouter({ getUserCtx, hooks }));
  } catch (e) {
    console.warn('AI router disabled:', e.message);
  }
})();

/* ===== Reviews images upload (for product reviews) ===== */
const reviewsDir = path.join(uploadsRoot, 'reviews');
fs.mkdirSync(reviewsDir, { recursive: true });

const reviewsStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reviewsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.jpg');
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});

const uploadReviews = multer({
  storage: reviewsStorage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB на файл
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

/* ===== HTTP + Socket.IO ===== */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: allowedOrigins, credentials: true } });

// Presence map
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
function isOnline(userId) { return onlineUsers.has(Number(userId)); }
function emitToUser(userId, event, payload) { io.to(`user:${userId}`).emit(event, payload); }

app.locals.isOnline = isOnline;
app.locals.emitToUser = emitToUser;

io.on('connection', (socket) => {
  let userId = null;

  socket.on('auth', (uid) => {
    userId = Number(uid);
    if (!userId) return;
    socket.join(`user:${userId}`);
    _attach(userId, socket.id);
    io.emit('presence:update', { userId, online: true });
  });

  socket.on('thread:join', (threadId) => {
    if (!threadId) return;
    socket.join(`thread:${Number(threadId)}`);
  });

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

/* ===== MySQL ===== */
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+00:00',
  // при желании можно зафиксировать кодировку:
  // charset: 'utf8mb4_unicode_ci',
});

// === Инициализация таблицы жалоб ===
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS product_reports (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        reporter_user_id INT NULL,
        reason VARCHAR(255) NOT NULL,
        status ENUM('new','in_review','resolved','rejected') NOT NULL DEFAULT 'new',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (e) {
    console.error('report table init failed', e);
  }
})();

// Пинг БД (как у тебя было)
(async () => {
  try {
    const [r] = await db.query(SQL.select_general);
    console.log('Connected DB =', r?.[0]?.db);
  } catch (e) {
    console.error('DB ping failed:', e?.message || e);
  }
})();

const DB_NAME = process.env.DB_NAME;

async function ensureUsersExtraSchema() {
  try {
    const [c1] = await db.query(SQL.select_information_schema, [DB_NAME]);
    if (!c1[0].cnt) {
      await db.query(SQL.alter_general);
      console.log('✅ users.contact_email added');
    }
    const [c2] = await db.query(SQL.select_information_schema_02, [DB_NAME]);
    if (!c2[0].cnt) {
      await db.query(SQL.alter_general_02);
      console.log('✅ users.avatar_url added');
    }
  } catch (e) {
    console.error('ensureUsersExtraSchema error:', e?.message || e);
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

/* ====== OpenRouter (AI) ====== */
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free';
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_SITE_URL = (process.env.CLIENT_ORIGIN || 'http://localhost:3000').split(',')[0];
const OPENROUTER_TITLE = process.env.OPENROUTER_APP_TITLE || 'MyShop Assistant';
if (!OPENROUTER_API_KEY) {
  console.warn('⚠️ OPENROUTER_API_KEY не найден. /api/chat вернёт 503, пока не настроите ключ.');
}

/* ===== Helpers ===== */
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
    SQL.select_users,
    [id]
  );
  return rows[0] || null;
}
async function findUserByEmail(email) {
  const [rows] = await db.query(SQL.select_users_02, [email]);
  return rows[0] || null;
}
async function findUserByPhone(phone) {
  const [rows] = await db.query(SQL.select_users_03, [phone]);
  return rows[0] || null;
}
async function ensureUniqueUsername(base) {
  let u = (base || 'user').toString().replace(/[^a-z0-9._-]/gi, '').toLowerCase();
  if (!u) u = 'user';
  let candidate = u, i = 0;
  while (true) {
    const [r] = await db.query(SQL.select_users_04, [candidate]);
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
    SQL.insert_general,
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

/* ===== Auth middlewares ===== */
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
// === MySQL pool ensure

let pool = global.pool;

// пробуем найти существующий пул под другими именами
if (!pool) {
  pool =
    (typeof db !== 'undefined' && db) ||
    (typeof mysqlPool !== 'undefined' && mysqlPool) ||
    (typeof connection !== 'undefined' && connection) ||
    (typeof conn !== 'undefined' && conn) ||
    null;
}

// если всё же нет — создаём свой
if (!pool) {
  pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'myshopdb',
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    charset: 'utf8mb4_unicode_ci',
  });
}

// делаем пул доступным глобально (один на процесс)
global.pool = pool;

/* ===== Ensure schemas ===== */
async function ensureCategoriesSchema() {
  try {
    await db.query(
      SQL.create_general
    );
  } catch (err) {
    console.error('ensureCategoriesSchema error:', err);
  }
}
async function ensureProductsSchema() {
  try {
    const [c1] = await db.query(
      SQL.select_information_schema_03,
      [DB_NAME]
    );
    if (!c1[0].cnt) {
      await db.query(SQL.alter_general_03);
      console.log('✅ products.category добавлен');
    }
    const [cStat] = await db.query(
      SQL.select_information_schema_04,
      [DB_NAME]
    );
    if (!cStat[0].cnt) {
      await db.query(SQL.alter_general_04);
      console.log('✅ products.status добавлен');
    }
    const [c2] = await db.query(
      SQL.select_information_schema_05,
      [DB_NAME]
    );
    if (!c2[0].cnt) {
      await db.query(SQL.alter_general_05);
      console.log('✅ products.created_at добавлен');
    }
    const [cPrev] = await db.query(
      SQL.select_information_schema_06,
      [DB_NAME]
    );
    if (!cPrev[0].cnt) {
      await db.query(SQL.alter_general_06);
      console.log('✅ products.preview_image_url добавлен');
    }
    const [i1] = await db.query(
      SQL.select_information_schema_07,
      [DB_NAME]
    );
    if (!i1[0].cnt) {
      await db.query(`CREATE INDEX idx_products_category ON products(category)`);
      console.log('✅ индекс idx_products_category создан');
    }
    const [i2] = await db.query(
      SQL.select_information_schema_08,
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
    await ensureUsersExtraSchema();
    await ensureCategoriesSchema();
    await ensureProductsSchema();
  } catch (e) {
    console.error('Не удалось инициализировать таблицы:', e?.message || e);
  }
})();
const miscDir = path.join(uploadsRoot, 'misc');
fs.mkdirSync(miscDir, { recursive: true });

const miscStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, miscDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const uploadAny = multer({ storage: miscStorage });

app.post('/api/upload', uploadAny.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'file missing' });
  const relative = `/uploads/misc/${req.file.filename}`;
  // полезно сразу отдавать абсолютный, чтобы фронт не гадал про хост
  const absolute = `${req.protocol}://${req.get('host')}${relative}`;
  res.json({ url: absolute, relative });
});

// === ensure review_images with EXACT same type as product_reviews.id ===
async function ensureReviewImages(db, dbName) {
  try {
    // 1) узнаём тип id в product_reviews
    const [cols] = await db.query(`
      SELECT COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'product_reviews' AND COLUMN_NAME = 'id'
      LIMIT 1
    `, [dbName]);

    if (!cols.length) {
      console.warn('⚠️ product_reviews.id не найден — пропускаю review_images');
      return;
    }

    const columnType = cols[0].COLUMN_TYPE;  // напр. 'int(11) unsigned' или 'bigint(20) unsigned'
    // выделим базовый тип и unsigned
    const isUnsigned = /unsigned/i.test(columnType);
    const isBig = /bigint/i.test(columnType);
    const base = isBig ? 'BIGINT' : 'INT';
    const unsigned = isUnsigned ? 'UNSIGNED' : '';

    // 2) создаём таблицу если её нет
    await db.query(`
      CREATE TABLE IF NOT EXISTS review_images (
        id ${base} ${unsigned} AUTO_INCREMENT PRIMARY KEY,
        review_id ${base} ${unsigned} NOT NULL,
        url VARCHAR(512) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_review (review_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3) приводим тип review_id на случай, если таблица уже существовала с другим типом
    await db.query(`
      ALTER TABLE review_images MODIFY review_id ${base} ${unsigned} NOT NULL;
    `);

    // 4) (пере)создаём внешний ключ
    // сначала пытаемся удалить, если уже существует (не страшно, если не было)
    try { await db.query(`ALTER TABLE review_images DROP FOREIGN KEY fk_review_images_review`); } catch (_) { }

    await db.query(`
      ALTER TABLE review_images
      ADD CONSTRAINT fk_review_images_review
      FOREIGN KEY (review_id) REFERENCES product_reviews(id) ON DELETE CASCADE;
    `);

    console.log('✅ review_images table ensured (type:', base, unsigned, ')');
  } catch (e) {
    console.error('ensure review_images error:', e?.message || e);
  }
}

await ensureReviewImages(db, DB_NAME);

/* ===== Username/password auth (basic) ===== */
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, username, password, phone, email } = req.body;
    if (!firstName || !lastName || !username || !password || !phone || !email) {
      return res.status(400).json({ error: 'Все поля обязательны.' });
    }
    const [exists] = await db.query(SQL.select_users_05, [username, email]);
    if (exists.length) return res.status(400).json({ error: 'Пользователь с таким логином или email уже существует.' });

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      SQL.insert_general_02,
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
    const [rows] = await db.query(SQL.select_users_06, [username]);
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

/* ===== Auth: email/password simple ===== */
app.post('/api/register-email', async (req, res) => {
  try {
    let { firstName, lastName, password, phone, email } = req.body;
    if (!firstName || !lastName || !password || !phone || !email) {
      return res.status(400).json({ error: 'Заполните все обязательные поля.' });
    }
    phone = normalizePhone(phone);

    const [emailExists] = await db.query(SQL.select_users_07, [email]);
    if (emailExists.length) return res.status(400).json({ error: 'Пользователь с таким email уже существует.' });

    const [phoneExists] = await db.query(SQL.select_users_08, [phone]);
    if (phoneExists.length) return res.status(400).json({ error: 'Этот номер телефона уже используется.' });

    const base = (email || '').split('@')[0] || 'user';
    const username = await ensureUniqueUsername(base);
    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      SQL.insert_general_02,
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

    const [rows] = await db.query(SQL.select_users_02, [email]);
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

/* ===== Email registration with OTP (3 steps) ===== */
const jwtRegSecret = process.env.JWT_REG_SECRET || (JWT_SECRET + '_reg');
app.post('/api/register-email/start', async (req, res) => {
  try {
    let { firstName, lastName, email, phone } = req.body || {};
    firstName = (firstName || '').trim();
    lastName = (lastName || '').trim();
    email = (email || '').trim();
    phone = normalizePhone(phone || '');

    if (!firstName || !email) return res.status(400).json({ error: 'Заповніть всі поля!!!' });

    const [[e1]] = await db.query(SQL.select_users_09, [email]);
    if (e1) return res.status(400).json({ error: 'Користувач з таким email вже існує.' });
    if (phone) {
      const [[p1]] = await db.query(SQL.select_users_10, [phone]);
      if (p1) return res.status(400).json({ error: 'Цей номер теелфону вже використовується' });
    }

    const code = random6();
    const hash = sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    console.log('[OTP start]', email, code, sha256(code));

    await db.query(
      SQL.insert_general_03,
      [email, hash, expiresAt]
    );

    await sendOtpEmail(email, code);

    const reg_token = jwt.sign(
      { email, firstName, lastName, phone, stage: 'otp' },
      jwtRegSecret,
      { expiresIn: '15m' }
    );

    res.json({ ok: true, email, reg_token });
  } catch (e) {
    console.error('register-email/start', e);
    res.status(500).json({ error: 'Помилка старту реєстрації' });
  }
});
app.post('/api/register-email/verify', async (req, res) => {
  try {
    let { email, code } = req.body || {};
    email = (email || '').trim();
    code = (code || '').trim();

    console.log('[OTP verify] incoming', email, code, 'calc=', sha256(code));

    if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Некоректний код' });

    const [[row]] = await db.query(SQL.select_email_otps, [email]);
    console.log('[OTP verify] row', row?.email, row?.code_hash);
    if (!row) return res.status(400).json({ error: 'Код не запрошений або прострочений' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Код прострочений' });
    if (sha256(code) !== row.code_hash) return res.status(400).json({ error: 'Невірний код' });

    await db.query(SQL.delete_email_otps, [email]);

    const reg_token = jwt.sign({ email, stage: 'finish-allowed' }, jwtRegSecret, { expiresIn: '15m' });
    res.json({ ok: true, reg_token });
  } catch (e) {
    console.error('register-email/verify', e);
    res.status(500).json({ error: 'Помилка підтвердження коду' });
  }
});
app.post('/api/register-email/finish', async (req, res) => {
  try {
    const { reg_token, password } = req.body || {};
    if (!reg_token || !password) return res.status(400).json({ error: 'Не вистачає даних' });

    let payload;
    try { payload = jwt.verify(reg_token, jwtRegSecret); }
    catch { return res.status(400).json({ error: 'Недійсний або прострочений токен' }); }

    if (payload.stage !== 'finish-allowed' && payload.stage !== 'otp') {
      return res.status(400).json({ error: 'Невірний етап реєстрації' });
    }

    const email = payload.email;
    const [[exists]] = await db.query(SQL.select_users_09, [email]);
    if (exists) return res.status(400).json({ error: 'Email вже використовується' });

    const first_name = payload.firstName || '';
    const last_name = payload.lastName || '';
    const phone = payload.phone || '';

    const usernameBase = (email || '').split('@')[0] || 'user';
    const username = await ensureUniqueUsername(usernameBase);
    const password_hash = await bcrypt.hash(password, 10);

    const [ins] = await db.query(
      SQL.insert_general_02,
      [first_name, last_name, username, password_hash, phone, email]
    );

    const token = jwt.sign({ id: ins.insertId }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true, user: await getUserById(ins.insertId) });
  } catch (e) {
    console.error('register-email/finish', e);
    res.status(500).json({ error: 'Не вдалося завершити реєстрацію' });
  }
});

/* ===== Google OAuth + Email OTP ===== */
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
      SQL.insert_general_04,
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

    const [rows] = await db.query(SQL.select_email_otps_02, [email]);
    const row = rows?.[0];
    if (!row) return res.status(400).json({ error: 'Код не запрошен или истёк' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Код истёк, запросите новый' });
    if (sha256(code) !== row.code_hash) return res.status(400).json({ error: 'Неверный код' });

    await db.query(SQL.delete_email_otps_02, [email]);

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

/* ===== Phone linking + Phone OTP login ===== */
app.post('/api/me/update-phone', requireAuth, async (req, res) => {
  try {
    let { phone, password } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'Укажите номер телефона' });

    phone = normalizePhone(phone);

    const [exists] = await db.query(SQL.select_users_11, [phone, req.user.id]);
    if (exists.length) return res.status(400).json({ error: 'Этот номер уже привязан к другому аккаунту' });

    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть не короче 6 символов' });
    }

    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      await db.query(SQL.update_general, [phone, password_hash, req.user.id]);
    } else {
      await db.query(SQL.update_general_02, [phone, req.user.id]);
    }

    res.json({ ok: true, phone });
  } catch (e) {
    console.error('update-phone error:', e);
    res.status(500).json({ error: 'Не удалось сохранить номер' });
  }
});
app.post('/api/auth/phone/start', async (req, res) => {
  try {
    let { phone } = req.body || {};
    phone = normalizePhone(phone);
    if (!phone) return res.status(400).json({ error: 'Укажите номер телефона' });

    const user = await findUserByPhone(phone);
    if (!user) return res.status(404).json({ error: 'Этот номер не привязан ни к одному аккаунту' });

    const [last] = await db.query(SQL.select_phone_otps, [phone]);
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
      SQL.insert_general_05,
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

    const [rows] = await db.query(SQL.select_phone_otps_02, [phone]);
    const row = rows?.[0];
    if (!row) return res.status(400).json({ error: 'Код не запрошен или истёк' });
    if (new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ error: 'Код истёк, запросите новый' });
    if (sha256(code) !== row.code_hash) return res.status(400).json({ error: 'Неверный код' });

    await db.query(SQL.delete_phone_otps, [phone]);

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

/* ===== Profile & session ===== */
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
    const [exists] = await db.query(SQL.select_users_12, [email, req.user.id]);
    if (exists.length) return res.status(400).json({ error: 'Этот email уже используется' });

    await db.query(SQL.update_general_03, [first_name, last_name, email, contact_email || null, req.user.id]);

    const user = await getUserById(req.user.id);
    res.json({ ok: true, user });
  } catch (e) {
    console.error('update-profile error:', e);
    res.status(500).json({ error: 'Не удалось сохранить профиль' });
  }
});
app.get('/api/me', (req, res) => { res.json({ user: req.user || null }); });
app.post('/api/logout', (req, res) => { res.clearCookie('token'); res.json({ success: true }); });
app.post('/api/heartbeat', requireAuth, async (req, res) => {
  try { await db.query(SQL.update_general_04, [req.user.id]); res.json({ ok: true }); }
  catch { res.status(500).json({ ok: false }); }
});

/* ===== Chats ===== */
function _emitTo(req, userId, event, payload) {
  try { const fn = req.app?.locals?.emitToUser; if (typeof fn === 'function') fn(userId, event, payload); } catch (_) { }
}
app.post('/api/chats/start', requireAuth, async (req, res) => {
  try {
    const seller_id = Number(req.body?.seller_id);
    const buyer_id = Number(req.user.id);
    if (!seller_id || seller_id === buyer_id) {
      return res.status(400).json({ error: 'Некорректный продавец' });

      // === Chat list for /chats page ===
      app.get('/api/chats/my', requireAuth, async (req, res) => {
        try {
          const me = req.user.id;
          const [rows] = await db.query(
            `
      SELECT
        t.id, t.seller_id, t.buyer_id, t.updated_at,
        CASE WHEN t.seller_id = ? THEN t.buyer_id ELSE t.seller_id END AS other_id,
        TRIM(CONCAT(COALESCE(uo.first_name,''), ' ', COALESCE(uo.last_name,''))) AS other_name,
        uo.username      AS other_username,
        uo.avatar_url    AS other_avatar_url,
        (SELECT m.body FROM chat_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_text,
        (SELECT MAX(m.created_at) FROM chat_messages m WHERE m.thread_id = t.id) AS last_created_at,
        (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id = t.id AND m.sender_id <> ? AND m.read_at IS NULL) AS unread
      FROM chat_threads t
      JOIN users uo ON uo.id = CASE WHEN t.seller_id = ? THEN t.buyer_id ELSE t.seller_id END
      WHERE t.seller_id = ? OR t.buyer_id = ?
      ORDER BY COALESCE((SELECT MAX(m.created_at) FROM chat_messages m WHERE m.thread_id = t.id), t.updated_at) DESC, t.id DESC
      `,
            [me, me, me, me, me]
          );
          res.json({ items: rows || [] });
        } catch (e) {
          console.error('GET /api/chats/my error', e);
          res.status(500).json({ error: 'Server error' });
        }
      });

      // === Remove a chat thread completely ===
      app.delete('/api/chats/:id', requireAuth, async (req, res) => {
        try {
          const threadId = Number(req.params.id);
          const me = req.user.id;
          const [[t]] = await db.query(`SELECT id, seller_id, buyer_id FROM chat_threads WHERE id = ? LIMIT 1`, [threadId]);
          if (!t) return res.status(404).json({ error: 'Диалог не найден' });
          if (t.seller_id !== me && t.buyer_id !== me) return res.status(403).json({ error: 'Нет доступа' });
          const [r] = await db.query(`DELETE FROM chat_threads WHERE id = ?`, [threadId]);
          if (!r.affectedRows) return res.status(409).json({ error: 'Не удалось удалить' });
          res.json({ ok: true, id: threadId });
        } catch (e) {
          console.error('DELETE /api/chats/:id error', e);
          res.status(500).json({ error: 'Server error' });
        }
      });
    }
    const [se] = await db.query(SQL.select_users_13, [seller_id]);
    if (!se.length) return res.status(404).json({ error: 'Продавец не найден' });

    const [ex] = await db.query(
      SQL.select_chat_threads,
      [seller_id, buyer_id]
    );
    if (ex.length) return res.json({ id: ex[0].id });

    await db.query(SQL.insert_general_06, [seller_id, buyer_id]);
    const [rows] = await db.query(SQL.select_chat_threads, [seller_id, buyer_id]);
    if (!rows.length) return res.status(500).json({ error: 'Не удалось создать чат' });
    return res.json({ id: rows[0].id });
  } catch (e) {
    console.error('POST /api/chats/start', e);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Список чатов текущего пользователя
app.get('/api/chats/my', requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const [rows] = await db.query(
      `
      SELECT
        t.id, t.seller_id, t.buyer_id, t.updated_at,
        CASE WHEN t.seller_id = ? THEN t.buyer_id ELSE t.seller_id END AS other_id,
        TRIM(CONCAT(COALESCE(uo.first_name,''), ' ', COALESCE(uo.last_name,''))) AS other_name,
        uo.username AS other_username,
        uo.avatar_url AS other_avatar_url,
        (SELECT m.body FROM chat_messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_text,
        (SELECT MAX(m.created_at) FROM chat_messages m WHERE m.thread_id = t.id) AS last_created_at,
        (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id = t.id AND m.sender_id <> ? AND m.read_at IS NULL) AS unread
      FROM chat_threads t
      JOIN users uo ON uo.id = CASE WHEN t.seller_id = ? THEN t.buyer_id ELSE t.seller_id END
      WHERE t.seller_id = ? OR t.buyer_id = ?
      ORDER BY COALESCE((SELECT MAX(m.created_at) FROM chat_messages m WHERE m.thread_id = t.id), t.updated_at) DESC, t.id DESC
      `,
      [me, me, me, me, me]
    );
    res.json({ items: rows || [] });
  } catch (e) {
    console.error('GET /api/chats/my error', e);
    res.status(500).json({ error: 'Server error' });
  }
});
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'file missing' });
  const url = `/uploads/avatars/${req.file.filename}`; // <-- верный путь
  res.json({ url });
});




// Удалить чат целиком
app.delete('/api/chats/:id', requireAuth, async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const me = req.user.id;
    const [[t]] = await db.query(`SELECT id, seller_id, buyer_id FROM chat_threads WHERE id = ? LIMIT 1`, [threadId]);
    if (!t) return res.status(404).json({ error: 'Диалог не найден' });
    if (t.seller_id !== me && t.buyer_id !== me) return res.status(403).json({ error: 'Нет доступа' });
    const [r] = await db.query(`DELETE FROM chat_threads WHERE id = ?`, [threadId]);
    if (!r.affectedRows) return res.status(409).json({ error: 'Не удалось удалить' });
    res.json({ ok: true, id: threadId });
  } catch (e) {
    console.error('DELETE /api/chats/:id error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// single handler that supports text + file attachments
app.post('/api/chats/:id/messages', requireAuth, uploadChat.array('files', 8), async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const me = req.user.id;
    const body = String(req.body?.body || '').trim();

    const [[t]] = await db.query(SQL.select_chat_threads_02, [threadId]);
    if (!t) return res.status(404).json({ error: 'Диалог не найден' });
    if (t.seller_id !== me && t.buyer_id !== me) {
      return res.status(403).json({ error: 'Нет доступа к диалогу' });
    }

    const receiver = me === t.seller_id ? t.buyer_id : t.seller_id;
    const blockedForMe =
      (receiver === t.seller_id && t.blocked_by_seller) ||
      (receiver === t.buyer_id && t.blocked_by_buyer);
    if (blockedForMe) return res.status(403).json({ error: 'Пользователь заблокировал вас' });

    const files = Array.isArray(req.files) ? req.files : [];
    const created = [];

    if (body && !files.length) {
      const [r] = await db.query(
        SQL.insert_general_07,
        [threadId, me, body]
      );
      created.push({ id: r.insertId, body });
    }

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const attachUrl = `/uploads/chat/${f.filename}`;
      const attachType = f.mimetype;
      const attachName = f.originalname || f.filename;
      const attachSize = f.size || null;
      const thisBody = (i === 0 ? body : '');
      const [r2] = await db.query(
        SQL.insert_general_08,
        [threadId, me, thisBody, attachUrl, attachType, attachName, attachSize]
      );
      created.push({ id: r2.insertId, body: thisBody, attachment_url: attachUrl, attachment_type: attachType, attachment_name: attachName, attachment_size: attachSize });
    }

    if (!created.length) return res.status(400).json({ error: 'Пустое сообщение' });

    const receiverMuted =
      (receiver === t.seller_id && t.muted_by_seller) ||
      (receiver === t.buyer_id && t.muted_by_buyer);

    if (receiverMuted) {
      if (receiver === t.seller_id) {
        await db.query(SQL.update_general_05, [created.length, threadId]);
      } else {
        await db.query(SQL.update_general_06, [created.length, threadId]);
      }
    } else {
      _emitTo(req, receiver, 'chat:message', { thread_id: threadId, items: created });
      _emitTo(req, receiver, 'chat:unread', { delta: created.length });
    }
    _emitTo(req, me, 'chat:message:ack', { thread_id: threadId, items: created });
    res.json({ ok: true, items: created });
  } catch (e) {
    console.error('POST /api/chats/:id/messages', e);
    res.status(500).json({ error: 'Server error' });
  }
});

function sideColumns(me, t) {
  if (me === t.seller_id) {
    return { archived: 'archived_by_seller', muted: 'muted_by_seller', blocked: 'blocked_by_seller', muted_unread: 'muted_unread_seller' };
  }
  if (me === t.buyer_id) {
    return { archived: 'archived_by_buyer', muted: 'muted_by_buyer', blocked: 'blocked_by_buyer', muted_unread: 'muted_unread_buyer' };
  }
  return null;
}
app.get('/api/chats/unread-count', requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const [[{ c }]] = await db.query(
      SQL.select_chat_messages,
      [me, me, me]
    );
    res.json({ count: c });
  } catch (e) {
    console.error('GET /api/chats/unread-count', e);
    res.status(500).json({ error: 'Server error' });
  }
});
app.get('/api/chats/:id/messages', requireAuth, async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const me = req.user.id;
    const [[thread]] = await db.query(
      SQL.select_chat_threads_03,
      [threadId, me, me]
    );
    if (!thread) return res.status(404).json({ error: 'Диалог не найден' });
    const [items] = await db.query(
      SQL.select_chat_messages_02,
      [threadId]
    );
    res.json({ thread, items });
  } catch (e) {
    console.error('GET /api/chats/:id/messages', e);
    res.status(500).json({ error: 'Server error' });
  }
});
app.patch('/api/messages/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const me = req.user.id;
    const body = String(req.body?.body || '').trim();
    const [[m]] = await db.query(
      SQL.select_chat_messages_03, [id]
    );
    if (!m) return res.status(404).json({ error: 'Сообщение не найдено' });
    if (m.sender_id !== me) return res.status(403).json({ error: 'Можно редактировать только свои сообщения' });
    if (m.deleted_at) return res.status(400).json({ error: 'Сообщение удалено' });
    await db.query(SQL.update_general_11, [body, id]);
    const [[updated]] = await db.query(
      SQL.select_chat_messages_04, [id]
    );
    _emitTo(req, m.seller_id, 'chat:message:update', { thread_id: m.thread_id, item: updated });
    _emitTo(req, m.buyer_id, 'chat:message:update', { thread_id: m.thread_id, item: updated });
    res.json({ ok: true, item: updated });
  } catch (e) {
    console.error('PATCH /api/messages/:id', e);
    res.status(500).json({ error: 'Server error' });
  }
});
app.delete('/api/messages/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const me = req.user.id;
    const [[m]] = await db.query(
      SQL.select_chat_messages_03, [id]
    );
    if (!m) return res.status(404).json({ error: 'Сообщение не найдено' });
    if (m.sender_id !== me) return res.status(403).json({ error: 'Можно удалять только свои сообщения' });
    if (m.deleted_at) {
      return res.json({
        ok: true,
        item: {
          id: m.id, thread_id: m.thread_id, sender_id: m.sender_id, body: m.body,
          attachment_url: null, attachment_type: null, attachment_name: null, attachment_size: null,
          created_at: m.created_at, read_at: m.read_at, edited_at: m.edited_at, deleted_at: m.deleted_at
        }
      });
    }
    await db.query(
      SQL.update_general_12,
      [id]
    );
    const [[updated]] = await db.query(
      SQL.select_chat_messages_04, [id]
    );
    _emitTo(req, m.seller_id, 'chat:message:update', { thread_id: m.thread_id, item: updated });
    _emitTo(req, m.buyer_id, 'chat:message:update', { thread_id: m.thread_id, item: updated });
    res.json({ ok: true, item: updated });
  } catch (e) {
    console.error('DELETE /api/messages/:id', e);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ===== Categories & Products ===== */
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await db.query(SQL.select_categories);
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
    await db.query(SQL.insert_general_09, [name]);
    const [rows] = await db.query(SQL.select_categories_02, [name]);
    res.status(201).json({ item: rows[0] });
  } catch (e) {
    if (e?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Такая категория уже существует' });
    }
    console.error('POST /admin/categories error:', e);
    res.status(500).json({ message: 'Не удалось добавить категорию' });
  }
});

async function listProducts(req, res) {
  try {
    const { category } = req.query;
    const params = [];
    let where = "p.status = 'active'";
    if (category) { where += " AND p.category = ?"; params.push(category); }
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
        COALESCE(NULLIF(TRIM(p.preview_image_url), ''), NULLIF(TRIM(p.image_url), '')) AS preview_image_url,
        p.image_url,
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
app.get('/products', listProducts);
app.get('/api/products', listProducts);

async function isCategoryExists(name) {
  const cat = String(name || '').trim();
  if (!cat) return false;
  const [rows] = await db.query(SQL.select_categories_03, [cat]);
  return rows.length > 0;
}
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
    const preview = preview_image_url?.trim() || null;

    const cat = String(category).trim();
    if (req.user?.role !== 'admin') {
      const exists = await isCategoryExists(cat);
      if (!exists) {
        return res.status(400).json({ message: 'Категория должна существовать. Обратитесь к администратору.' });
      }
    }
    const [result] = await db.query(
      SQL.insert_general_10,
      [req.user.id, title, description || null, p, q, cat, preview]
    );
    const newId = result.insertId;
    const [rows] = await db.query(
      `SELECT
         p.id, p.title, p.description, p.price, p.qty, p.status, p.category, p.created_at,
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
app.post('/products', requireAuth, requireApprovedSeller, createProduct);
app.post('/api/products', requireAuth, requireApprovedSeller, createProduct);
// Upload product images
app.post('/api/products/:id/images', requireAuth, requireApprovedSeller, uploadProductImages.any(), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    console.log('📸 Загрузка изображений для продукта:', productId);
    console.log('📦 Файлы:', req.files?.map(f => f.fieldname));

    if (!productId) return res.status(400).json({ message: 'Invalid product id' });

    const [[product]] = await db.query(`SELECT id, seller_id FROM products WHERE id = ? LIMIT 1`, [productId]);

    if (!product) {
      console.log('❌ Продукт не найден:', productId);
      return res.status(404).json({ message: 'Товар не найден' });
    }

    if (product.seller_id !== req.user.id && req.user.role !== 'admin') {
      console.log('❌ Нет доступа:', req.user.id, 'seller:', product.seller_id);
      return res.status(403).json({ message: 'Нет доступа' });
    }

    const files = req.files || [];
    if (!files.length) {
      console.log('❌ Нет файлов');
      return res.status(400).json({ message: 'Нет файлов' });
    }

    const mainFile = files.find(f => f.fieldname === 'main');
    let main_url = null;

    if (mainFile) {
      main_url = `/uploads/products/${productId}/${mainFile.filename}`;
      console.log('✅ Главное фото:', main_url);

      await db.query(
        `UPDATE products SET image_url = ?, preview_image_url = ?, updated_at = NOW() WHERE id = ?`,
        [main_url, main_url, productId]
      );
    }

    console.log('✅ Изображения загружены успешно');
    res.json({
      ok: true,
      main_url,
      image_url: main_url,
      preview_image_url: main_url,
      main_image_url: main_url
    });
  } catch (e) {
    console.error('❌ POST /api/products/:id/images error:', e);
    res.status(500).json({ message: 'Server error', detail: e.message });
  }
});

// Fallback без /api/
app.post('/products/:id/images', requireAuth, requireApprovedSeller, uploadProductImages.any(), async (req, res) => {
  try {
    const productId = Number(req.params.id);
    console.log('📸 Fallback: Загрузка изображений для продукта:', productId);

    if (!productId) return res.status(400).json({ message: 'Invalid product id' });

    const [[product]] = await db.query(`SELECT id, seller_id FROM products WHERE id = ? LIMIT 1`, [productId]);

    if (!product) return res.status(404).json({ message: 'Товар не найден' });
    if (product.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Нет доступа' });
    }

    const files = req.files || [];
    if (!files.length) return res.status(400).json({ message: 'Нет файлов' });

    const mainFile = files.find(f => f.fieldname === 'main');
    let main_url = null;

    if (mainFile) {
      main_url = `/uploads/products/${productId}/${mainFile.filename}`;
      await db.query(
        `UPDATE products SET image_url = ?, preview_image_url = ?, updated_at = NOW() WHERE id = ?`,
        [main_url, main_url, productId]
      );
    }

    res.json({
      ok: true,
      main_url,
      image_url: main_url,
      preview_image_url: main_url
    });
  } catch (e) {
    console.error('❌ POST /products/:id/images error:', e);
    res.status(500).json({ message: 'Server error', detail: e.message });
  }
});

app.get('/api/my/products', requireAuth, requireApprovedSeller, async (req, res) => {
  try {
    const [rows] = await db.query(
      SQL.select_products,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error('GET /api/my/products error', e);
    res.status(500).json({ message: 'Server error' });
  }
});
app.get('/my/products', requireAuth, requireApprovedSeller, async (req, res) => {
  try {
    const [rows] = await db.query(
      SQL.select_products,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error('GET /my/products error', e);
    res.status(500).json({ message: 'Server error' });
  }
});
app.put('/api/products/:id', requireAuth, requireApprovedSeller, async (req, res) => {
  const { id } = req.params;
  const { title, description, price, qty, category } = req.body || {};
  try {
    const cat = category != null ? String(category).trim() : category;
    if (cat && req.user?.role !== 'admin') {
      const exists = await isCategoryExists(cat);
      if (!exists) {
        return res.status(400).json({ message: 'Категория должна существовать. Обратитесь к администратору.' });
      }
    }
    const [result] = await db.query(
      SQL.update_general_13,
      [title, description, price, qty, cat, id, req.user.id]
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
app.delete('/api/products/:id', requireAuth, requireApprovedSeller, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query(SQL.delete_products, [id, req.user.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Товар не найден' });
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/products/:id error', e);
    res.status(500).json({ message: 'Server error' });
  }
});
app.delete('/admin/products/:id', requireAuth, requireAdmin, async (req, res) => {
  const productId = Number(req.params.id);
  const { reason } = req.body || {};
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ message: 'Укажите причину удаления' });
  }
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      SQL.select_products_02,
      [productId]
    );
    const prod = rows[0];
    if (!prod) { await conn.rollback(); return res.status(404).json({ message: 'Товар не найден' }); }
    await conn.query(
      SQL.insert_general_11,
      [prod.id, prod.seller_id, prod.title, prod.price, prod.category, req.user.id, String(reason).trim()]
    );
    const [delRes] = await conn.query(SQL.delete_products_02, [productId]);
    if (delRes.affectedRows === 0) { await conn.rollback(); return res.status(409).json({ message: 'Не удалось удалить (возможно, уже удалён)' }); }
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
app.get('/admin/product-deletions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
          pd.id, pd.product_id, pd.seller_id,
          u.username AS seller_username, u.first_name AS seller_first_name, u.last_name AS seller_last_name,
          pd.title, pd.price, pd.category, pd.admin_id,
          a.username AS admin_username, a.first_name AS admin_first_name, a.last_name AS admin_last_name,
          pd.reason, pd.created_at
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

/* ===== Recommendations (personalized placeholder) ===== */
app.get('/api/reco/personal', async (req, res) => {
  try {
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit ?? '12', 10)));
    const [rows] = await db.query(
      `
      SELECT
        p.id, p.title, p.price, p.category, p.created_at,
        COALESCE(NULLIF(TRIM(p.preview_image_url), ''), NULLIF(TRIM(p.image_url), '')) AS preview_image_url,
        p.image_url
      FROM products p
      WHERE p.status = 'active'
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ?
      `, [limit]
    );
    res.json({ items: rows || [] });
  } catch (e) {
    console.error('GET /api/reco/personal error', e);
    res.status(500).json({ message: 'Server error' });
  }
});
// ==== SEARCH API (drop this near your other Express routes) ====
// Requires: import mysql from 'mysql2/promise'; (already in your index.js)
// Uses existing 'pool' or 'db' connection – adjust the name if different.

/**
 * GET /api/search/suggest?q=
 * Lightweight suggestions for the header dropdown.
 * Returns: [{id, title}] — top 6 matches by title.
 */
app.get('/api/search/suggest', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return res.json([]);

    const like = '%' + q.replace(/\s+/g, '%') + '%';

    const [rows] = await db.query(
      `SELECT id, title
         FROM products
        WHERE status='active'
          AND (title LIKE ? OR category LIKE ?)
        ORDER BY
          CASE WHEN title LIKE CONCAT(?, '%') THEN 0 ELSE 1 END,  -- prefix boost
          LENGTH(title) ASC,
          id DESC
        LIMIT 6`,
      [like, like, q]
    );

    res.json(rows);
  } catch (e) {
    console.error('suggest error', e);
    res.status(500).json({ error: 'suggest_failed' });
  }
});

/**
 * GET /api/search
 * q: string, page: number (1-based), pageSize: number
 * Returns: { items, total, page, pageSize }
 */
app.get('/api/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
    const offset = (page - 1) * pageSize;

    if (!q) return res.json({ items: [], total: 0, page, pageSize });

    const like = '%' + q.replace(/\s+/g, '%') + '%';

    // Count
    const [[{ cnt }]] = await db.query(
      `SELECT COUNT(*) AS cnt
         FROM products
        WHERE status='active'
          AND (title LIKE ? OR description LIKE ? OR category LIKE ?)`,
      [like, like, like]
    );

    // Page
    const [items] = await db.query(
      `SELECT id, title, price, category, preview_image_url AS preview, image_url
         FROM products
        WHERE status='active'
          AND (title LIKE ? OR description LIKE ? OR category LIKE ?)
        ORDER BY
          CASE WHEN title LIKE CONCAT(?, '%') THEN 0 ELSE 1 END,
          LENGTH(title) ASC,
          id DESC
        LIMIT ? OFFSET ?`,
      [like, like, like, q, pageSize, offset]
    );

    res.json({ items, total: cnt, page, pageSize });
  } catch (e) {
    console.error('search error', e);
    res.status(500).json({ error: 'search_failed' });
  }
});

// Helpful MySQL indexes to run once (in MySQL):
// CREATE INDEX idx_products_status ON products(status);
// CREATE FULLTEXT INDEX ftx_products_title_desc ON products(title, description);  -- optional (MySQL 8+)
// CREATE INDEX idx_products_category ON products(category);
/* ===== Product details & reviews ===== */
app.get('/api/products/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const [rows] = await db.query(
      `
      SELECT
        p.id, p.title, p.description, p.price, p.qty, p.status, p.category, p.created_at,
        p.preview_image_url, p.image_url,
        u.id AS seller_id,
        TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS seller_name,
        COALESCE((SELECT ROUND(AVG(r2.rating), 1) FROM product_reviews r2 WHERE r2.product_id = p.id), 0) AS avg_rating,
        (SELECT COUNT(*) FROM product_reviews r3 WHERE r3.product_id = p.id) AS reviews_count
      FROM products p
      JOIN users u ON u.id = p.seller_id
      WHERE p.id = ?
      LIMIT 1
      `, [id]
    );
    const item = rows[0];
    if (!item) return res.status(404).json({ message: 'Товар не найден' });
    return res.json({ item });
  } catch (e) {
    console.error('GET /api/products/:id error', e);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/products/:id/reviews', async (req, res) => {
  const productId = Number(req.params.id);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit ?? '20', 10)));
  const offset = Math.max(0, parseInt(req.query.offset ?? '0', 10));
  if (!Number.isFinite(productId)) return res.status(400).json({ message: 'Invalid id' });
  try {
    const [rows] = await db.query(
      `
      SELECT
        r.id, r.product_id, r.user_id, r.rating, r.comment, r.created_at, r.updated_at,
        TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS user_name,
        u.username,
        GROUP_CONCAT(ri.url SEPARATOR '||') AS images_csv
      FROM product_reviews r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN review_images ri ON ri.review_id = r.id
      WHERE r.product_id = ?
      GROUP BY r.id
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ? OFFSET ?`,
      [productId, limit, offset]
    );
    const items = (rows || []).map(r => ({
      ...r,
      images: r.images_csv ? r.images_csv.split('||') : []
    }));
    res.json({ items, limit, offset });
  } catch (e) {
    console.error('GET /api/products/:id/reviews error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// multipart: rating, comment, is_anonymous + images[]
app.post('/api/products/:id/reviews', requireAuth, uploadReviews.array('images[]', 3), async (req, res) => {
  const productId = Number(req.params.id);
  let { rating, comment } = req.body || {};
  if (!Number.isFinite(productId)) return res.status(400).json({ message: 'Invalid id' });
  rating = parseInt(rating, 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'rating должен быть целым числом 1–5' });
  }
  comment = (comment ?? '').toString().trim() || null;

  try {
    // 1) сохраняем/обновляем сам отзыв (используй свой запрос, если хочешь)
    await db.query(
      `
      INSERT INTO product_reviews (product_id, user_id, rating, comment)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), updated_at = CURRENT_TIMESTAMP
      `,
      [productId, req.user.id, rating, comment]
    );

    // 2) берём актуальную запись отзыва пользователя по этому товару
    const [[review]] = await db.query(
      `SELECT * FROM product_reviews WHERE product_id = ? AND user_id = ? ORDER BY updated_at DESC, id DESC LIMIT 1`,
      [productId, req.user.id]
    );

    // 3) если пришли файлы — докладываем в review_images
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length) {
      const values = files.map(f => [review.id, `/uploads/reviews/${f.filename}`]);
      await db.query(`INSERT INTO review_images (review_id, url) VALUES ?`, [values]);
    }

    // 4) отдаём отзыв с прикреплёнными картинками
    const [[row]] = await db.query(
      `
      SELECT
        r.*, GROUP_CONCAT(ri.url SEPARATOR '||') AS images_csv
      FROM product_reviews r
      LEFT JOIN review_images ri ON ri.review_id = r.id
      WHERE r.id = ?
      GROUP BY r.id
      `, [review.id]
    );
    const item = row ? { ...row, images: row.images_csv ? row.images_csv.split('||') : [] } : review;

    return res.status(201).json({ item });
  } catch (e) {
    console.error('POST /api/products/:id/reviews error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ===== Cart & Checkout ===== */
app.get('/api/cart', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT ci.product_id, ci.qty, p.title, p.price, p.preview_image_url, p.image_url
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.user_id = ?
      ORDER BY ci.updated_at DESC, ci.id DESC`,
      [req.user.id]
    );
    res.json({ items: rows || [] });
  } catch (e) {
    console.error('GET /api/cart error', e);
    res.status(500).json({ message: 'Server error' });
  }
});
app.post('/api/cart', requireAuth, async (req, res) => {
  let { product_id, qty } = req.body || {};
  const pid = Number(product_id);
  const q = Math.max(1, parseInt(qty ?? '1', 10));
  if (!Number.isFinite(pid)) return res.status(400).json({ message: 'Invalid product_id' });
  try {
    await db.query(
      SQL.insert_general_13,
      [req.user.id, pid, q]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error('POST /api/cart error', e);
    res.status(500).json({ message: 'Server error' });
  }
});
app.patch('/api/cart/:productId', requireAuth, async (req, res) => {
  const pid = Number(req.params.productId);
  const q = parseInt((req.body || {}).qty, 10);
  if (!Number.isFinite(pid)) return res.status(400).json({ message: 'Invalid id' });
  try {
    if (!Number.isInteger(q) || q <= 0) {
      await db.query(SQL.delete_cart_items, [req.user.id, pid]);
      return res.json({ ok: true, removed: true });
    }
    await db.query(SQL.update_general_14, [q, req.user.id, pid]);
    res.json({ ok: true });
  } catch (e) {
    console.error('PATCH /api/cart/:productId error', e);
    res.status(500).json({ message: 'Server error' });
  }
});
app.delete('/api/cart/:productId', requireAuth, async (req, res) => {
  const pid = Number(req.params.productId);
  if (!Number.isFinite(pid)) return res.status(400).json({ message: 'Invalid id' });
  try {
    await db.query(SQL.delete_cart_items, [req.user.id, pid]);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/cart/:productId error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

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
    const [cart] = await db.query(
      SQL.select_cart_items_02, [req.user.id]
    );
    if (!cart || cart.length === 0) {
      return res.status(400).json({ message: 'Корзина пуста' });
    }
    const total = cart.reduce((s, row) => s + Number(row.price) * Number(row.qty), 0);
    const [insOrder] = await db.query(SQL.insert_general_14,
      [req.user.id, total.toFixed(2)]
    );
    const orderId = insOrder.insertId;
    const values = cart.map(r => [orderId, r.product_id, r.qty, r.price]);
    await db.query(SQL.insert_general_15, [values]);
    await db.query(SQL.insert_general_16,
      [orderId, country, city, street, postal]
    );
    const cardNumber = (payment?.cardNumber || '').replace(/\s+/g, '');
    const exp = (payment?.exp || '').trim();
    const cvc = (payment?.cvc || '').trim();
    const luhnOk = /^[0-9]{12,19}$/.test(cardNumber) && luhn(cardNumber);
    if (!luhnOk || !/^\d{2}\/\d{2}$/.test(exp) || !/^\d{3,4}$/.test(cvc)) {
      return res.status(400).json({ message: 'Некорректные карточные данные (демо-валидация)' });
    }
    const last4 = cardNumber.slice(-4);
    const brand = detectBrand(cardNumber);
    await db.query(SQL.update_general_15, [orderId]);
    await db.query(SQL.insert_general_17,
      [orderId, brand, last4]
    );
    await db.query(SQL.delete_cart_items_02, [req.user.id]);
    res.status(201).json({ ok: true, order_id: orderId, total, brand, last4 });
  } catch (e) {
    console.error('POST /api/checkout error', e);
    res.status(500).json({ message: 'Server error' });
  }
});
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

/* ===== Users: last_seen column ===== */
(async () => {
  try {
    const [c1] = await db.query("SHOW COLUMNS FROM users LIKE 'last_seen_at'");
    if (!c1.length) {
      await db.query(SQL.alter_general_07);
      console.log('✅ added users.last_seen_at');
    }
  } catch (e) { console.error('ensure last_seen_at error:', e.message || e); }
})();

/* ===== Chat schema (minimal ensure) ===== */
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

/* ===== Public user profile ===== */
app.get('/api/users/:id/public', async (req, res) => {
  const userId = Number(req.params.id);
  try {
    const [rows] = await db.query(
      SQL.select_users_14, [userId]
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    const u = rows[0];
    const [[r1]] = await db.query(SQL.select_product_reviews_03, [userId]);
    const [[r2]] = await db.query(SQL.select_order_items, [userId]);
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
      createdAt: u.created_at // <<< добавили дату регистрации
    });
  } catch (e) {
    console.error('GET /api/users/:id/public error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/products/:id/images - загрузка изображений товара
app.post('/api/products/:id/images',
  requireAuth,
  requireApprovedSeller,
  uploadProductImages.any(),
  async (req, res) => {
    try {
      const productId = Number(req.params.id);
      if (!productId) return res.status(400).json({ message: 'Invalid product id' });

      // Проверяем, что продукт принадлежит текущему пользователю
      const [[product]] = await db.query(
        `SELECT id, seller_id FROM products WHERE id = ? LIMIT 1`,
        [productId]
      );

      if (!product) {
        return res.status(404).json({ message: 'Товар не найден' });
      }

      if (product.seller_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Нет доступа к этому товару' });
      }

      const files = req.files || [];
      if (!files.length) {
        return res.status(400).json({ message: 'Не загружено ни одного файла' });
      }

      // Формируем URLs загруженных файлов
      const mainFile = files.find(f => f.fieldname === 'main');
      const thumbFiles = files.filter(f => f.fieldname.startsWith('thumb'));

      let main_url = null;
      const thumb_urls = [];

      if (mainFile) {
        main_url = `/uploads/products/${productId}/${mainFile.filename}`;
      }

      thumbFiles.forEach(f => {
        thumb_urls.push(`/uploads/products/${productId}/${f.filename}`);
      });

      // Обновляем продукт с главным изображением
      if (main_url) {
        await db.query(
          `UPDATE products 
           SET image_url = ?, 
               preview_image_url = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [main_url, main_url, productId]
        );
      }

      // Возвращаем URLs для фронтенда
      res.json({
        ok: true,
        main_url,
        main_image_url: main_url,
        image_url: main_url,
        preview_image_url: main_url,
        thumb_urls,
        images: [main_url, ...thumb_urls].filter(Boolean)
      });
    } catch (e) {
      console.error('POST /api/products/:id/images error:', e);
      res.status(500).json({ message: 'Server error', detail: e.message });
    }
  }
);

// Альтернативный путь без /api/ (на случай fallback)
app.post('/products/:id/images',
  requireAuth,
  requireApprovedSeller,
  uploadProductImages.any(),
  async (req, res) => {
    req.url = `/api${req.url}`;
    app.handle(req, res);
  }
);
/* ===== Image proxy (CORS bypass for product images) ===== */
const _fetch = (typeof fetch === 'function') ? fetch : ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));
app.get('/api/proxy-img', async (req, res) => {
  const url = req.query.u;
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).send('Bad image url');
  try {
    const r = await _fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QontoBot/1.0)',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': ''
      }
    });
    if (!r.ok) return res.status(r.status).end();
    const ct = (r.headers.get && r.headers.get('content-type')) || 'image/jpeg';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    if (r.body && r.body.pipe) { r.body.pipe(res); }
    else { const buf = Buffer.from(await r.arrayBuffer()); res.end(buf); }
  } catch (e) { res.status(502).send('Image fetch failed'); }
});

// POST /seller/apply/step
// multipart/form-data (FormData) — по step сохраняем куски + файлы
app.post('/seller/apply/step', requireAuth, upload.any(), async (req, res) => {
  const userId = req.user.id;
  const step = Number(req.body.step || 1);

  // загрузки файлов → верни URL (сохрани в /uploads, s3, что угодно)
  const byField = Object.fromEntries((req.files || []).map(f => [f.fieldname, '/uploads/' + f.filename]));

  // собери значения для upsert
  const vals = {
    user_id: userId,
    step,
    status: 'draft',
    shop_name: req.body.shop_name || '',
    country: req.body.country || '',
    shipping_address: req.body.shipping_address || '',
    city: req.body.city || '',
    zip: req.body.zip || '',
    reg_type: req.body.reg_type || 'company',
    doc_company_extract_url: byField.doc_company_extract || null,
    doc_company_itn_url: byField.doc_company_itn || null,
    doc_individual_passport_url: byField.doc_individual_passport || null,
    doc_individual_itn_url: byField.doc_individual_itn || null,
    company_full_name: req.body.company_full_name || '',
    edrpou: req.body.edrpou || '',
    iban: req.body.iban || ''
  };

  await db.exec('upsert_seller_application_step', [
    vals.user_id, vals.step, vals.status, vals.shop_name,
    vals.country, vals.shipping_address, vals.city, vals.zip, vals.reg_type,
    vals.doc_company_extract_url, vals.doc_company_itn_url,
    vals.doc_individual_passport_url, vals.doc_individual_itn_url,
    vals.company_full_name, vals.edrpou, vals.iban
  ]);

  // step 5: карта (разбираем и сохраняем safe поля)
  if (step === 5) {
    const raw = String(req.body.card_number || '').replace(/\s+/g, '');
    const brand = raw.startsWith('4') ? 'visa' :
      raw.startsWith('5') ? 'mastercard' : 'card';
    const last4 = raw.slice(-4);
    const [mm, yy] = String(req.body.card_exp || '').split('/');
    const holder = String(req.body.card_holder || '').trim();

    // тут можешь токенизировать у провайдера и получить token
    const token = null;
    await db.exec('insert_user_card', [
      userId, brand, last4, Number(mm || 0), Number('20' + (yy || '00')),
      holder, token, userId // последний параметр для подзапроса is_default
    ]);
  }

  // step 6: пароль (если надо — проверь и обнови users.password_hash),
  // у тебя уже есть SQL на апдейт пароля; можешь сравнить/валидировать.

  res.json({ ok: true });
});

// POST /seller/apply/submit
app.post('/seller/apply/submit', requireAuth, async (req, res) => {
  const userId = req.user.id;
  await db.exec('update_seller_application_submit', [userId]);
  // статус юзера → pending
  await db.execRaw('UPDATE users SET seller_status="pending" WHERE id=?', [userId]);
  res.json({ ok: true });
});

/* ===== Chat (OpenRouter proxy) ===== */
/* ===== Chat (DB-first, AI-fallback) ===== */
app.post('/api/chat', async (req, res) => {
  const userMessage = String(req.body?.message || '');
  try {
    // 1) Спочатку пробуємо знайти товари у БД
    const filters = parseProductQuery(userMessage);
    const items = await searchProductsDB(filters);

    if (items.length) {
      return res.json({
        title: 'Знайдені товари',
        products: items,
        used: {
          brand: filters.brand, minPrice: filters.minPrice, maxPrice: filters.maxPrice,
          category: filters.category, sort: filters.sort, terms: filters.terms
        }
      });
    }

    // 2) Якщо товарів нема — відповідаємо текстом (OpenRouter або заглушка)
    const PRIMARY_MODEL = OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free';
    const FALLBACK_MODELS = ['meta-llama/llama-3.1-8b-instruct:free', 'openrouter/auto'];
    let systemContext = 'Ти ввічливий AI-помічник інтернет-магазину. Якщо просять товар — поясни, що не знайдено і порадь уточнити бренд, категорію або бюджет.';
    if (req.user) systemContext += ` Користувач: ${req.user.username} (${req.user.email}).`;

    if (!OPENROUTER_API_KEY) {
      // без ключа — проста відповідь
      return res.json({
        reply: 'Не зміг знайти товари за запитом. Спробуйте вказати бренд, категорію або бюджет (наприклад: "чайник Bosch до 1500 грн").',
        model: 'local-fallback'
      });
    }

    async function callModel(model) {
      const { data } = await axios.post(
        `${OPENROUTER_BASE_URL}/chat/completions`,
        { model, messages: [{ role: 'system', content: systemContext }, { role: 'user', content: userMessage }], temperature: 0.6 },
        { headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': OPENROUTER_SITE_URL, 'X-Title': OPENROUTER_TITLE } }
      );
      const aiReply = data?.choices?.[0]?.message?.content || 'Порожня відповідь.';
      return { aiReply, usedModel: model };
    }

    try { const r = await callModel(PRIMARY_MODEL); return res.json({ reply: r.aiReply, model: r.usedModel }); }
    catch (e) {
      const s = e.response?.status;
      if (![401,402,403].includes(s)) throw e;
      for (const m of FALLBACK_MODELS) {
        try { const r2 = await callModel(m); return res.json({ reply: r2.aiReply, model: r2.usedModel }); } catch {}
      }
      return res.status(503).json({ error: 'AI недоступний для поточного ключа/моделі.' });
    }
  } catch (error) {
    console.error('API /api/chat error:', error?.response?.data || error);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ===== Launch ===== */
const PORT = process.env.PORT || 5050;
app.post('/api/me/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const url = `/uploads/avatars/${req.file.filename}`;
    await db.query(SQL.update_general_16, [url, req.user.id]);
    res.json({ url });
  } catch (e) {
    console.error('avatar upload error:', e);
    res.status(500).json({ error: 'Failed to save avatar' });
  }
});
server.listen(PORT, () => {
  console.log(`✅ Сервер + Socket.IO на http://localhost:${PORT}`);
});
/* ===== Seller application ===== */
(async () => {
  try {
    // Новая таблица с полями для 6 шагов и статусами pending/approved/rejected
    await db.query(`
      CREATE TABLE IF NOT EXISTS seller_applications (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL UNIQUE,
        -- прогресс мастера
        step TINYINT NOT NULL DEFAULT 1,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',

        -- step 1
        shop_name VARCHAR(255) NULL,

        -- step 2
        country VARCHAR(100) NULL,
        shipping_address VARCHAR(255) NULL,
        city VARCHAR(120) NULL,
        zip VARCHAR(20) NULL,

        -- step 3
        reg_type ENUM('company','individual') DEFAULT 'company',
        doc_company_extract_url VARCHAR(512) NULL,
        doc_company_itn_url VARCHAR(512) NULL,
        doc_individual_passport_url VARCHAR(512) NULL,
        doc_individual_itn_url VARCHAR(512) NULL,

        -- step 4
        company_full_name VARCHAR(255) NULL,
        edrpou VARCHAR(32) NULL,
        iban VARCHAR(64) NULL,

        -- step 5
        payout_card_id INT NULL,

        -- аудит
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

        PRIMARY KEY (id),
        CONSTRAINT fk_seller_app_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_seller_app_shop (shop_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ seller_applications ready (multi-step, pending/approved/rejected)');
  } catch (e) {
    console.error('ensure seller_applications error:', e?.message || e);
  }
})();

// Старый одношаговый эндпоинт (если где-то ещё вызывается) — оставляем как есть
app.post('/seller/apply', requireAuth, async (req, res) => {
  try {
    let { company_name, tax_id, price_list_url, comment } = req.body || {};
    company_name = String(company_name || '').trim();
    tax_id = String(tax_id || '').trim();
    price_list_url = String(price_list_url || '').trim() || null;
    comment = String(comment || '').trim() || null;

    if (!company_name || !tax_id) {
      return res.status(400).json({ message: 'company_name и tax_id обязательны' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `
        INSERT INTO seller_applications (user_id, status, company_full_name, edrpou, price_list_url)
        VALUES (?, 'pending', ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          status='pending',
          company_full_name=VALUES(company_full_name),
          edrpou=VALUES(edrpou),
          price_list_url=VALUES(price_list_url),
          updated_at=NOW()
        `,
        [req.user.id, company_name, tax_id, price_list_url]
      );

      // статус пользователя -> pending (как у тебя было)
      await conn.query(
        `UPDATE users SET seller_status='pending', updated_at=NOW() WHERE id=?`,
        [req.user.id]
      );

      await conn.commit();
      return res.status(201).json({ ok: true });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('POST /seller/apply error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

/* 1) Проверка уникальности названия */
app.post('/api/seller/apply/validate-name', requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.shop_name || '').trim();
    if (!name) return res.status(400).json({ message: 'shop_name required' });
    const [r] = await db.query(`SELECT 1 FROM seller_applications WHERE shop_name=? LIMIT 1`, [name]);
    if (r.length) return res.status(409).json({ message: 'Назва зайнята' });
    return res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});

/* 2) Сохранение шага (upsert) — НЕ трогаем status вообще */
app.post('/api/seller/apply/save-step', requireAuth, async (req, res) => {
  try {
    const p = req.body || {};
    const values = {
      user_id: req.user.id,
      step: Math.max(1, Math.min(5, parseInt(p.step || '1', 10))),
      shop_name: (p.shop_name || null),
      country: (p.country || null),
      shipping_address: (p.shipping_address || null),
      city: (p.city || null),
      zip: (p.zip || null),
      reg_type: (p.reg_type === 'individual' ? 'individual' : 'company'),
      doc_company_extract_url: p.doc_company_extract_url || null,
      doc_company_itn_url: p.doc_company_itn_url || null,
      doc_individual_passport_url: p.doc_individual_passport_url || null,
      doc_individual_itn_url: p.doc_individual_itn_url || null,
      company_full_name: p.company_full_name || null,
      edrpou: p.edrpou || null,
      iban: p.iban || null,
      payout_card_id: p.payout_card_id || null
    };

    await db.query(`
      INSERT INTO seller_applications
        (user_id, step, shop_name,
         country, shipping_address, city, zip, reg_type,
         doc_company_extract_url, doc_company_itn_url,
         doc_individual_passport_url, doc_individual_itn_url,
         company_full_name, edrpou, iban, payout_card_id)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        step=VALUES(step),
        shop_name=COALESCE(VALUES(shop_name), shop_name),
        country=COALESCE(VALUES(country), country),
        shipping_address=COALESCE(VALUES(shipping_address), shipping_address),
        city=COALESCE(VALUES(city), city),
        zip=COALESCE(VALUES(zip), zip),
        reg_type=COALESCE(VALUES(reg_type), reg_type),
        doc_company_extract_url=COALESCE(VALUES(doc_company_extract_url), doc_company_extract_url),
        doc_company_itn_url=COALESCE(VALUES(doc_company_itn_url), doc_company_itn_url),
        doc_individual_passport_url=COALESCE(VALUES(doc_individual_passport_url), doc_individual_passport_url),
        doc_individual_itn_url=COALESCE(VALUES(doc_individual_itn_url), doc_individual_itn_url),
        company_full_name=COALESCE(VALUES(company_full_name), company_full_name),
        edrpou=COALESCE(VALUES(edrpou), edrpou),
        iban=COALESCE(VALUES(iban), iban),
        payout_card_id=COALESCE(VALUES(payout_card_id), payout_card_id),
        updated_at=NOW()
    `, [
      values.user_id, values.step, values.shop_name,
      values.country, values.shipping_address, values.city, values.zip, values.reg_type,
      values.doc_company_extract_url, values.doc_company_itn_url,
      values.doc_individual_passport_url, values.doc_individual_itn_url,
      values.company_full_name, values.edrpou, values.iban, values.payout_card_id
    ]);

    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});

/* 3) Сабмит — ставим 'pending' (он есть в твоём ENUM) */
app.post('/api/seller/apply/submit', requireAuth, async (req, res) => {
  const conn = await db.getConnection();
  try {
    const payout_card_id = req.body?.payout_card_id ?? null;
    await conn.beginTransaction();

    const [[row]] = await conn.query(`SELECT * FROM seller_applications WHERE user_id=? LIMIT 1`, [req.user.id]);
    if (!row) { await conn.rollback(); return res.status(400).json({ message: 'Чернетки не знайдено' }); }
    if (!row.shop_name || !row.country || !row.shipping_address || !row.city || !row.zip ||
      !row.company_full_name || !row.edrpou || !row.iban) {
      await conn.rollback(); return res.status(400).json({ message: 'Заповніть усі обовʼязкові поля' });
    }

    if (payout_card_id != null) {
      const [[c]] = await conn.query(`SELECT id FROM user_cards WHERE id=? AND user_id=?`, [payout_card_id, req.user.id]);
      if (!c) { await conn.rollback(); return res.status(400).json({ message: 'Картка не знайдена' }); }
    }

    // ВАЖНО: 'pending' вместо 'submitted'
    await conn.query(
      `UPDATE seller_applications
         SET status='pending', step=5, payout_card_id=?, updated_at=NOW()
       WHERE user_id=?`,
      [payout_card_id, req.user.id]
    );

    await conn.query(`UPDATE users SET seller_status='pending', updated_at=NOW() WHERE id=?`, [req.user.id]);

    await conn.commit();
    res.json({ ok: true });
  } catch (e) { await conn.rollback(); console.error(e); res.status(500).json({ message: 'Server error' }); }
  finally { conn.release(); }
});

/* 4) Картки користувача */
app.get('/api/me/cards', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id,brand,last4,exp_month,exp_year,holder_name
         FROM user_cards
        WHERE user_id=?
        ORDER BY id DESC`,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});

app.post('/api/me/cards', requireAuth, async (req, res) => {
  try {
    const [cnt] = await db.query(`SELECT COUNT(*) c FROM user_cards WHERE user_id=?`, [req.user.id]);
    if ((cnt?.[0]?.c || 0) >= 2) return res.status(400).json({ message: 'Максимум 2 картки' });

    const number = String(req.body?.number || '').replace(/\s+/g, '');
    const exp = String(req.body?.exp || '');
    const cvc = String(req.body?.cvc || '');
    const holder = String(req.body?.holder_name || '').trim();

    if (!/^\d{12,19}$/.test(number) || !luhn(number)) return res.status(400).json({ message: 'Некоректний номер картки' });
    if (!/^\d{2}\/\d{2}$/.test(exp)) return res.status(400).json({ message: 'Некоректний термін' });
    if (!/^\d{3,4}$/.test(cvc)) return res.status(400).json({ message: 'Некоректний CVC' });
    if (!holder) return res.status(400).json({ message: 'Вкажіть власника' });

    const [mm, yy] = exp.split('/').map(x => parseInt(x, 10));
    const brand = detectBrand(number);
    const last4 = number.slice(-4);

    await db.query(
      `INSERT INTO user_cards (user_id,brand,last4,exp_month,exp_year,holder_name,token)
       VALUES (?,?,?,?,?,?,NULL)`,
      [req.user.id, brand, last4, mm, 2000 + yy, holder]
    );
    res.status(201).json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ message: 'Server error' }); }
});

/* ===== Ensure wishlist schema ===== */
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS wishlist_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_product (user_id, product_id),
        INDEX idx_user (user_id),
        INDEX idx_product (product_id),
        CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ wishlist_items table ensured');
  } catch (e) {
    console.error('ensure wishlist schema error:', e.message || e);
  }
})();

  /* ===== AI product search helpers ===== */
function _toNumberUA(s = '') {
  // "1 599", "1,599.00", "1.599,00" → 1599
  const clean = String(s).replace(/\s+/g, '').replace(/,/g, '.');
  const m = clean.match(/(\d+(?:\.\d+)?)/);
  return m ? Math.round(parseFloat(m[1])) : null;
}

function parseProductQuery(raw = '') {
  const text = String(raw || '').toLowerCase();

  // бренд (простий словник; можна доповнювати)
  const brandList = ['bosch','philips','braun','tefal','xiaomi','samsung','apple','asus','makita','tramontina','lenovo','hp','acer'];
  let brand = null;
  for (const b of brandList) { if (text.includes(b)) { brand = b; break; } }

  // «дешевше» → сортування за ціною зростання
  const sort =
    /(дешев|cheap|дешевші|бюджет)/.test(text) ? 'price_asc' :
    /(дорог|преміум)/.test(text) ? 'price_desc' :
    'new';

  // ціна: "до 1500", "від 500 до 1200", "≤ 1000", ">= 3000"
  let minPrice = null, maxPrice = null;
  const between = text.match(/(?:від|з)\s*([\d\s.,]+)\s*(?:uah|грн|₴)?\s*(?:до|по|-|—)\s*([\d\s.,]+)/i);
  if (between) {
    minPrice = _toNumberUA(between[1]);
    maxPrice = _toNumberUA(between[2]);
  } else {
    const maxM = text.match(/(?:до|не\s*дорожче|≤|<=)\s*([\d\s.,]+)\s*(?:uah|грн|₴)?/i);
    const minM = text.match(/(?:від|не\s*менше|≥|>=)\s*([\d\s.,]+)\s*(?:uah|грн|₴)?/i);
    if (maxM) maxPrice = _toNumberUA(maxM[1]);
    if (minM) minPrice = _toNumberUA(minM[1]);
  }

  // ймовірна категорія (проста евристика — можна мапити на ваші реальні)
  let category = null;
  if (/чайник|kettle/.test(text)) category = 'Чайники';
  if (/блендер|blender/.test(text)) category = 'Блендери';
  if (/сковород|pan/.test(text)) category = 'Сковороди';

  // терми для LIKE
  const terms = text
    .replace(/[^\p{L}\p{N}\s-]+/giu, ' ')
    .split(/\s+/).filter(t => t.length > 1 && !brandList.includes(t))
    .slice(0, 6);

  return { brand, sort, minPrice, maxPrice, category, terms, limit: 12 };
}

async function searchProductsDB(filters) {
  const {
    brand, sort = 'new', minPrice, maxPrice, category, terms = [], limit = 12
  } = filters || {};

  const where = [`p.status = 'active'`];
  const params = [];

  if (category) { where.push(`p.category = ?`); params.push(category); }

  if (brand) { where.push(`LOWER(p.title) LIKE ?`); params.push(`%${brand}%`); }

  if (terms.length) {
    const like = `%${terms.join('%')}%`;
    where.push(`(p.title LIKE ? OR p.description LIKE ? OR p.category LIKE ?)`);
    params.push(like, like, like);
  }

  if (minPrice != null) { where.push(`p.price >= ?`); params.push(minPrice); }
  if (maxPrice != null) { where.push(`p.price <= ?`); params.push(maxPrice); }

  let orderBy = `p.created_at DESC, p.id DESC`;
  if (sort === 'price_asc') orderBy = `p.price ASC, p.id DESC`;
  if (sort === 'price_desc') orderBy = `p.price DESC, p.id DESC`;

  const sql = `
    SELECT
      p.id, p.title, p.price, p.category,
      COALESCE(NULLIF(TRIM(p.preview_image_url), ''), NULLIF(TRIM(p.image_url), '')) AS preview_image_url
    FROM products p
    WHERE ${where.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT ?
  `;
  params.push(limit);

  const [rows] = await db.query(sql, params);
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    price: Number(r.price),
    brand: brand || '', // можна витягати з title регуляркою, якщо треба
    image: r.preview_image_url || null
  }));
}


/* ===== Seller's products (public) ===== */
app.get('/api/sellers/:id/products', async (req, res) => {
  try {
    const sellerId = Number(req.params.id);
    if (!Number.isFinite(sellerId)) return res.status(400).json({ message: 'Invalid seller id' });
    const [rows] = await db.query(
      `
      SELECT
        p.id, p.title, p.description, p.price, p.qty, p.status, p.category, p.created_at,
        COALESCE(NULLIF(TRIM(p.preview_image_url), ''), NULLIF(TRIM(p.image_url), '')) AS preview_image_url,
        p.image_url,
        COALESCE((SELECT ROUND(AVG(r2.rating), 1) FROM product_reviews r2 WHERE r2.product_id = p.id), 0) AS avg_rating
      FROM products p
      WHERE p.status = 'active' AND p.seller_id = ?
      ORDER BY p.created_at DESC, p.id DESC
      `, [sellerId]
    );
    res.json({ items: rows || [] });
  } catch (e) {
    console.error('GET /api/sellers/:id/products error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

/* ===== Wishlist schema + endpoints (toggle) ===== */
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS wishlist_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_product (user_id, product_id),
        INDEX idx_user (user_id),
        INDEX idx_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ wishlist_items ready');
  } catch (e) { console.error('wishlist ensure error', e.message || e); }
})();

app.get('/api/wishlist', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT product_id FROM wishlist_items WHERE user_id = ? ORDER BY id DESC`, [req.user.id]);
    res.json({ items: rows.map(r => r.product_id) });
  } catch (e) { console.error('GET /api/wishlist', e); res.status(500).json({ message: 'Server error' }); }
});
app.post('/api/wishlist', requireAuth, async (req, res) => {
  try {
    const pid = Number(req.body?.product_id);
    if (!pid) return res.status(400).json({ message: 'Invalid product_id' });
    const [[ex]] = await db.query(`SELECT id FROM wishlist_items WHERE user_id=? AND product_id=? LIMIT 1`, [req.user.id, pid]);
    if (ex) { await db.query(`DELETE FROM wishlist_items WHERE id=?`, [ex.id]); return res.json({ ok: true, removed: true, product_id: pid }); }
    await db.query(`INSERT INTO wishlist_items (user_id, product_id) VALUES (?, ?)`, [req.user.id, pid]);
    res.status(201).json({ ok: true, added: true, product_id: pid });
  } catch (e) { console.error('POST /api/wishlist', e); res.status(500).json({ message: 'Server error' }); }
});

// Ensure review_images table (stores urls of review pictures)
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS review_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        review_id INT NOT NULL,
        url VARCHAR(512) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_review (review_id),
        CONSTRAINT fk_review_images_review FOREIGN KEY (review_id) REFERENCES product_reviews(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ review_images table ensured');
  } catch (e) {
    console.error('ensure review_images error:', e?.message || e);
  }
})();

/* ===== Fallback seller products endpoint (if not present) ===== */
try {
  if (!app._router.stack.some(l => l.route && l.route.path === '/api/sellers/:id/products')) {
    app.get('/api/sellers/:id/products', async (req, res) => {
      try {
        const sellerId = Number(req.params.id);
        if (!sellerId) return res.status(400).json({ message: 'Invalid seller id' });
        const [rows] = await db.query(
          `SELECT
             p.id, p.title, p.description, p.price, p.qty, p.status, p.category, p.created_at,
             p.preview_image_url, p.image_url,
             COALESCE((SELECT ROUND(AVG(r2.rating),1) FROM product_reviews r2 WHERE r2.product_id = p.id), 0) AS avg_rating
           FROM products p
           WHERE p.status='active' AND p.seller_id=?
           ORDER BY p.created_at DESC, p.id DESC`,
          [sellerId]
        );
        res.json({ items: rows || [] });
      } catch (e) { console.error('GET /api/sellers/:id/products', e); res.status(500).json({ message: 'Server error' }); }
    });
  }
} catch { }

// index.js (server) — добавить маршрут смены пароля
app.post('/api/me/change-password', async (req, res) => {
  try {
    // 1) получаем юзера из сессии/JWT
    const userId = req.user?.id || req.auth?.id || req.session?.user?.id;
    if (!userId) return res.status(401).json({ message: 'Not authenticated' });

    // 2) валидируем вход
    const { new_password } = req.body || {};
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ message: 'Пароль закороткий' });
    }

    // 3) хэш и апдейт
    const hash = await bcrypt.hash(new_password, 10);
    await db.execute('UPDATE users SET password_hash=? WHERE id=?', [hash, userId]);

    // 4) done
    res.json({ ok: true });
  } catch (e) {
    console.error('change-password error:', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// ===== GEO SUGGEST BACKEND =====
// Подсказки стран/городов + автоиндекс через Nominatim (OSM)
// (ВНИМАНИЕ: здесь НЕТ повторных import — они уже есть вверху файла)

// --- автоопределение языка: если в запросе есть кириллица → 'uk', иначе 'en'
function detectLang(input = "") {
  const s = String(input || "");
  if (/[\u0400-\u04FF]/.test(s)) return "uk";
  if (/[A-Za-z]/.test(s)) return "en";
  return "uk";
}

// Украинская транслитерация для префиксного матчинга (ха → kha)
function uaTranslitPrefix(s = "") {
  const map = {
    "а": "a", "б": "b", "в": "v", "г": "h", "ґ": "g", "д": "d", "е": "e", "є": "ye", "ж": "zh", "з": "z",
    "и": "y", "і": "i", "ї": "yi", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p",
    "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
    "ю": "yu", "я": "ya", "ь": "", "’": "", "'": ""
  };
  const lower = (s || "").toLowerCase();
  let out = "";
  for (const ch of lower) out += map[ch] !== undefined ? map[ch] : ch;
  return out;
}
function norm(s = "") {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

// ===== простой in-memory кэш (по умолчанию 10 минут)
const _cache = new Map(); // key -> { ts, ttl, data }
function cacheGet(key) {
  const v = _cache.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > (v.ttl || 600000)) { _cache.delete(key); return null; }
  return v.data;
}
function cacheSet(key, data, ttl = 600000) {
  _cache.set(key, { ts: Date.now(), ttl, data });
}

// ====== СТРАНЫ ======
app.get("/api/geo/countries", (req, res) => {
  const q = String(req.query.query || "").trim();
  let lang = String(req.query.lang || "auto");
  if (lang === "auto") lang = detectLang(q);

  const cacheKey = `countries|${lang}|${q}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  const all = CSCountry.getAllCountries().map(c => {
    const local = countriesLib.getName(c.isoCode, lang) || c.name;
    return { code: c.isoCode, name: c.name, localName: local, label: local };
  });

  let list = all;
  if (q) {
    const nq = norm(q);
    const qlat = uaTranslitPrefix(nq);
    list = all.filter(c => {
      const a = norm(c.localName || "");
      const b = norm(c.name || "");
      return a.startsWith(nq) || b.startsWith(nq) || a.startsWith(qlat) || b.startsWith(qlat);
    });
  }

  const out = list.slice(0, 50);
  cacheSet(cacheKey, out);
  res.json(out);
});

// ====== ГОРОДА ======
app.get('/api/geo/cities', async (req, res) => {
  const code = String(req.query.country || '').toUpperCase();
  const cname = String(req.query.countryName || '');
  const qRaw = String(req.query.query || '').trim();
  let lang = String(req.query.lang || 'auto');

  const isCyr = (s = '') => /[\u0400-\u04FF]/.test(s);
  const norm = (s = '') =>
    String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // авто-язык как и раньше
  if (lang === 'auto') lang = isCyr(qRaw) ? 'uk' : 'en';

  // резолв кода страны (по EN/UА названию)
  let countryCode = code;
  if (!countryCode && cname) {
    const found = CSCountry.getAllCountries().find(
      c => norm(c.name) === norm(cname) ||
        norm(countriesLib.getName(c.isoCode, 'uk') || '') === norm(cname)
    );
    countryCode = found?.isoCode || '';
  }
  if (!countryCode) return res.json([]);

  // --- умный трансліт UА->EN (позиционно)
  function uaToLatSmart(s = '') {
    const lower = String(s || '').toLowerCase();
    let out = '';
    for (let i = 0; i < lower.length; i++) {
      const ch = lower[i];
      const atStart = i === 0 || /[^a-zа-яёіїєґ']/i.test(lower[i - 1]) || lower[i - 1] === "'";
      if (ch === 'є') out += atStart ? 'ye' : 'ie';
      else if (ch === 'ї') out += atStart ? 'yi' : 'i';
      else if (ch === 'ю') out += atStart ? 'yu' : 'iu';
      else if (ch === 'я') out += atStart ? 'ya' : 'ia';
      else {
        const m = {
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'ж': 'zh', 'з': 'z',
          'и': 'y', 'і': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p',
          'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
          'ь': '', '’': '', "'": ''
        };
        out += (m[ch] ?? ch);
      }
    }
    return out;
  }

  // --- RU -> UA часто используемые экзонимы (префиксами)
  const RU2UA_PREFIX = [
    ['киев', 'київ'], ['днепр', 'дніпро'], ['одесс', 'одеса'], ['львов', 'львів'],
    ['харьк', 'харків'], ['запорож', 'запоріж'], ['ровн', 'рівн'], ['николаев', 'миколаїв'],
    ['черновц', 'чернівц'], ['луганск', 'луганськ'], ['донецк', 'донецьк'], ['херсон', 'херсон'],
    ['кропивницк', 'кропивницьк'], ['ужгород', 'ужгород'], ['кировоград', 'кропивницьк']
  ];
  function ruToUaGuess(q = '') {
    const nq = norm(q);
    const hit = RU2UA_PREFIX.find(([ru]) => nq.startsWith(ru));
    return hit ? hit[1] : null;
  }

  // --- строим набор вариантов запроса
  const variants = new Set();
  const nq = norm(qRaw);
  if (nq) variants.add(nq);
  const ruUa = ruToUaGuess(qRaw);
  if (ruUa) variants.add(norm(ruUa));
  variants.add(uaToLatSmart(nq));          // латиница для кириллицы
  if (ruUa) variants.add(uaToLatSmart(norm(ruUa)));

  // ключ кэша учитывать все варианты
  const cacheKey = `cities|${countryCode}|${lang}|${[...variants].join('|')}`;
  const cached = cacheGet(cacheKey);
  if (cached) return res.json(cached);

  // 1) Локальная база
  const states = CSState.getStatesOfCountry(countryCode);
  let base = [];
  for (const s of states) base = base.concat(CSCity.getCitiesOfState(countryCode, s.isoCode));
  if (!base.length) base = CSCity.getCitiesOfCountry(countryCode);

  // матчер по нескольким вариантам
  function matches(ctName) {
    const a = norm(ctName || '');
    const short = [...variants].some(v => v && v.length <= 2);
    for (const v of variants) {
      if (!v) continue;
      const lat = uaToLatSmart(v);
      if (a.startsWith(v) || a.startsWith(lat)) return true;
      if (short && (a.includes(v) || a.includes(lat))) return true; // для 1–2 букв — мягче
    }
    return !nq; // пустой запрос — всё ок
  }

  let result = base
    .filter(ct => matches(ct.name))
    .map(ct => ({
      id: `${countryCode}:${ct.name}`,
      name: ct.name,
      countryCode,
      localName: undefined
    }));

  // 2) Подтягиваем Nominatim (кириллица/UA)
  const needUA = (countryCode === 'UA') || isCyr(qRaw) || lang === 'uk';
  const NEED_ENRICH = needUA && (nq.length >= 1);

  async function fetchFromNominatim(qText) {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', '50');
      url.searchParams.set('q', qText);
      url.searchParams.set('countrycodes', countryCode.toLowerCase());
      url.searchParams.set('accept-language', needUA ? 'uk' : 'en');
      url.searchParams.set('namedetails', '1');

      const r = await fetch(url, { headers: { 'User-Agent': 'QontoCheckout/1.5' } });
      if (!r.ok) return [];
      const data = await r.json();
      return (Array.isArray(data) ? data : [])
        .filter(row => ['city', 'town', 'village', 'hamlet', 'municipality', 'suburb', 'quarter', 'neighbourhood', 'locality', 'place'].includes(String(row.type || '')))
        .map(row => {
          const nd = row.namedetails || {};
          const uk = nd['name:uk'] || nd['name:uk-Latn'] || null;
          const en = nd['name:en'] || row.name || null;
          const display = (uk || (row.display_name ? String(row.display_name).split(',')[0] : en));
          return {
            id: `osm:${row.osm_id}`,
            name: en || display || '',
            localName: uk || display || '',
            countryCode,
            label: display || (en || '')
          };
        });
    } catch { return []; }
  }

  if (NEED_ENRICH) {
    const qList = [...variants].filter(Boolean);
    const seenOsm = new Set();
    for (const qText of qList) {
      const osm = await fetchFromNominatim(qText);
      for (const it of osm) {
        if (!matches(it.localName || it.name)) continue;
        const k = norm((it.localName || it.name) + '|' + it.countryCode);
        if (seenOsm.has(k)) continue;
        seenOsm.add(k);
        result.push(it);
      }
      if (result.length >= 200) break;
    }
  }

  // --- РАНЖИРОВАНИЕ: крупные города и префиксные совпадения выше
  const UA_MAJOR_PREFIXES = [
    { uk: 'київ', en: 'kyiv' }, { uk: 'харків', en: 'kharkiv' }, { uk: 'дніпро', en: 'dnipro' },
    { uk: 'одес', en: 'odesa' }, { uk: 'льв', en: 'lviv' }, { uk: 'запоріж', en: 'zaporizh' },
    { uk: 'миколаїв', en: 'mykolaiv' }, { uk: 'чернів', en: 'cherniv' }, { uk: 'черкас', en: 'cherkas' },
    { uk: 'полтав', en: 'poltav' }, { uk: 'сум', en: 'sumy' }, { uk: 'терноп', en: 'ternop' },
    { uk: 'рівн', en: 'rivne' }, { uk: 'ужгород', en: 'uzhhorod' }, { uk: 'івано-франків', en: 'ivano-frank' },
    { uk: 'херсон', en: 'kherson' }, { uk: 'луцьк', en: 'lutsk' }, { uk: 'житом', en: 'zhytom' }
  ];

  const VARS = [...variants];
  const shortInput = VARS.some(v => v && v.length <= 2);

  function scoreCity(c) {
    const nm = norm(c.name);
    const loc = norm(c.localName || '');
    let score = 0;

    // точное совпадение
    for (const v of VARS) {
      if (!v) continue;
      const lat = uaToLatSmart(v);
      if (nm === v || nm === lat || (loc && loc === v)) score += 100;
    }

    // префикс
    for (const v of VARS) {
      if (!v) continue;
      const lat = uaToLatSmart(v);
      if (nm.startsWith(v) || nm.startsWith(lat)) score += 60;
      if (loc && loc.startsWith(v)) score += 70;
    }

    // короткий ввод — допускаем includes
    if (shortInput) {
      for (const v of VARS) {
        if (!v) continue;
        const lat = uaToLatSmart(v);
        const i1 = nm.indexOf(lat);
        const i2 = loc ? loc.indexOf(v) : -1;
        if (i1 >= 0) score += Math.max(30 - i1, 5);
        if (i2 >= 0) score += Math.max(35 - i2, 8);
      }
    }

    // буст крупных городов
    const big = UA_MAJOR_PREFIXES.find(p => nm.startsWith(p.en) || (loc && loc.startsWith(p.uk)));
    if (big) score += 80;

    // лёгкий штраф за очень длинные «деревенские» названия
    score -= Math.max((nm.length - 6), 0) * 0.8;

    return score;
  }

  result.sort((a, b) => {
    const sa = scoreCity(a), sb = scoreCity(b);
    if (sa !== sb) return sb - sa;
    return (a.localName || a.name || '').localeCompare(b.localName || b.name || '', 'uk');
  });

  // финальный дедуп и выбор ярлыка
  const seen = new Set();
  const out = [];
  for (const c of result) {
    const key = norm((c.localName || c.name) + '|' + c.countryCode);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...c,
      label: needUA ? (c.localName || c.name) : c.name
    });
  }

  const finalOut = out.slice(0, 100);
  cacheSet(cacheKey, finalOut, 300000);
  res.json(finalOut);
});

// ====== ПОЧТОВЫЙ ИНДЕКС ПО ГОРОДУ ======
app.get("/api/geo/postal", async (req, res) => {
  const code = String(req.query.country || "");
  const cname = String(req.query.countryName || "");
  const city = String(req.query.city || "");
  const lang = String(req.query.lang || "uk");

  if (!city || (!code && !cname)) return res.json({ postal: "" });

  let countryCode = code;
  if (!countryCode && cname) {
    const found = CSCountry.getAllCountries().find(
      c => norm(c.name) === norm(cname) ||
        norm(countriesLib.getName(c.isoCode, "uk") || "") === norm(cname)
    );
    countryCode = found?.isoCode || "";
  }

  const cacheKey = `postal|${countryCode}|${lang}|${city}`;
  const cached = cacheGet(cacheKey);
  if (cached !== null && cached !== undefined) {
    return res.json({ postal: cached });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("city", city);
    if (countryCode) url.searchParams.set("countrycodes", countryCode.toLowerCase());
    url.searchParams.set("format", "json");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("limit", "1");
    url.searchParams.set("accept-language", lang);

    const r = await fetch(url, { headers: { "User-Agent": "QonteCheckout/1.0" } });
    const data = await r.json();
    const postal = data?.[0]?.address?.postcode || "";

    cacheSet(cacheKey, postal, 300000);
    return res.json({ postal });
  } catch (e) {
    console.error("postal error", e);
    return res.json({ postal: "" });
  }
});

/* === Moderator routes — summary & lists === */
app.get('/api/moder/notifications/summary', async (req, res) => {
  try {
    const complaintsTable = await firstExistingTable(db, ['product_reports', 'complaints', 'product_complaints', 'reports', 'claims']);
    const requestsTable = await firstExistingTable(db, ['seller_requests', 'shop_requests', 'seller_applications', 'applications', 'requests_open_shop']);
    const [compl, reqs] = await Promise.all([smartCount(db, complaintsTable), smartCount(db, requestsTable)]);
    res.json({ complaints: compl.count, shop_requests: reqs.count, lastTimes: { complaints: compl.lastTime, shop_requests: reqs.lastTime } });
  } catch (err) {
    console.error('GET /api/moder/notifications/summary', err);
    res.json({ complaints: 0, shop_requests: 0, lastTimes: { complaints: null, shop_requests: null } });
  }
});

app.get('/api/moder/cases/requests', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const usersTable = await firstExistingTable(db, ['users', 'myshopdb.users']);
    const requestsTable = await firstExistingTable(db, ['seller_requests', 'shop_requests', 'seller_applications', 'applications', 'requests_open_shop']);
    let rows = [];
    if (requestsTable) {
      try {
        const [data] = await db.query(
          `SELECT r.*, u.first_name, u.last_name, u.username, u.email, u.avatar_url
           FROM \`${requestsTable}\` r
           LEFT JOIN \`${usersTable}\` u ON u.id = r.user_id
           ORDER BY r.created_at DESC LIMIT ? OFFSET ?`, [limit, offset]
        );
        rows = data;
      } catch (_) {
        const [data] = await db.query(
          `SELECT * FROM \`${requestsTable}\` ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]
        );
        rows = data;
      }
    }
    res.json({ items: rowsToItems(rows) });
  } catch (e) {
    console.error('GET /api/moder/cases/requests', e);
    res.json({ items: [] });
  }
});

app.get('/api/moder/cases/complaints', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);
    const usersTable = await firstExistingTable(db, ['users', 'myshopdb.users']);
    const complaintsTable = await firstExistingTable(db, ['product_reports', 'complaints', 'product_complaints', 'reports', 'claims']);
    let rows = [];
    if (complaintsTable) {
      try {
        const [data] = await db.query(
          `SELECT c.*, COALESCE(c.user_id, c.reporter_user_id) AS user_id, u.first_name, u.last_name, u.username, u.email, u.avatar_url
           FROM \`${complaintsTable}\` c
           LEFT JOIN \`${usersTable}\` u ON u.id = c.user_id
           ORDER BY c.created_at DESC LIMIT ? OFFSET ?`, [limit, offset]
        );
        rows = data;
      } catch (_) {
        const [data] = await db.query(
          `SELECT * FROM \`${complaintsTable}\` ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]
        );
        rows = data;
      }
    }
    res.json({ items: rowsToItems(rows) });
  } catch (e) {
    console.error('GET /api/moder/cases/complaints', e);
    res.json({ items: [] });
  }
});


/* === Moderator routes — details & approve === */
app.get('/api/moder/cases/requests/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const usersTable = await firstExistingTable(db, ['users', 'myshopdb.users']);
    const requestsTable = await firstExistingTable(db, ['seller_requests', 'shop_requests', 'seller_applications', 'applications', 'requests_open_shop']);
    if (!requestsTable) return res.status(404).json({ error: 'not found' });

    const [rows] = await db.query(
      `SELECT r.*, u.first_name, u.last_name, u.username, u.avatar_url
       FROM \`${requestsTable}\` r
       LEFT JOIN \`${usersTable}\` u ON u.id = r.user_id
       WHERE r.id = ? OR r.request_id = ? LIMIT 1`, [id, id]
    );
    const r = rows?.[0];
    if (!r) return res.status(404).json({ error: 'not found' });

    const name = [r.first_name || '', r.last_name || ''].join(' ').trim() || r.username || null;
    const docs = {
      passport_url: r.passport_url || r.passport || r.passport_scan || null,
      registry_url: r.registry_url || r.registry || r.registry_extract || null,
      ipn_url: r.ipn_url || r.tax_id || r.itn || null,
    };

    res.json({
      id: r.id || r.request_id,
      store_name: r.store_name || r.shop_name || r.market_name || r.store || r.shop || null,
      created_at: r.created_at || r.createdAt || r.date || r.created_time || r.timestamp || null,
      user: { id: r.user_id, name, avatar_url: r.avatar_url || null },
      docs
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server' });
  }
});

// Детали жалобы для модерации
app.get('/api/moder/cases/complaints/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'bad id' });

    // Таблицы-кандидаты (подстрой под себя при необходимости)
    const usersTable = await firstExistingTable(db, ['users', 'myshopdb.users']);
    const complaintsTable = await firstExistingTable(db, ['product_reports', 'complaints', 'product_complaints', 'reports', 'claims']);
    const storesTable = await firstExistingTable(db, ['stores', 'shops', 'markets', 'sellers']);
    const productsTable = await firstExistingTable(db, ['products', 'goods', 'items', 'catalog']);

    if (!complaintsTable) return res.status(404).json({ error: 'not found' });

    // 1) Тянем саму жалобу
    const [rows] = await db.query(`SELECT * FROM \`${complaintsTable}\` WHERE id=? OR report_id=? OR complaint_id=? LIMIT 1`, [id, id, id]);
    const r = rows && rows[0];
    if (!r) return res.status(404).json({ error: 'not found' });

    // 2) Нормализуем "возможные имена" полей
    const userId = r.user_id ?? r.reporter_user_id ?? r.owner_id ?? null;
    const storeId = r.store_id ?? r.shop_id ?? r.market_id ?? r.seller_id ?? null;
    const productId = r.product_id ?? r.goods_id ?? r.item_id ?? r.catalog_id ?? null;

    const createdAt = r.created_at ?? r.createdAt ?? r.date ?? r.created_time ?? r.timestamp ?? null;

    const reason =
      r.reason ??
      r.complaint_reason ??
      r.category ??
      r.reason_text ??
      null;

    // Вложения в жалобе
    const docs = {
      attachment: r.attachment ?? r.evidence ?? r.file_url ?? null,
      // ниже — если у тебя в жалобе действительно есть эти поля;
      // оставляем пустыми, фронт их игнорирует для жалоб
      passport_url: null,
      registry_url: null,
      ipn_url: null,
    };

    // 3) Подтягиваем пользователя-скаржника
    let user = null;
    if (usersTable && userId) {
      try {
        const [urows] = await db.query(`SELECT id, first_name, last_name, username, email, avatar_url, photo, avatar FROM \`${usersTable}\` WHERE id=? LIMIT 1`, [userId]);
        const u = urows && urows[0];
        if (u) {
          const full = [u.first_name || '', u.last_name || ''].join(' ').trim() || u.username || null;
          user = {
            id: u.id,
            full_name: full,
            first_name: u.first_name || null,
            last_name: u.last_name || null,
            username: u.username || null,
            avatar_url: u.avatar_url || u.photo || u.avatar || null,
          };
        }
      } catch (_) { }
    }

    // 4) Подтягиваем магазин
    let store = null;
    if (storesTable && storeId) {
      try {
        const [srows] = await db.query(`SELECT id, name, title, shop_name, logo, avatar, avatar_url, photo FROM \`${storesTable}\` WHERE id=? LIMIT 1`, [storeId]);
        const s = srows && srows[0];
        if (s) {
          store = {
            id: s.id,
            name: s.name || s.title || s.shop_name || null,
            avatar_url: s.avatar_url || s.logo || s.avatar || s.photo || null,
          };
        }
      } catch (_) { }
    }

    // 5) Подтягиваем товар
    let product = null;
    if (productsTable && productId) {
      try {
        const [prows] = await db.query(
          `SELECT id, title, name, image_url, image, photo, main_image, price, price_sale, rating, avg_rating, rate
           FROM \`${productsTable}\` WHERE id=? LIMIT 1`, [productId]
        );
        const p = prows && prows[0];
        if (p) {
          const price = p.price_sale ?? p.price ?? null;
          const rating = p.avg_rating ?? p.rating ?? p.rate ?? null;
          const img = p.image_url || p.main_image || p.image || p.photo || null;
          product = {
            id: p.id,
            title: p.title || p.name || null,
            preview_image_url: img,
            price,
            avg_rating: rating,
          };
        }
      } catch (_) { }
    }

    // 6) Кол-во предыдущих жалоб от этого пользователя
    let reporter_prev_count = 0;
    if (complaintsTable && userId) {
      try {
        const [cc] = await db.query(
          `SELECT COUNT(*) AS c FROM \`${complaintsTable}\` WHERE (user_id=? OR reporter_user_id=?) AND (id<>? AND report_id<>? AND complaint_id<>?)`,
          [userId, userId, id, id, id]
        );
        reporter_prev_count = Number(cc && cc[0] && (cc[0].c ?? 0)) || 0;
      } catch (_) { }
    }

    // 7) Ответ фронту (всё, что ждёт ModerCaseView.jsx)
    res.json({
      id: r.id ?? r.report_id ?? r.complaint_id ?? id,
      created_at: createdAt,
      reason,
      docs,
      user,
      store,       // { id, name, avatar_url }
      product,     // { id, title, preview_image_url, price, avg_rating }
      reporter_prev_count,
    });
  } catch (e) {
    console.error('GET /api/moder/cases/complaints/:id', e);
    res.status(500).json({ error: 'server' });
  }
});

app.post('/api/moder/cases/requests/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const requestsTable = await firstExistingTable(db, ['seller_requests', 'shop_requests', 'seller_applications', 'applications', 'requests_open_shop']);
    if (!requestsTable) return res.status(404).json({ error: 'not found' });
    await db.query(`UPDATE \`${requestsTable}\` SET status='approved' WHERE id=? OR request_id=?`, [id, id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }) }
});

app.post('/api/moder/cases/complaints/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const complaintsTable = await firstExistingTable(db, ['product_reports', 'complaints', 'product_complaints', 'reports', 'claims']);
    if (!complaintsTable) return res.status(404).json({ error: 'not found' });
    await db.query(`UPDATE \`${complaintsTable}\` SET status='resolved' WHERE id=? OR complaint_id=?`, [id, id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'server' }) }
});



// Report a product
app.post('/api/reports', async (req, res) => {
  try {
    const userId = req.user?.id || null; // if you have auth middleware attaching req.user
    const { productId, reason } = req.body || {};
    if (!productId || !reason) return res.status(400).json({ message: 'productId and reason are required' });
    await db.query('INSERT INTO product_reports (product_id, reporter_user_id, reason) VALUES (?,?,?)',
      [productId, userId, reason]);
    // optional: notify admins via socket.io if available
    try { io?.emit && io.emit('admin:report:new', { productId, reason }); } catch { }
    res.json({ ok: true });
  } catch (e) {
    console.error('report create error', e);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: list reports (basic)
app.get('/api/mod/reports', async (req, res) => {
  try {
    // TODO: check admin role from req.user if you have middleware
    const [rows] = await db.query('SELECT * FROM product_reports ORDER BY created_at DESC LIMIT 200');
    res.json(rows);
  } catch (e) {
    console.error('report list error', e);
    res.status(500).json({ message: 'Server error' });
  }
});
