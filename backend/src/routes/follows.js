/**
 * 关注路由模块
 *
 * 职责：
 *   1. POST /toggle            - 关注/取消关注（toggle 模式，不能关注自己）
 *   2. GET  /status            - 查询是否已关注某用户
 *   3. GET  /following         - 我关注的人列表
 *   4. GET  /followers         - 我的粉丝列表
 *   5. GET  /followers/:userId - 指定用户的粉丝列表（公开接口）
 */

const express = require('express');
const router = express.Router();
const { db } = require('../middleware/db');
const { authMiddleware } = require('../middleware/auth');

/**
 * 切换关注状态
 * 校验：不能关注自己
 * 如果已关注 → 取消关注 → 返回 { followed: false }
 * 如果未关注 → 关注 → 返回 { followed: true }
 */
router.post('/toggle', authMiddleware, (req, res) => {
  const { targetUserId } = req.body;
  if (!targetUserId) return res.status(400).json({ message: '目标用户ID不能为空' });
  if (targetUserId === req.user.id) return res.status(400).json({ message: '不能关注自己' });

  const userId = req.user.id;
  const existing = db.prepare('SELECT * FROM follows WHERE userId = ? AND targetUserId = ?').get(userId, targetUserId);
  if (existing) {
    db.prepare('DELETE FROM follows WHERE id = ?').run(existing.id);
    return res.json({ followed: false });
  }

  db.prepare('INSERT INTO follows (userId, targetUserId, createdAt) VALUES (?, ?, ?)').run(userId, targetUserId, new Date().toISOString());
  res.json({ followed: true });
});

/**
 * 查询关注状态
 * 返回 { followed: boolean }
 */
router.get('/status', authMiddleware, (req, res) => {
  const { targetUserId } = req.query;
  const row = db.prepare('SELECT id FROM follows WHERE userId = ? AND targetUserId = ?').get(req.user.id, targetUserId);
  res.json({ followed: !!row });
});

/**
 * 我关注的人列表
 */
router.get('/following', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.avatar
    FROM follows f
    JOIN users u ON u.id = f.targetUserId
    WHERE f.userId = ?
  `).all(req.user.id);
  res.json(rows);
});

/**
 * 我的粉丝列表
 */
router.get('/followers', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.avatar
    FROM follows f
    JOIN users u ON u.id = f.userId
    WHERE f.targetUserId = ?
  `).all(req.user.id);
  res.json(rows);
});

/**
 * 指定用户的粉丝列表（公开接口）
 * 用于作者页面展示粉丝信息
 */
router.get('/followers/:userId', (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.username, u.avatar
    FROM follows f
    JOIN users u ON u.id = f.userId
    WHERE f.targetUserId = ?
  `).all(req.params.userId);
  res.json(rows);
});

module.exports = router;