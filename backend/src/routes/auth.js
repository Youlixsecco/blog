/**
 * 认证路由模块
 *
 * 职责：
 *   1. 用户注册（POST /register）  - 创建账号，bcrypt 加密密码，返回 JWT
 *   2. 用户登录（POST /login）     - 验证密码，返回 JWT
 *   3. 游客登录（GET /guest）      - 无需凭证，返回临时 JWT（1天过期）
 *
 * JWT 载荷：
 *   - 正式用户：{ id, username }，7天过期
 *   - 游客：    { id: 'guest', username: '游客', isGuest: true }，1天过期
 *
 * 注意：游客 ID 固定为 'guest'，不会写入 users 表，仅存在于 token 中
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../middleware/db');
const { JWT_SECRET } = require('../middleware/auth');

/**
 * 用户注册
 * 校验用户名唯一性 → bcrypt 哈希密码 → 写入 users 表 → 签发 JWT
 */
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(400).json({ message: '用户名已存在' });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO users (id, username, password, avatar, createdAt) VALUES (?, ?, ?, NULL, ?)').run(id, username, hashedPassword, createdAt);
  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id, username, avatar: null } });
});

/**
 * 用户登录
 * 查询用户 → bcrypt 比对密码 → 签发 JWT
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(400).json({ message: '用户名或密码错误' });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(400).json({ message: '用户名或密码错误' });
  }
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username, avatar: user.avatar } });
});

/**
 * 游客登录
 * 签发临时 JWT，isGuest 标记用于前端和中间件判断权限
 */
router.get('/guest', (req, res) => {
  const token = jwt.sign({ id: 'guest', username: '游客', isGuest: true }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, user: { id: 'guest', username: '游客', avatar: null, isGuest: true } });
});

module.exports = router;