/* === ORIGINAL (ваш текущий перед изменением) ===
<оставил пустым, т.к. вы уже прислали актуальную версию и ниже она сохранена 1:1, изменения помечены комментариями ADDED / UPDATED>
=== END ORIGINAL === */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2/promise');
const axios = require('axios');

// === ADDED: для Google + OTP + SMS
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

// === ADDED: SMS (Twilio по умолчанию)
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
app.use(cors({
  origin: allowedOrigins,
  credentials: true,            // <-- важно для cookie
}));
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
  timezone: '+00:00'
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const API_KEY = process.env.OPENROUTER_API_KEY;

console.log('API_KEY из .env:', API_KEY);

// === Middleware JWT → req.user
async function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) { req.user = null; return next(); }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const [rows] = await db.query(
      'SELECT id, first_name, last_name, username, phone, email FROM users WHERE id = ?',
      [payload.id]
    );
    req.user = rows.length ? rows[0] : null;
  } catch {
    req.user = null;
  }
  next();
}
app.use(authMiddleware);

/* ===================== helpers & schema ===================== */
function random6() { return Math.floor(100000 + Math.random() * 900000).toString(); }
function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }
function normalizePhone(raw) {
  if (!raw) return '';
  let p = String(raw).replace(/[^\d+]/g, '');
  if (!p.startsWith('+') && /^\d+$/.test(p)) p = '+' + p; // примитивное E.164
  return p;
}

// создаём таблицы для OTP
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
  } catch (e) {
    console.error('Не удалось создать таблицы OTP:', e?.message || e);
  }
})();

// email
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

// SMS (Twilio)
async function sendOtpSms(to, code) {
  if (SMS_PROVIDER !== 'twilio') throw new Error('SMS_PROVIDER не настроен (twilio)');
  if (!twilioClient) throw new Error('Twilio клиент не инициализирован');
  const from = process.env.TWILIO_FROM;
  if (!from) throw new Error('TWILIO_FROM не задан в .env');
  const resp = await twilioClient.messages.create({
    from,
    to,
    body: `Ваш код: ${code} (действителен 10 минут)`
  });
  console.log('📲 SMS отправлено:', resp.sid);
}

async function verifyGoogleIdToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID не задан в .env');
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  return ticket.getPayload();
}

async function findUserByEmail(email) {
  const [rows] = await db.query('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows?.[0] || null;
}
async function findUserByPhone(phone) {
  const [rows] = await db.query('SELECT * FROM users WHERE phone = ? LIMIT 1', [phone]);
  return rows?.[0] || null;
}

// username генератор
async function ensureUniqueUsername(base) {
  let u = (base || 'user').toString().replace(/[^a-z0-9._-]/gi, '').toLowerCase();
  if (!u) u = 'user';
  let candidate = u, i = 0;
  while (true) {
    const [r] = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [candidate]);
    if (!r.length) return candidate;
    i += 1;
    candidate = `${u}${i}`;
    if (i > 50) candidate = `${u}-${Date.now().toString().slice(-6)}`;
  }
}

// создание юзера по email (для Google)
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
/* ===================== /helpers ===================== */

// === ВАШИ ОРИГИНАЛЬНЫЕ РОУТЫ === (register / login username)
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

    const userId = result.insertId;
    const token = jwt.sign({ id: userId, username }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, user: { first_name: firstName, last_name: lastName, username, phone, email } });
  } catch (err) {
    console.error('Register error (подробно):', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера.', detail: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Логин и пароль обязательны.' });
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
    if (!rows.length) return res.status(400).json({ error: 'Неверные учетные данные.' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(400).json({ error: 'Неверные учетные данные.' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, user: { first_name: user.first_name, last_name: user.last_name, username: user.username, phone: user.phone, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера.' });
  }
});

// === Регистрация/вход по EMAIL (без логина)
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

    res.json({ ok: true, id: result.insertId });
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
    const user = rows?.[0];
    if (!user) return res.status(400).json({ error: 'Неверный email или пароль.' });

    const match = await bcrypt.compare(password, user.password_hash || '');
    if (!match) return res.status(400).json({ error: 'Неверный email или пароль.' });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true });
  } catch (e) {
    console.error('login-email error:', e);
    res.status(500).json({ error: 'Ошибка входа.' });
  }
});

