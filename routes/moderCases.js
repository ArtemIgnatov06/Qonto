
// server/routes/moderCases.js
// Drop-in router to serve moderator "requests" and "complaints" details + approve actions.
// Assumes you already have: const express = require('express') or `import express from 'express'` in your server.
// Export is CommonJS and ESM compatible via default.

import express from "express";

/** Try a list of possible table names and return the first that exists. */
async function firstExistingTable(db, candidates) {
  for (const name of candidates) {
    try {
      const [rows] = await db.query(`SHOW TABLES LIKE ?`, [name]);
      if (rows && rows.length) return name;
    } catch (_) {}
  }
  return null;
}

/** Build product object out of a raw row with many possible column names */
function composeProduct(row) {
  if (!row) return null;
  return {
    id: row.product_id ?? row.goods_id ?? row.item_id ?? row.catalog_id ?? null,
    title: row.product_name ?? row.product_title ?? row.name ?? row.title ?? null,
    preview_image_url:
      row.product_image ?? row.product_img ?? row.image_url ?? row.image ?? row.photo ?? null,
    price:
      row.product_price ?? row.price_sale ?? row.price ?? null,
    avg_rating: row.product_rating ?? row.rating ?? row.rate ?? null,
  };
}

/** Build user info */
function composeUser(row) {
  if (!row) return null;
  const full = [row.first_name || "", row.last_name || ""].join(" ").trim();
  return {
    id: row.user_id ?? row.reporter_user_id ?? row.reporter_id ?? row.uid ?? null,
    full_name: full || row.user_full_name || row.username || row.user_name || null,
    avatar_url: row.avatar_url || row.avatar || row.photo || null,
  };
}

/** Build store info */
function composeStore(row) {
  if (!row) return null;
  return {
    id: row.store_id ?? row.shop_id ?? row.seller_id ?? null,
    name: row.store_name ?? row.shop_name ?? row.shop_title ?? row.name ?? "Без назви",
    avatar_url: row.store_logo ?? row.shop_logo ?? row.logo ?? row.avatar ?? null
  };
}

