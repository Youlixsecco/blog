/**
 * 评论路由模块
 *
 * 职责：
 *   1. GET  /article/:articleId - 获取文章评论列表（树形嵌套 + 筛选排序）
 *   2. POST /                    - 发表评论/回复（自动生成通知）
 *   3. DELETE /:id               - 删除评论（仅本人）
 *
 * 评论树构建：
 *   数据库只存扁平数据，parentId 为 NULL 表示顶层评论，非 NULL 表示回复
 *   enrichComment() 递归将扁平数据组装为嵌套树结构
 *
 * 筛选逻辑：
 *   sort=latest → 按时间倒序（默认）
 *   sort=hot    → 按热度（点赞数+回复数）倒序
 *   sort=author → 筛选"作者回复/赞过"的评论（递归检查 hasAuthorActivity）
 *
 * 通知触发：
 *   - 回复评论 → 通知父评论作者（不通知自己回复自己）
 *   - 评论文章 → 通知文章作者（不通知自己评论自己文章）
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../middleware/db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { createNotification } = require('./notifications');

/**
 * 获取文章评论列表
 * 查询参数：?sort=latest|hot|author
 * 返回树形嵌套结构，每条评论含 author、likeCount、isAuthorReply、replies
 */
router.get('/article/:articleId', optionalAuth, (req, res) => {
  const { articleId } = req.params;
  const { sort } = req.query;

  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
  if (!article) return res.json([]);
  const articleAuthorId = article.authorId;

  // 一次性加载所有评论、用户、点赞，避免 N+1 查询
  const allComments = db.prepare('SELECT * FROM comments WHERE articleId = ?').all(articleId);
  const allUsers = db.prepare('SELECT id, username, avatar FROM users').all();
  const allLikes = db.prepare('SELECT * FROM likes WHERE articleId = ?').all(articleId);
  const usersMap = {};
  allUsers.forEach(u => { usersMap[u.id] = u; });

  /**
   * 递归丰富评论数据
   * 为每条评论附加作者信息、点赞数、作者标记、嵌套回复
   */
  function enrichComment(c) {
    const author = usersMap[c.userId] || { username: '未知', avatar: null };
    const commentLikes = allLikes.filter(l => l.commentId === c.id);
    const replies = allComments
      .filter(r => r.parentId === c.id)
      .map(r => enrichComment(r))
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return {
      ...c,
      author: { id: author.id, username: author.username, avatar: author.avatar },
      likeCount: commentLikes.length,
      isAuthorReply: c.userId === articleAuthorId,
      replies
    };
  }

  /**
   * 递归检查评论及其子回复中是否有作者的活动
   * 检查三层：作者本人发的、作者赞过的、子回复中满足前两者的
   */
  function hasAuthorActivity(comment) {
    if (comment.userId === articleAuthorId) return true;
    if (allLikes.some(l => l.commentId === comment.id && l.userId === articleAuthorId)) return true;
    if (comment.replies && comment.replies.some(r => hasAuthorActivity(r))) return true;
    return false;
  }

  let result = allComments.filter(c => !c.parentId).map(enrichComment);

  if (sort === 'hot') {
    result.sort((a, b) => (b.likeCount + b.replies.length) - (a.likeCount + a.replies.length));
  } else if (sort === 'author') {
    result = result.filter(c => hasAuthorActivity(c));
  } else {
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  res.json(result);
});

/**
 * 发表评论/回复
 * 必填字段：articleId, content
 * 可选字段：parentId（有值=回复，无值=顶层评论）
 * 自动触发通知：回复 → 通知父评论作者，评论 → 通知文章作者
 */
router.post('/', authMiddleware, (req, res) => {
  const { articleId, content, parentId } = req.body;
  if (!articleId || !content) {
    return res.status(400).json({ message: '文章ID和评论内容不能为空' });
  }
  const article = db.prepare('SELECT * FROM articles WHERE id = ?').get(articleId);
  if (!article) {
    return res.status(404).json({ message: '文章不存在' });
  }
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO comments (id, articleId, userId, content, parentId, createdAt) VALUES (?, ?, ?, ?, ?, ?)').run(id, articleId, req.user.id, content, parentId || null, now);

  // 通知生成逻辑
  if (parentId) {
    // 回复评论：通知父评论作者（不通知自己回复自己）
    const parentComment = db.prepare('SELECT * FROM comments WHERE id = ?').get(parentId);
    if (parentComment && parentComment.userId !== req.user.id) {
      const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
      createNotification(parentComment.userId, 'comment_reply', articleId, req.user.id, preview, id);
    }
  } else {
    // 评论文章：通知文章作者（不通知自己评论自己文章）
    if (article.authorId !== req.user.id) {
      const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
      createNotification(article.authorId, 'article_comment', articleId, req.user.id, preview, id);
    }
  }

  res.status(201).json({ id, articleId, userId: req.user.id, content, parentId: parentId || null, createdAt: now });
});

/**
 * 删除评论
 * 权限校验：仅评论作者本人可删除
 */
router.delete('/:id', authMiddleware, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ message: '评论不存在' });
  if (comment.userId !== req.user.id) {
    return res.status(403).json({ message: '无权删除他人评论' });
  }
  db.prepare('DELETE FROM comments WHERE id = ?').run(req.params.id);
  res.json({ message: '删除成功' });
});

module.exports = router;