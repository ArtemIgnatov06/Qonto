// server/routes/chats.js
const express = require('express');

module.exports = function createChatsRouter({ db, requireAuth, emitToUser }) {
  const router = express.Router();

  // создать/получить диалог
  router.post('/chats/start', requireAuth, async (req, res) => {
    try {
      const seller_id = Number(req.body?.seller_id);
      if (!seller_id || seller_id === req.user.id) {
        return res.status(400).json({ error: 'Некорректный продавец' });
      }
      const [se] = await db.query('SELECT id FROM users WHERE id=? LIMIT 1', [seller_id]);
      if (!se.length) return res.status(404).json({ error: 'Продавец не найден' });

      const buyer_id = req.user.id;
      const [ex] = await db.query(
        'SELECT id FROM chat_threads WHERE seller_id=? AND buyer_id=? LIMIT 1',
        [seller_id, buyer_id]
      );
      if (ex.length) return res.json({ id: ex[0].id });

      const [r] = await db.query(
        'INSERT INTO chat_threads (seller_id, buyer_id) VALUES (?, ?)',
        [seller_id, buyer_id]
      );
      res.json({ id: r.insertId });
    } catch (e) {
      console.error('POST /chats/start', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // мои диалоги
  router.get('/chats/my', requireAuth, async (req, res) => {
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
      console.error('GET /chats/my', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // сообщения треда
  router.get('/chats/:id/messages', requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const me = req.user.id;

      const [tt] = await db.query('SELECT * FROM chat_threads WHERE id=? LIMIT 1', [id]);
      const t = tt[0];
      if (!t || (t.seller_id !== me && t.buyer_id !== me)) {
        return res.status(404).json({ message: 'Chat not found' });
      }

      const [msgs] = await db.query(
        `SELECT id, sender_id, body, created_at, read_at
         FROM chat_messages
         WHERE thread_id=?
         ORDER BY id ASC`,
        [id]
      );

      await db.query(
        `UPDATE chat_messages SET read_at=NOW()
         WHERE thread_id=? AND sender_id<>? AND read_at IS NULL`,
        [id, me]
      );

      res.json({ thread: { id, seller_id: t.seller_id, buyer_id: t.buyer_id }, items: msgs });
    } catch (e) {
      console.error('GET /chats/:id/messages', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // отправка сообщения + сокет пуши
  router.post('/chats/:id/messages', requireAuth, async (req, res) => {
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

      emitToUser(t.seller_id, 'chat:message', payload);
      emitToUser(t.buyer_id,  'chat:message', payload);

      const receiver = me === t.seller_id ? t.buyer_id : t.seller_id;
      emitToUser(receiver, 'chat:unread', { delta: +1 });

      res.json({ ok: true, ...payload });
    } catch (e) {
      console.error('POST /chats/:id/messages', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // прочитать входящие в треде
  router.post('/chats/:id/read', requireAuth, async (req, res) => {
    try {
      const threadId = Number(req.params.id);
      const me = req.user.id;

      await db.query(
        `UPDATE chat_messages m
           JOIN chat_threads t ON t.id = m.thread_id
           SET m.read_at = NOW()
         WHERE m.thread_id=? AND m.sender_id<>? AND m.read_at IS NULL`,
        [threadId, me]
      );

      const [[{ c }]] = await db.query(
        `SELECT COUNT(*) AS c
           FROM chat_messages m
           JOIN chat_threads t ON t.id=m.thread_id
          WHERE (t.seller_id=? OR t.buyer_id=?)
            AND m.sender_id<>?
            AND m.read_at IS NULL`,
        [me, me, me]
      );

      emitToUser(me, 'chat:unread:replace', { total: c });
      res.json({ ok: true, unread: c });
    } catch (e) {
      console.error('POST /chats/:id/read', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // счётчик непрочитанных (для хедера)
  router.get('/chats/unread-count', requireAuth, async (req, res) => {
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
      console.error('GET /chats/unread-count', e);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};
