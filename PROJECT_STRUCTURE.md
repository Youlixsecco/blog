# Blog 项目结构文档

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 后端框架 | Express.js (Node.js) | HTTP 服务 + 路由 |
| 数据库 | SQLite (better-sqlite3) | 零配置嵌入式数据库 |
| 认证 | JWT (jsonwebtoken) | 游客/正式用户双模式 |
| 密码加密 | bcryptjs | 哈希加盐 |
| 文件上传 | multer | 图片/头像/Markdown 文件 |
| Markdown | marked | 服务端 & 客户端双端渲染 |
| 前端 | 原生 JavaScript | 零框架 SPA |

---

## 目录结构

```
blog/
├── start.bat                          # Windows 一键启动脚本（双击运行）
├── start.ps1                          # PowerShell 一键启动脚本
├── blog.xmind                         # 原始需求文档
├── PROJECT_STRUCTURE.md               # 本文档
│
├── backend/                           # 后端服务
│   ├── package.json                   # 依赖配置
│   ├── data/                          # 数据存储
│   │   ├── blog.db                    # SQLite 数据库文件
│   │   ├── blog.db-shm                # SQLite WAL 共享内存
│   │   ├── blog.db-wal                # SQLite WAL 日志
│   │   └── images/                    # 文章配图存储
│   │       └── *.png
│   ├── uploads/                       # 头像 & Markdown 文件上传
│   │   └── *.jpeg, *.md
│   └── src/
│       ├── app.js                     # 主入口，Express 配置
│       ├── middleware/
│       │   ├── auth.js                # JWT 认证中间件（必须/可选）
│       │   └── db.js                  # SQLite 数据库初始化 + 工具函数
│       └── routes/
│           ├── auth.js                # 注册 / 登录 / 游客登录
│           ├── articles.js            # 文章 CRUD + 搜索
│           ├── comments.js            # 评论 / 回复 / 筛选
│           ├── likes.js               # 点赞 / 取消点赞
│           ├── bookmarks.js           # 收藏 / 取消收藏
│           ├── follows.js             # 关注 / 取消关注
│           ├── users.js               # 用户资料 / 个人信息 / 改密 / 注销
│           ├── upload.js              # 头像 / 图片 / Markdown 文件上传
│           └── notifications.js       # 通知列表 / 未读数 / 已读标记
│
└── frontend/                          # 前端 SPA
    └── public/
        ├── index.html                 # 入口 HTML
        ├── css/
        │   └── style.css              # 全局样式（约 1090 行）
        ├── js/
        │   ├── app.js                 # 应用入口，路由注册
        │   ├── router.js              # SPA 路由（pushState + popstate）
        │   ├── api.js                 # fetch API 封装
        │   ├── state.js               # 用户状态管理（localStorage）
        │   ├── upload-helper.js       # 图片上传工具（光标插入）
        │   └── marked.min.js          # Markdown 客户端渲染库
        ├── components/
        │   ├── navbar.js              # 全局导航栏 + 搜索 + 通知入口
        │   ├── article-card.js        # 文章卡片组件
        │   ├── comment-list.js        # 评论列表（树形嵌套 + 事件绑定）
        │   ├── notification-center.js # 通知铃铛 + 下拉弹窗
        │   ├── modal.js               # 通用弹窗组件
        │   └── toast.js               # Toast 提示组件
        └── pages/
            ├── login.js               # 登录 / 注册 / 游客登录
            ├── home.js                # 首页文章列表
            ├── article-detail.js      # 文章详情（阅读/编辑/删除）
            ├── account.js             # 账户主页（信息/文章/收藏/点赞/改密/注销）
            └── author.js              # 作者页面（关注/统计/文章列表）
```

---

## 数据库表结构

### users（用户表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| username | TEXT UNIQUE | 用户名 |
| password | TEXT | bcrypt 加密 |
| avatar | TEXT | 头像路径，如 `/uploads/xxx.jpeg` |
| createdAt | TEXT | ISO 时间戳 |

### articles（文章表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| title | TEXT | 标题 |
| content | TEXT | Markdown 内容 |
| authorId | TEXT FK | 作者 → users.id |
| views | INTEGER | 阅读量 |
| createdAt | TEXT | 创建时间 |
| updatedAt | TEXT | 更新时间 |

### comments（评论表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| articleId | TEXT FK | 所属文章 → articles.id |
| userId | TEXT FK | 评论者 → users.id |
| content | TEXT | 评论内容 |
| parentId | TEXT FK | 父评论 → comments.id（NULL=顶层） |
| createdAt | TEXT | 创建时间 |

### likes（点赞表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| userId | TEXT FK | 点赞者 → users.id |
| articleId | TEXT FK | 所属文章 → articles.id |
| commentId | TEXT FK | 评论点赞 → comments.id（NULL=文章点赞） |
| createdAt | TEXT | 创建时间 |

### bookmarks（收藏表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| userId | TEXT FK | 收藏者 → users.id |
| articleId | TEXT FK | 文章 → articles.id |
| createdAt | TEXT | 创建时间 |

### follows（关注表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增 |
| userId | TEXT FK | 关注者 → users.id |
| targetUserId | TEXT FK | 被关注者 → users.id |
| createdAt | TEXT | 创建时间 |

