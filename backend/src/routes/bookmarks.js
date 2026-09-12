/**
 * 收藏路由模块
 *
 * 职责：
 *   1. POST /toggle     - 收藏/取消收藏（toggle 模式）
 *   2. GET  /status     - 查询当前用户是否已收藏某文章
 *   3. GET  /my          - 我的收藏列表（含文章和作者信息）
 *   4. GET  /stargazers  - 收藏过我文章的用户列表
 */

const express = require('express');
const router = express.Router();
const { db } = require('../middleware/db');
const { authMiddleware } = require('../middleware/auth');

/**
 * 切换收藏状态
 * 如果已收藏 → 删除记录 → 返回 { bookmarked: false }
 * 如果未收藏 → 插入记录 → 返回 { bookmarked: true }
 */
router.post('/toggle', authMiddleware, (req, res) => {
  const { articleId } = req.body;
  if (!articleId) return res.status(400).json({ message: '文章ID不能为空' });
  const userId = req.user.id;

  const existing = db.prepare('SELECT * FROM bookmarks WHERE userId = ? AND articleId = ?').get(userId, articleId);
  if (existing) {
    db.prepare('DELETE FROM bookmarks WHERE id = ?').run(existing.id);
    return res.json({ bookmarked: false });
  }

  db.prepare('INSERT INTO bookmarks (userId, articleId, createdAt) VALUES (?, ?, ?)').run(userId, articleId, new Date().toISOString());
  res.json({ bookmarked: true });
});

/**
 * 查询收藏状态
 * 返回 { bookmarked: boolean }
 */
router.get('/status', authMiddleware, (req, res) => {
  const { articleId } = req.query;
  const row = db.prepare('SELECT id FROM bookmarks WHERE userId = ? AND articleId = ?').get(req.user.id, articleId);
  res.json({ bookmarked: !!row });
});

/**
 * 我的收藏列表
 * JOIN 文章和作者表，返回用户收藏的文章列表
 */
router.get('/my', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT a.*, u.username AS author_username, u.avatar AS author_avatar
    FROM bookmarks b
    JOIN articles a ON a.id = b.articleId
    JOIN users u ON u.id = a.authorId
    WHERE b.userId = ?
    ORDER BY b.createdAt DESC
  `).all(req.user.id);
  const result = rows.map(r => ({
    id: r.id, title: r.title, authorId: r.authorId, views: r.views, createdAt: r.createdAt, updatedAt: r.updatedAt,
    author: { id: r.authorId, username: r.author_username || '未知', avatar: r.author_avatar }
  }));
  res.json(result);
});

/**
 * 收藏过我文章的用户列表
 * 查询所有收藏了当前用户文章的用户（去重）
 */
router.get('/stargazers', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const rows = db.prepare(`
    SELECT DISTINCT u.id, u.username, u.avatar
    FROM bookmarks b
    JOIN users u ON u.id = b.userId
    JOIN articles a ON a.id = b.articleId
    WHERE a.authorId = ?
  `).all(userId);
  res.json(rows);
});

module.exports = router;