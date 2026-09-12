/**
 * 文件上传路由模块
 *
 * 职责：
 *   1. POST /avatar   - 上传用户头像（任意格式，5MB限制，存到 uploads/）
 *   2. POST /markdown - 上传 Markdown 文件（.md/.markdown，5MB限制，存到 uploads/）
 *   3. POST /image    - 上传文章配图（仅图片格式，5MB限制，存到 data/images/）
 *
 * 文件命名策略：UUID + 原始扩展名，避免文件名冲突
 * 两种上传器：
 *   - imageUpload  ：仅图片格式（jpg/jpeg/png/gif/webp/bmp/svg），存入 data/images/
 *   - generalUpload：图片+Markdown文件，存入 uploads/
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const IMAGES_DIR = path.join(__dirname, '..', '..', 'data', 'images');
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

// 确保图片目录存在
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// 图片上传器配置：仅允许图片格式，存入 data/images/
const imageStorage = multer.diskStorage({
  destination: IMAGES_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('仅支持图片格式'));
    }
  }
});

// 通用上传器配置：允许图片和 Markdown 文件，存入 uploads/
const generalStorage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});

const generalUpload = multer({
  storage: generalStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|md|markdown)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

/**
 * 上传头像
 * 返回文件URL，前端调用 PUT /api/users/profile 将 URL 写入 avatar 字段
 */
router.post('/avatar', authMiddleware, generalUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择文件' });
  res.json({ url: '/uploads/' + req.file.filename });
});

/**
 * 上传 Markdown 文件
 * 返回文件URL和原始文件名，前端用于新建文章时读取内容
 */
router.post('/markdown', authMiddleware, generalUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择文件' });
  res.json({
    url: '/uploads/' + req.file.filename,
    filename: req.file.originalname
  });
});

/**
 * 上传文章配图
 * 返回图片URL，前端在 Markdown 编辑器中插入 ![](url)
 */
router.post('/image', authMiddleware, imageUpload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请选择图片' });
  res.json({ url: '/data/images/' + req.file.filename });
});

module.exports = router;