/**
 * SPA 路由模块
 *
 * 职责：
 *   实现前端单页路由，基于 pushState + popstate，无需 hash
 *
 * 方法：
 *   Router.register(path, handler)  - 注册路由（handler 接收 container 和动态参数）
 *   Router.navigate(path)           - 导航到指定路径（触发 pushState）
 *   Router.resolve()                - 解析当前 URL 并渲染对应页面
 *   Router.init()                   - 启动路由（监听 popstate + 首次解析）
 *
 * 路由规则：
 *   /              → HomePage
 *   /login         → LoginPage
 *   /article/:id   → ArticleDetailPage（动态参数 id）
 *   /account       → AccountPage（需登录，未登录重定向 /login）
 *   /author/:id    → AuthorPage（动态参数 id）
 *   其他           → 404 页面
 *
 * 全局事件委托：
 *   app.js 中监听 document click，所有 [data-link] 元素自动触发 Router.navigate
 */

const Router = {
  routes: {},
  currentPage: null,

  register(path, handler) {
    this.routes[path] = handler;
  },

  navigate(path) {
    history.pushState(null, '', path);
    this.resolve();
  },

  resolve() {
    const path = location.pathname;
    const main = document.getElementById('main-content');

    // 登录页
    if (path === '/login') {
      if (this.routes['/login']) this.routes['/login'](main);
      return;
    }

    // 账户页：需登录态
    if (path === '/account' || path.startsWith('/account/')) {
      if (!State.user) { this.navigate('/login'); return; }
      if (this.routes['/account']) this.routes['/account'](main);
      return;
    }

    // 文章详情页：动态参数 /article/:id
    if (path.startsWith('/article/')) {
      const articleId = path.split('/')[2];
      if (this.routes['/article/:id']) this.routes['/article/:id'](main, articleId);
      return;
    }

    // 作者页：动态参数 /author/:id
    if (path.startsWith('/author/')) {
      const authorId = path.split('/')[2];
      if (this.routes['/author/:id']) this.routes['/author/:id'](main, authorId);
      return;
    }

    // 首页
    if (path === '/' || path === '') {
      if (this.routes['/']) this.routes['/'](main);
      return;
    }

    // 404
    main.innerHTML = '<div class="page-404"><h1>404</h1><p>页面不存在</p></div>';
  },

  init() {
    // 监听浏览器前进/后退按钮
    window.addEventListener('popstate', () => this.resolve());
    this.resolve();
  }
};