/**
 * 文章路由模块
 *
 * 职责：
 *   1. GET  /          - 文章列表（支持搜索 + 按作者筛选）
 *   2. GET  /:id       - 文章详情（自动 +1 阅读量）
 *   3. POST /          - 新建文章（需登录）
 *   4. PUT  /:id       - 编辑文章（仅作者本人）
 *   5. DELETE /:id     - 删除文章（仅作者，级联清理图片+评论+点赞+收藏）
 *
 * 统计字段（likeCount/bookmarkCount/commentCount）使用子查询实时计算，
 * 不冗余存储，避免数据不一致。
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db, extractImagePaths, deleteImageFiles } = require('../middleware/db');
const { authMiddleware } = require('../middleware/auth');

/**
 * 文章列表
 * 查询参数：?search=关键词 &authorId=作者ID
 * 使用子查询关联统计 likeCount/bookmarkCount/commentCount
 * 注意：likeCount 只统计文章点赞（commentId IS NULL），不含评论点赞
 */
router.get('/', (req, res) => {
  const { search, authorId } = req.query;

  let sql = `
    SELECT a.*, u.username AS author_username, u.avatar AS author_avatar,
      (SELECT COUNT(*) FROM likes WHERE articleId = a.id AND commentId IS NULL) AS likeCount,
      (SELECT COUNT(*) FROM bookmarks WHERE articleId = a.id) AS bookmarkCount,
      (SELECT COUNT(*) FROM comments WHERE articleId = a.id) AS commentCount
    FROM articles a
    LEFT JOIN users u ON u.id = a.authorId
  `;
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('a.title LIKE ?');
    params.push('%' + search + '%');
  }
  if (authorId) {
    conditions.push('a.authorId = ?');
    params.push(authorId);
  }
  if (conditions.length) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY a.createdAt DESC';

  const rows = db.prepare(sql).all(...params);
  const result = rows.map(r => ({
    id: r.id,
    title: r.title,
    authorId: r.authorId,
    views: r.views,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    author: { id: r.authorId, username: r.author_username || '未知', avatar: r.author_avatar },
    likeCount: r.likeCount,
    bookmarkCount: r.bookmarkCount,
    commentCount: r.commentCount
  }));
  res.json(result);
});

/**
 * 文章详情
 * 先查询文章，再更新阅读量（+1），返回合并后的数据
 * 注意：返回的 views 是已加 1 后的值，但数据库此时已更新，保证后续请求读到最新值
 */
router.get('/:id', (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).json({ message: '文章不存在' });

  db.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(article.id);

  const author = db.prepare('SELECT id, username, avatar FROM users WHERE id = ?').get(article.authorId) || { username: '未知', avatar: null };
  const likeCount = db.prepare('SELECT COUNT(*) AS c FROM likes WHERE articleId = ? AND commentId IS NULL').get(article.id).c;
  const bookmarkCount = db.prepare('SELECT COUNT(*) AS c FROM bookmarks WHERE articleId = ?').get(article.id).c;
  const commentCount = db.prepare('SELECT COUNT(*) AS c FROM comments WHERE articleId = ?').get(article.id).c;

  res.json({
    ...article,
    views: article.views + 1,
    author: { id: author.id, username: author.username, avatar: author.avatar },
    likeCount,
    bookmarkCount,
    commentCount
  });
});

/**
 * 新建文章
 * 校验标题和内容非空 → 生成 UUID → 写入数据库
 */
router.post('/', authMiddleware, (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ message: '标题和内容不能为空' });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO articles (id, title, content, authorId, views, createdAt, updatedAt) VALUES (?, ?, ?, ?, 0, ?, ?)').run(id, title, content, req.user.id, now, now);
  res.status(201).json({ id, title, content, authorId: req.user.id, views: 0, createdAt: now, updatedAt: now });
});

/**
 * 编辑文章
 * 权限校验：仅作者本人可编辑
 * 使用 COALESCE 实现部分更新：传了才改，不传保留原值
 */
router.put('/:id', authMiddleware, (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).json({ message: '文章不存在' });
  if (article.authorId !== req.user.id) {
    return res.status(403).json({ message: '无权修改他人文章' });
  }
  const { title, content } = req.body;
  const now = new Date().toISOString();
  db.prepare('UPDATE articles SET title = COALESCE(?, title), content = COALESCE(?, content), updatedAt = ? WHERE id = ?').run(title || null, content || null, now, article.id);
  res.json({ ...article, title: title || article.title, content: content || article.content, updatedAt: now });
});

/**
 * 删除文章
 * 权限校验：仅作者本人可删除
 * 清理流程：提取文中图片路径 → 删除磁盘文件 → 级联删除评论/点赞/收藏 → 删除文章
 */
router.delete('/:id', authMiddleware, (req, res) => {
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!article) return res.status(404).json({ message: '文章不存在' });
  if (article.authorId !== req.user.id) {
    return res.status(403).json({ message: '无权删除他人文章' });
  }

  const imagePaths = extractImagePaths(article.content);
  deleteImageFiles(imagePaths);

  db.prepare('DELETE FROM comments WHERE articleId = ?').run(article.id);
  db.prepare('DELETE FROM likes WHERE articleId = ?').run(article.id);
  db.prepare('DELETE FROM bookmarks WHERE articleId = ?').run(article.id);
  db.prepare('DELETE FROM articles WHERE id = ?').run(article.id);

  res.json({ message: '删除成功' });
});

module.exports = router;