### notifications（通知表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| userId | TEXT FK | 接收者 → users.id |
| type | TEXT | `comment_reply` / `article_comment` |
| articleId | TEXT FK | 关联文章 → articles.id |
| commentId | TEXT | 关联评论 ID |
| fromUserId | TEXT FK | 触发者 → users.id |
| content | TEXT | 内容预览（50字截断） |
| read | INTEGER | 0=未读, 1=已读 |
| createdAt | TEXT | 创建时间 |

---

## API 接口清单

### 认证 (`/api/auth`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/register` | 无 | 用户注册 |
| POST | `/login` | 无 | 账号密码登录 |
| POST | `/guest` | 无 | 游客登录 |

### 文章 (`/api/articles`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/` | 无 | 文章列表（支持 `?search=` & `?authorId=`） |
| GET | `/:id` | 无 | 文章详情（自动 +1 阅读量） |
| POST | `/` | 必须 | 新建文章 |
| PUT | `/:id` | 必须 | 编辑文章（仅作者） |
| DELETE | `/:id` | 必须 | 删除文章（仅作者，清理图片+评论+点赞+收藏） |

### 评论 (`/api/comments`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/` | 无 | 获取评论（`?articleId=` & `?filter=author/author_liked` & `?sort=latest/hottest`） |
| POST | `/` | 必须 | 发表评论/回复（自动生成通知） |

### 点赞 (`/api/likes`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/toggle` | 必须 | 切换点赞状态（文章/评论） |
| GET | `/status` | 可选 | 查询点赞状态（`?articleId=` & `?commentId=`） |
| GET | `/user-likers` | 必须 | 谁赞过我的文章 |

### 收藏 (`/api/bookmarks`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/toggle` | 必须 | 切换收藏状态 |
| GET | `/status` | 可选 | 查询收藏状态（`?articleId=`） |
| GET | `/my` | 必须 | 我的收藏列表 |
| GET | `/stargazers/:userId` | 无 | 用户收藏者列表 |

### 关注 (`/api/follows`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/toggle` | 必须 | 切换关注状态 |
| GET | `/status/:targetUserId` | 可选 | 查询关注状态 |
| GET | `/following/:userId` | 无 | 关注列表 |
| GET | `/followers/:userId` | 无 | 粉丝列表 |

### 用户 (`/api/users`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/me` | 必须 | 当前用户信息 |
| GET | `/profile/:id` | 无 | 用户公开资料（含统计） |
| PUT | `/profile` | 必须 | 编辑用户名 |
| PUT | `/password` | 必须 | 修改密码 |
| GET | `/liked-articles` | 必须 | 我赞过的文章 |
| DELETE | `/me` | 必须 | 注销账号（密码验证 → 清理所有数据） |

### 上传 (`/api/upload`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| POST | `/avatar` | 必须 | 上传头像（任意格式） |
| POST | `/markdown` | 必须 | 上传 Markdown 文件 |
| POST | `/image` | 必须 | 上传文章图片（仅图片格式） |

### 通知 (`/api/notifications`)

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/` | 必须 | 通知列表（含发信人信息） |
| GET | `/unread-count` | 必须 | 未读数量 |
| PUT | `/:id/read` | 必须 | 标记单条已读 |
| PUT | `/read-all` | 必须 | 全部已读 |

---

## 前端架构

### SPA 路由

基于 `pushState` + `popstate` 的无刷新路由：

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | HomePage | 首页文章列表 |
| `/login` | LoginPage | 登录/注册 |
| `/article/:id` | ArticleDetailPage | 文章详情 |
| `/account` | AccountPage | 账户主页 |
| `/author/:id` | AuthorPage | 作者页面 |

### 组件系统

所有组件和页面均为对象字面量模式（`{ render, init, ... }`），通过 `Router` 调度渲染。

### 页面加载流程

```
index.html 加载
  → app.js: State.init() 恢复登录态
  → Router.init() 监听 popstate
  → Navbar.init() 渲染导航栏
  → NotificationCenter.init() 启动通知轮询
  → 匹配当前 URL → 调用对应 Page.render(container)
```

### 通知系统

```
发表评论
  → comments.js 调用 createNotification()
  → notifications 表插入记录
  → 前端 NotificationCenter 30s 轮询 /api/notifications/unread-count
  → 铃铛红色徽章显示未读数
  → 点击通知 → 标记已读 → 跳转文章 + 滚动定位到评论
```

---

## 启动方式

### 方式一：双击启动

```
双击 start.bat  →  自动检测 Node.js  →  自动安装依赖  →  启动服务器  →  打开浏览器
```

### 方式二：命令行

```bash
cd backend
npm install
npm start
```

访问 **http://localhost:3000**

---

## 调试数据库

### VS Code 插件

安装 **SQLite Viewer** 插件，直接打开 `backend/data/blog.db` 即可查看和编辑。

### 命令行

```bash
cd backend
npx sqlite3 data/blog.db
```

```sql
.tables                    -- 查看所有表
.schema users              -- 查看 users 表结构
SELECT * FROM users;       -- 查看所有用户
SELECT COUNT(*) FROM comments;  -- 统计评论数
.quit                      -- 退出
```