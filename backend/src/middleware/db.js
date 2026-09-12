/**
 * 数据库初始化与工具函数模块
 *
 * 职责：
 *   1. 初始化 SQLite 数据库连接（better-sqlite3）
 *   2. 首次启动时自动创建 7 张表（CREATE TABLE IF NOT EXISTS）
 *   3. 提供图片路径提取、删除、级联清理等工具函数
 *
 * 数据库配置：
 *   - WAL 模式：支持并发读写，性能优于默认的 DELETE 模式
 *   - 外键约束：强制引用完整性，删除用户/文章时级联检查
 *
 * 关键设计：
 *   - likes 表通过 commentId 是否为 NULL 区分文章点赞和评论点赞
 *   - 评论树（comments.parentId）在应用层构建，SQL 层只存扁平数据
 *   - 图片不存数据库，content 中存 Markdown/HTML 的路径引用，文件在磁盘
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据库文件路径：backend/data/blog.db
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'blog.db');
// 文章配图存储目录
const IMAGES_DIR = path.join(__dirname, '..', '..', 'data', 'images');
// 头像/Markdown 文件上传目录
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// 确保 data 目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接
const db = new Database(DB_PATH);

// 启用 WAL 模式，提升并发读写性能
db.pragma('journal_mode = WAL');
// 启用外键约束，确保数据引用完整性
db.pragma('foreign_keys = ON');

// 建表语句（IF NOT EXISTS 保证幂等，重启不会重复创建）
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    authorId TEXT NOT NULL,
    views INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (authorId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    articleId TEXT NOT NULL,
    userId TEXT NOT NULL,
    content TEXT NOT NULL,
    parentId TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (articleId) REFERENCES articles(id),
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (parentId) REFERENCES comments(id)
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    articleId TEXT NOT NULL,
    commentId TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (articleId) REFERENCES articles(id),
    FOREIGN KEY (commentId) REFERENCES comments(id)
  );

  CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    articleId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (articleId) REFERENCES articles(id)
  );

  CREATE TABLE IF NOT EXISTS follows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    targetUserId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (targetUserId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    articleId TEXT NOT NULL,
    commentId TEXT,
    fromUserId TEXT NOT NULL,
    content TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id),
    FOREIGN KEY (articleId) REFERENCES articles(id),
    FOREIGN KEY (fromUserId) REFERENCES users(id)
  );
`);

/**
 * 从文章 Markdown 内容中提取所有图片路径
 *
 * 支持两种格式：
 *   - Markdown: ![alt](/data/images/xxx.png)
 *   - HTML:     <img src="/data/images/xxx.png">
 *
 * @param {string} content - 文章 Markdown 内容
 * @returns {string[]} 图片相对路径数组，如 ['data/images/abc.png']
 */
function extractImagePaths(content) {
  if (!content) return [];
  const paths = [];
  const mdRegex = /!\[.*?\]\(\/(uploads\/[^\s)]+|data\/images\/[^\s)]+)\)/g;
  const htmlRegex = /<img[^>]+src="\/(uploads\/[^"]+|data\/images\/[^"]+)"/g;
  let match;
  while ((match = mdRegex.exec(content)) !== null) {
    paths.push(match[1]);
  }
  while ((match = htmlRegex.exec(content)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

/**
 * 删除磁盘上的图片文件
 *
 * @param {string[]} imagePaths - 图片相对路径数组
 * @returns {string[]} 成功删除的文件路径列表
 */
function deleteImageFiles(imagePaths) {
  const deleted = [];
  for (const relPath of imagePaths) {
    const fullPath = path.join(__dirname, '..', '..', relPath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        deleted.push(relPath);
      } catch (e) {
        // 文件被占用或无权限时静默跳过
      }
    }
  }
  return deleted;
}

/**
 * 批量删除文章并级联清理关联数据
 *
 * 清理顺序：
 *   1. 提取所有文章引用的图片路径
 *   2. 删除磁盘上的图片文件
 *   3. 级联删除评论、点赞、收藏
 *   4. 删除文章本身
 *
 * 注意：通知记录不在此处清理，而是保留用于历史追溯
 *
 * @param {string[]} articleIds - 待删除的文章 ID 数组
 */
function deleteArticlesAndCleanup(articleIds) {
  if (!articleIds.length) return;

  // 先查出文章内容，提取所有图片路径
  const articles = db.prepare(
    'SELECT content FROM articles WHERE id IN (' + articleIds.map(() => '?').join(',') + ')'
  ).all(...articleIds);

  // 用 Set 去重，避免同一张图片被多次引用时重复删除
  const imagePaths = new Set();
  articles.forEach(a => {
    extractImagePaths(a.content).forEach(p => imagePaths.add(p));
  });
  deleteImageFiles([...imagePaths]);

  // 构建占位符，批量删除关联数据
  const placeholders = articleIds.map(() => '?').join(',');

  db.prepare('DELETE FROM comments WHERE articleId IN (' + placeholders + ')').run(...articleIds);
  db.prepare('DELETE FROM likes WHERE articleId IN (' + placeholders + ')').run(...articleIds);
  db.prepare('DELETE FROM bookmarks WHERE articleId IN (' + placeholders + ')').run(...articleIds);
  db.prepare('DELETE FROM articles WHERE id IN (' + placeholders + ')').run(...articleIds);
}

module.exports = { db, extractImagePaths, deleteImageFiles, deleteArticlesAndCleanup };