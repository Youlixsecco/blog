/**
 * Blog 后端主入口
 *
 * 架构：
 *   Express 服务器 → 托管前端静态文件 → 挂载 9 个 API 路由模块 → SPA fallback
 *
 * 中间件栈（从上到下）：
 *   cors()           - 允许跨域请求
 *   express.json()   - 解析 JSON 请求体
 *   urlencoded()     - 解析 URL 编码请求体
 *   express.static() - 托管上传文件、图片、前端静态资源
 *
 * 路由挂载：
 *   /api/auth          - 认证
 *   /api/articles      - 文章
 *   /api/comments      - 评论
 *   /api/likes         - 点赞
 *   /api/bookmarks     - 收藏
 *   /api/follows       - 关注
 *   /api/users         - 用户
 *   /api/upload        - 上传
 *   /api/notifications - 通知
 *
 * 静态文件：
 *   /uploads/     → backend/uploads/     （头像、Markdown 文件）
 *   /data/images/ → backend/data/images/ （文章配图）
 *   /             → frontend/public/     （前端 SPA）
 *
 * 端口：process.env.PORT || 3000
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/auth');
const articleRoutes = require('./routes/articles');
const commentRoutes = require('./routes/comments');
const likeRoutes = require('./routes/likes');
const bookmarkRoutes = require('./routes/bookmarks');
const followRoutes = require('./routes/follows');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/upload');
const { router: notificationRoutes } = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// 全局中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务：上传文件、图片、前端资源
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/data/images', express.static(path.join(__dirname, '..', 'data', 'images')));
app.use(express.static(path.join(__dirname, '..', '..', 'frontend', 'public')));

// API 路由挂载
app.use('/api/auth', authRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);

// SPA fallback：所有非 API 请求返回 index.html，由前端路由接管
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Blog server running on http://localhost:${PORT}`);
});