export default function moderCasesRouter(db) {
  const router = express.Router();

  // ===== Requests list (optional) =====
  router.get('/api/moder/cases/requests', async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit || 20), 100);
      const offset = Math.max(Number(req.query.offset || 0), 0);
      const table = await firstExistingTable(db, [
        'seller_requests','seller_applications','applications','requests_open_shop'
      ]);
      const usersTable = await firstExistingTable(db, ['users','myshopdb.users']);
      if (!table) return res.json({ items: [] });

      let sql = `SELECT r.*, u.first_name, u.last_name, u.username, u.avatar_url
                 FROM \`${table}\` r
                 LEFT JOIN \`${usersTable || 'users'}\` u ON u.id = r.user_id
                 ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
      const [rows] = await db.query(sql, [limit, offset]);
      res.json({ items: rows || [] });
    } catch (e) {
      console.error('GET /api/moder/cases/requests', e);
      res.json({ items: [] });
    }
  });

  // ===== Complaints list (optional) =====
  router.get('/api/moder/cases/complaints', async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit || 20), 100);
      const offset = Math.max(Number(req.query.offset || 0), 0);
      const table = await firstExistingTable(db, [
        'product_reports','complaints','product_complaints','reports','claims'
      ]);
      if (!table) return res.json({ items: [] });
      const [rows] = await db.query(
        `SELECT * FROM \`${table}\` ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]
      );
      res.json({ items: rows || [] });
    } catch (e) {
      console.error('GET /api/moder/cases/complaints', e);
      res.json({ items: [] });
    }
  });

  // ===== Request details =====
  router.get('/api/moder/cases/requests/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const usersTable = await firstExistingTable(db, ['users','myshopdb.users']);
      const requestsTable = await firstExistingTable(db, [
        'seller_requests','seller_applications','applications','requests_open_shop'
      ]);
      if (!requestsTable) return res.status(404).json({ error: 'not found' });

      const [rows] = await db.query(
        `SELECT r.*, u.first_name, u.last_name, u.username, u.avatar_url
           FROM \`${requestsTable}\` r
           LEFT JOIN \`${usersTable || 'users'}\` u ON u.id = r.user_id
          WHERE r.id=? OR r.request_id=?
          LIMIT 1`, [id, id]
      );
      const r = rows && rows[0];
      if (!r) return res.status(404).json({ error: 'not found' });

      const user = composeUser(r);
      const store = composeStore(r);
      const docs = {
        registry_url: r.registry_url ?? r.registry ?? r.registry_extract ?? null,
        ipn_url: r.ipn_url ?? r.ipn ?? r.tax_id ?? null,
        passport_url: r.passport_url ?? r.passport ?? r.passport_scan ?? null
      };

      res.json({
        id: r.id || id,
        created_at: r.created_at ?? r.createdAt ?? r.date ?? null,
        docs,
        user,
        store
      });
    } catch (e) {
      console.error('GET /api/moder/cases/requests/:id', e);
      res.status(500).json({ error: 'server' });
    }
  });

  // ===== Complaint details =====
  router.get('/api/moder/cases/complaints/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const usersTable = await firstExistingTable(db, ['users','myshopdb.users']);
      const complaintsTable = await firstExistingTable(db, [
        'product_reports','complaints','product_complaints','reports','claims'
      ]);
      if (!complaintsTable) return res.status(404).json({ error: 'not found' });

      const [rows] = await db.query(
        `SELECT * FROM \`${complaintsTable}\` WHERE id=? OR complaint_id=? OR report_id=? LIMIT 1`,
        [id, id, id]
      );
      const r = rows && rows[0];
      if (!r) return res.status(404).json({ error: 'not found' });

      const product = composeProduct(r);
      const userId = r.user_id ?? r.reporter_user_id ?? r.reporter_id ?? r.uid ?? null;
      const user = userId
        ? (await db.query(
            `SELECT id, first_name, last_name, username, avatar_url, avatar, photo FROM \`${usersTable || 'users'}\` WHERE id=? LIMIT 1`,
            [userId]
          ))[0][0] || null
        : null;

      const store = composeStore(r);

      const createdAt = r.created_at ?? r.createdAt ?? r.date ?? r.created_time ?? r.timestamp ?? null;
      const reason = r.reason ?? r.complaint_reason ?? r.category ?? r.reason_text ?? null;
      const docs = {
        attachment: r.attachment ?? r.evidence ?? r.file_url ?? null,
        passport_url: null,
        registry_url: null,
        ipn_url: null
      };

      // previous complaints by the same reporter
      let reporter_prev_count = 0;
      if (userId) {
        try {
          const [cc] = await db.query(
            `SELECT COUNT(*) AS c FROM \`${complaintsTable}\`
              WHERE (reporter_user_id=? OR user_id=?) AND (id<>? AND report_id<>? AND complaint_id<>?)`,
            [userId, userId, id, id, id]
          );
          reporter_prev_count = Number(cc && cc[0] && (cc[0].c ?? 0)) || 0;
        } catch (_) {}
      }

      res.json({
        id: r.id ?? r.report_id ?? r.complaint_id ?? id,
        created_at: createdAt,
        reason,
        docs,
        user: composeUser(user || r),
        store,
        product,
        reporter_prev_count
      });
    } catch (e) {
      console.error('GET /api/moder/cases/complaints/:id', e);
      res.status(500).json({ error: 'server' });
    }
  });

  // ===== Approve actions =====
  router.post('/api/moder/cases/requests/:id/approve', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const table = await firstExistingTable(db, [
        'seller_requests','seller_applications','applications','requests_open_shop'
      ]);
      if (!table) return res.status(404).json({ error: 'not found' });
      await db.query(`UPDATE \`${table}\` SET status='approved' WHERE id=? OR request_id=?`, [id, id]);
      res.json({ ok: true });
    } catch (e) {
      console.error('POST /api/moder/cases/requests/:id/approve', e);
      res.status(500).json({ error: 'server' });
    }
  });

  router.post('/api/moder/cases/complaints/:id/approve', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const table = await firstExistingTable(db, [
        'product_reports','complaints','product_complaints','reports','claims'
      ]);
      if (!table) return res.status(404).json({ error: 'not found' });
      await db.query(`UPDATE \`${table}\` SET status='resolved' WHERE id=? OR complaint_id=? OR report_id=?`, [id, id, id]);
      res.json({ ok: true });
    } catch (e) {
      console.error('POST /api/moder/cases/complaints/:id/approve', e);
      res.status(500).json({ error: 'server' });
    }
  });

  return router;
}