// === Google OAuth + 6-значный код на email
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

    res.json({ ok: true, user: {
      id: user.id,
      email,
      first_name: user.first_name || payload.given_name || '',
      last_name: user.last_name || payload.family_name || '',
      username: user.username
    }});
  } catch (e) {
    console.error('google/verify error:', e);
    res.status(500).json({ error: 'Ошибка при подтверждении кода' });
  }
});

/* ===================== Привязка телефона + вход по телефону (пароль) ===================== */
app.post('/api/me/update-phone', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Не авторизован' });

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

app.post('/api/login-phone', async (req, res) => {
  try {
    let { phone, password } = req.body || {};
    if (!phone || !password) return res.status(400).json({ error: 'Укажите телефон и пароль' });

    phone = normalizePhone(phone);
    const [rows] = await db.query('SELECT * FROM users WHERE phone = ? LIMIT 1', [phone]);
    const user = rows?.[0];
    if (!user) return res.status(400).json({ error: 'Неверный телефон или пароль' });

    const match = await bcrypt.compare(password, user.password_hash || '');
    if (!match) return res.status(400).json({ error: 'Неверный телефон или пароль' });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true });
  } catch (e) {
    console.error('login-phone error:', e);
    res.status(500).json({ error: 'Ошибка входа по телефону' });
  }
});

/* ===================== ADDED: Вход по телефону через SMS-код ===================== */
/** Старт: принимает phone, отправляет код по SMS */
app.post('/api/auth/phone/start', async (req, res) => {
  try {
    let { phone } = req.body || {};
    phone = normalizePhone(phone);
    if (!phone) return res.status(400).json({ error: 'Укажите номер телефона' });

    // номер должен быть привязан к аккаунту
    const user = await findUserByPhone(phone);
    if (!user) return res.status(404).json({ error: 'Этот номер не привязан ни к одному аккаунту' });

    // простейший анти-спам: 1 код не чаще чем раз в 30 секунд
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

/** Подтверждение: принимает phone + code, проверяет и логинит */
app.post('/api/auth/phone/verify', async (req, res) => {
  try {
    let { phone, code } = req.body || {};
    phone = normalizePhone(phone);
    if (!phone || !code) return res.status(400).json({ error: 'Укажите телефон и код' });

    const [rows] = await db.query('SELECT * FROM phone_otps WHERE phone = ? LIMIT 1', [phone]);
    const row = rows?.[0];
    if (!row) return res.status(400).json({ error: 'Код не запрошен или истёк' });
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Код истёк, запросите новый' });
    }
    if (sha256(code) !== row.code_hash) {
      return res.status(400).json({ error: 'Неверный код' });
    }

    await db.query('DELETE FROM phone_otps WHERE phone = ?', [phone]);

    const user = await findUserByPhone(phone);
    if (!user) return res.status(404).json({ error: 'Аккаунт не найден' });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ ok: true });
  } catch (e) {
    console.error('phone/verify error:', e);
    res.status(500).json({ error: 'Ошибка подтверждения кода' });
  }
});

/* ===================== Обновление профиля (без username) ===================== */
app.post('/api/me/update-profile', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Не авторизован' });
    let { first_name, last_name, email } = req.body || {};
    first_name = (first_name || '').trim();
    last_name  = (last_name  || '').trim();
    email      = (email      || '').trim();

    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'Имя, фамилия и email обязательны' });
    }
    const [exists] = await db.query('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [email, req.user.id]);
    if (exists.length) return res.status(400).json({ error: 'Этот email уже используется' });

    await db.query('UPDATE users SET first_name=?, last_name=?, email=? WHERE id=?', [first_name, last_name, email, req.user.id]);

    const [rows] = await db.query('SELECT id, first_name, last_name, phone, email FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    res.json({ ok: true, user: rows?.[0] || null });
  } catch (e) {
    console.error('update-profile error:', e);
    res.status(500).json({ error: 'Не удалось сохранить профиль' });
  }
});

// === me / logout / chat (как было)
app.get('/api/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;
  try {
    let systemContext = 'Ты вежливый ИИ-помощник, консультирующий по интернет-магазину.';
    if (req.user) systemContext += ` Пользователь: ${req.user.username}, email: ${req.user.email}.`;

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

// === Запуск
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`✅ Сервер работает на http://localhost:${PORT}`);
});
