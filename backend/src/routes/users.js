/**
 * 用户路由模块
 *
 * 职责：
 *   1. GET    /me            - 当前用户信息
 *   2. GET    /profile/:id   - 用户公开资料（含文章/点赞/收藏/粉丝统计）
 *   3. PUT    /profile       - 编辑用户名/头像
 *   4. PUT    /password      - 修改密码（需验证原密码）
 *   5. GET    /liked-articles - 我赞过的文章列表
 *   6. DELETE /me            - 注销账号（密码验证 → 级联清理所有数据）
 *
 * 注销流程（按顺序）：
 *   1. 验证密码
 *   2. 删除用户所有文章及关联图片
 *   3. 删除用户的点赞/收藏/关注/评论/通知记录
 *   4. 删除头像文件
 *   5. 删除用户记录
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { db, deleteArticlesAndCleanup } = require('../middleware/db');
const { authMiddleware } = require('../middleware/auth');

/**
 * 获取当前用户信息
 * 游客返回固定信息，正式用户从数据库查询
 */
router.get('/me', authMiddleware, (req, res) => {
  if (req.user.isGuest) {
    return res.json({ id: 'guest', username: '游客', avatar: null, isGuest: true });
  }
  const user = db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });
  res.json({ id: user.id, username: user.username, avatar: user.avatar });
});

/**
 * 获取用户公开资料
 * 包含文章数、获赞数（仅文章点赞）、收藏数、粉丝数
 */
router.get('/profile/:id', (req, res) => {
  const user = db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });

  const articleRows = db.prepare('SELECT id FROM articles WHERE authorId = ?').all(user.id);
  const articleIds = articleRows.map(a => a.id);

  let articleCount = articleRows.length;
  let likeCount = 0;
  let bookmarkCount = 0;
  let followerCount = db.prepare('SELECT COUNT(*) AS c FROM follows WHERE targetUserId = ?').get(user.id).c;

  // 仅当用户有文章时才统计点赞和收藏（避免空 IN 子句报错）
  if (articleIds.length) {
    const placeholders = articleIds.map(() => '?').join(',');
    likeCount = db.prepare('SELECT COUNT(*) AS c FROM likes WHERE articleId IN (' + placeholders + ') AND commentId IS NULL').get(...articleIds).c;
    bookmarkCount = db.prepare('SELECT COUNT(*) AS c FROM bookmarks WHERE articleId IN (' + placeholders + ')').get(...articleIds).c;
  }

  res.json({
    id: user.id,
    username: user.username,
    avatar: user.avatar,
    articleCount,
    likeCount,
    bookmarkCount,
    followerCount
  });
});

/**
 * 编辑用户资料
 * 支持部分更新：传了 username 则改用户名，传了 avatar 则改头像
 * 用户名需校验唯一性（排除自己）
 */
router.put('/profile', authMiddleware, (req, res) => {
  if (req.user.isGuest) return res.status(403).json({ message: '游客不能修改信息' });
  const { username, avatar } = req.body;
  if (username) {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
    if (existing) return res.status(400).json({ message: '用户名已存在' });
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.user.id);
  }
  if (avatar !== undefined) {
    db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.user.id);
  }
  const user = db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(req.user.id);
  res.json({ id: user.id, username: user.username, avatar: user.avatar });
});

/**
 * 修改密码
 * 校验原密码 → bcrypt 哈希新密码 → 更新数据库
 */
router.put('/password', authMiddleware, async (req, res) => {
  if (req.user.isGuest) return res.status(403).json({ message: '游客不能修改密码' });
  const { oldPassword, newPassword } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });

  const valid = await bcrypt.compare(oldPassword, user.password);
  if (!valid) return res.status(400).json({ message: '原密码错误' });
  const hashed = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
  res.json({ message: '密码修改成功' });
});

/**
 * 我赞过的文章列表
 * 游客返回空数组
 */
router.get('/liked-articles', authMiddleware, (req, res) => {
  if (req.user.isGuest) return res.json([]);
  const rows = db.prepare(`
    SELECT DISTINCT a.*, u.username AS author_username, u.avatar AS author_avatar
    FROM likes l
    JOIN articles a ON a.id = l.articleId
    JOIN users u ON u.id = a.authorId
    WHERE l.userId = ? AND l.commentId IS NULL
    ORDER BY l.createdAt DESC
  `).all(req.user.id);
  const result = rows.map(r => ({
    id: r.id, title: r.title, authorId: r.authorId, views: r.views, createdAt: r.createdAt, updatedAt: r.updatedAt,
    author: { id: r.authorId, username: r.author_username || '未知', avatar: r.author_avatar }
  }));
  res.json(result);
});

/**
 * 注销账号
 * 安全流程：密码验证 → 级联删除文章+图片 → 清理社交数据 → 删除头像 → 删除用户
 * 注意：注销后 JWT 仍然有效，前端需调用 State.logout() 清除本地状态
 */
router.delete('/me', authMiddleware, async (req, res) => {
  if (req.user.isGuest) return res.status(403).json({ message: '游客不能注销' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ message: '用户不存在' });

  const { password } = req.body;
  if (!password) return res.status(400).json({ message: '请输入密码确认' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ message: '密码错误' });

  // 1. 删除用户所有文章及关联数据（图片、评论、点赞、收藏）
  const articleRows = db.prepare('SELECT id FROM articles WHERE authorId = ?').all(req.user.id);
  const articleIds = articleRows.map(a => a.id);
  deleteArticlesAndCleanup(articleIds);

  // 2. 清理用户的社交数据
  db.prepare('DELETE FROM likes WHERE userId = ?').run(req.user.id);
  db.prepare('DELETE FROM bookmarks WHERE userId = ?').run(req.user.id);
  db.prepare('DELETE FROM follows WHERE userId = ? OR targetUserId = ?').run(req.user.id, req.user.id);
  db.prepare('DELETE FROM comments WHERE userId = ?').run(req.user.id);
  db.prepare('DELETE FROM notifications WHERE userId = ?').run(req.user.id);

  // 3. 删除头像文件
  if (user.avatar) {
    const avatarPath = path.join(__dirname, '..', '..', user.avatar);
    if (fs.existsSync(avatarPath)) {
      try { fs.unlinkSync(avatarPath); } catch (e) { /* 文件被占用时静默跳过 */ }
    }
  }

  // 4. 删除用户记录
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  res.json({ message: '账号已注销' });
});

module.exports = router;