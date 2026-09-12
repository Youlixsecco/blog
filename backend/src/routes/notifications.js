/**
 * 通知路由模块
 *
 * 职责：
 *   1. GET  /            - 通知列表（含发信人信息和文章标题）
 *   2. GET  /unread-count - 未读通知数量
 *   3. PUT  /:id/read    - 标记单条已读
 *   4. PUT  /read-all    - 全部已读
 *
 * 通知生成：
 *   createNotification() 由 comments.js 在发表评论时调用
 *   - 评论回复 → 通知父评论作者（type: 'comment_reply'）
 *   - 评论文章 → 通知文章作者（type: 'article_comment'）
 *
 * 前端轮询：
 *   NotificationCenter 组件每 30s 查询 /api/notifications/unread-count
 *   点击通知 → 标记已读 → 跳转文章 + 滚动定位到对应评论
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../middleware/db');
const { authMiddleware } = require('../middleware/auth');

/**
 * 创建通知
 * 被 comments.js 调用，不对外暴露路由
 *
 * @param {string} userId      - 接收通知的用户ID
 * @param {string} type        - 通知类型：'comment_reply' | 'article_comment'
 * @param {string} articleId   - 关联文章ID
 * @param {string} fromUserId  - 触发通知的用户ID
 * @param {string} content     - 内容预览（已截断至50字）
 * @param {string} commentId   - 关联评论ID
 */
function createNotification(userId, type, articleId, fromUserId, content, commentId) {
  const id = uuidv4();
  db.prepare('INSERT INTO notifications (id, userId, type, articleId, commentId, fromUserId, content, read, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)').run(id, userId, type, articleId, commentId || null, fromUserId, content, new Date().toISOString());
}

/**
 * 获取通知列表
 * JOIN 用户表和文章表，返回发信人信息和文章标题
 * 游客返回空数组
 */
router.get('/', authMiddleware, (req, res) => {
  if (req.user.isGuest) return res.json([]);
  const rows = db.prepare(`
    SELECT n.*, u.username AS from_username, u.avatar AS from_avatar, a.title AS article_title
    FROM notifications n
    LEFT JOIN users u ON u.id = n.fromUserId
    LEFT JOIN articles a ON a.id = n.articleId
    WHERE n.userId = ?
    ORDER BY n.createdAt DESC
  `).all(req.user.id);
  const result = rows.map(n => ({
    id: n.id,
    userId: n.userId,
    type: n.type,
    articleId: n.articleId,
    commentId: n.commentId,
    fromUserId: n.fromUserId,
    content: n.content,
    read: !!n.read,
    createdAt: n.createdAt,
    fromUser: { id: n.fromUserId, username: n.from_username || '未知', avatar: n.from_avatar },
    articleTitle: n.article_title || '已删除'
  }));
  res.json(result);
});

/**
 * 获取未读通知数量
 * 前端轮询此接口，显示在铃铛徽章上
 */
router.get('/unread-count', authMiddleware, (req, res) => {
  if (req.user.isGuest) return res.json({ count: 0 });
  const row = db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE userId = ? AND read = 0').get(req.user.id);
  res.json({ count: row.c });
});

/**
 * 标记单条通知已读
 * 权限校验：仅通知接收者本人可标记
 */
router.put('/:id/read', authMiddleware, (req, res) => {
  const result = db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND userId = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ message: '通知不存在' });
  res.json({ message: 'ok' });
});

/**
 * 标记全部通知已读
 */
router.put('/read-all', authMiddleware, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE userId = ?').run(req.user.id);
  res.json({ message: 'ok' });
});

module.exports = { router, createNotification };