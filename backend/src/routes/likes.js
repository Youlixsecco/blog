/**
 * 点赞路由模块
 *
 * 职责：
 *   1. POST /toggle   - 点赞/取消点赞（toggle 模式）
 *   2. GET  /status   - 查询点赞状态（当前用户是否已点赞 + 总点赞数）
 *   3. GET  /user-likers - 谁赞过我的文章（用于账户页统计）
 *   4. GET  /article/:articleId - 获取文章点赞列表
 *   5. GET  /comment/:commentId - 获取评论点赞列表
 *
 * 点赞对象区分：
 *   - 文章点赞：commentId IS NULL
 *   - 评论点赞：commentId 有值
 *   toggle 时根据是否传入 commentId 自动判断目标类型
 */

const express = require('express');
const router = express.Router();
const { db } = require('../middleware/db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');

/**
 * 获取文章点赞列表
 */
router.get('/article/:articleId', (req, res) => {
  const likes = db.prepare('SELECT * FROM likes WHERE articleId = ? AND commentId IS NULL').all(req.params.articleId);
  res.json(likes);
});

/**
 * 获取评论点赞列表
 */
router.get('/comment/:commentId', (req, res) => {
  const likes = db.prepare('SELECT * FROM likes WHERE commentId = ?').all(req.params.commentId);
  res.json(likes);
});

/**
 * 切换点赞状态
 * 如果已点赞 → 删除记录（取消点赞）
 * 如果未点赞 → 插入记录（点赞）
 * 根据 commentId 是否存在自动区分文章点赞和评论点赞
 */
router.post('/toggle', authMiddleware, (req, res) => {
  const { articleId, commentId } = req.body;
  const userId = req.user.id;

  const existing = commentId
    ? db.prepare('SELECT * FROM likes WHERE userId = ? AND commentId = ?').get(userId, commentId)
    : db.prepare('SELECT * FROM likes WHERE userId = ? AND articleId = ? AND commentId IS NULL').get(userId, articleId);

  if (existing) {
    db.prepare('DELETE FROM likes WHERE id = ?').run(existing.id);
    return res.json({ liked: false });
  }

  const now = new Date().toISOString();
  db.prepare('INSERT INTO likes (userId, articleId, commentId, createdAt) VALUES (?, ?, ?, ?)').run(userId, articleId || null, commentId || null, now);
  res.json({ liked: true });
});

/**
 * 查询点赞状态
 * 支持可选认证：登录后返回是否已点赞，未登录只返回总数
 * 返回 { liked: boolean, total: number }
 */
router.get('/status', optionalAuth, (req, res) => {
  const { articleId, commentId } = req.query;
  const userId = req.user ? req.user.id : null;

  const total = commentId
    ? db.prepare('SELECT COUNT(*) AS c FROM likes WHERE commentId = ?').get(commentId).c
    : db.prepare('SELECT COUNT(*) AS c FROM likes WHERE articleId = ? AND commentId IS NULL').get(articleId).c;

  let liked = false;
  if (userId) {
    const row = commentId
      ? db.prepare('SELECT id FROM likes WHERE userId = ? AND commentId = ?').get(userId, commentId)
      : db.prepare('SELECT id FROM likes WHERE userId = ? AND articleId = ? AND commentId IS NULL').get(userId, articleId);
    liked = !!row;
  }

  res.json({ liked, total });
});

/**
 * 谁赞过我的文章
 * 查询所有给当前用户文章点赞的用户（去重，仅统计文章点赞不含评论点赞）
 */
router.get('/user-likers', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const rows = db.prepare(`
    SELECT DISTINCT u.id, u.username, u.avatar
    FROM likes l
    JOIN users u ON u.id = l.userId
    JOIN articles a ON a.id = l.articleId
    WHERE a.authorId = ? AND l.commentId IS NULL
  `).all(userId);
  res.json(rows);
});

module.exports = router;