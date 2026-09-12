/**
 * 认证中间件模块
 *
 * 职责：
 *   1. authMiddleware  - 强制认证：未登录返回 401，用于需要登录态的操作
 *   2. optionalAuth    - 可选认证：有 token 就解析，没有也放行，用于"登录后展示更多"的场景
 *   3. JWT_SECRET      - 签名密钥，同时被 auth 路由和中间件共用
 *
 * JWT 载荷（payload）：
 *   { id: UUID, username: string, role: 'user' | 'guest' }
 *   游客的 role 为 'guest'，正式用户为 'user'，前端据此判断是否展示敏感操作按钮
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = 'blog_secret_key_2024';

/**
 * 强制认证中间件
 * 从 Authorization 头提取 Bearer token，验证失败直接返回 401
 * 验证成功后将 { id, username, role } 挂载到 req.user
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未登录' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: '登录已过期，请重新登录' });
  }
}

/**
 * 可选认证中间件
 * 有 token 时尝试解析挂载到 req.user，解析失败静默忽略
 * 用于点赞/收藏状态查询等"登录后可获取个性化数据，未登录也能看"的接口
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // token 无效或过期，不阻塞请求，按未登录处理
    }
  }
  next();
}

module.exports = { authMiddleware, optionalAuth, JWT_SECRET };