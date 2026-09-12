/**
 * 应用入口模块
 *
 * 启动流程：
 *   1. State.init()   - 恢复 localStorage 登录态
 *   2. 若无登录态 → 自动调用游客登录 API → 设置 State
 *   3. 注册 5 个路由（/ /login /article/:id /account /author/:id）
 *   4. 注册全局 [data-link] 点击事件委托
 *   5. Navbar.init()  - 渲染导航栏
 *   6. Router.init()  - 首次路由解析，渲染对应页面
 *
 * 全局事件委托：
 *   所有带 data-link 属性的元素点击后，自动调用 Router.navigate()
 *   如：<span data-link="/article/xxx"> → 跳转文章详情
 *        <span data-link="/author/xxx"> → 跳转作者页
 */

(async function init() {
  State.init();

  // 首次访问无登录态 → 自动游客登录
  if (!State.user) {
    try {
      const data = await API.get('/auth/guest');
      State.setAuth(data.token, data.user);
    } catch (e) {
      // 游客登录失败，降级到登录页
      Router.register('/login', (container) => LoginPage.render(container));
      Router.register('/', (container) => LoginPage.render(container));
      Router.init();
      return;
    }
  }

  // 注册路由
  Router.register('/login', (container) => LoginPage.render(container));
  Router.register('/', (container) => HomePage.render(container));
  Router.register('/article/:id', (container, id) => ArticleDetailPage.render(container, id));
  Router.register('/account', (container) => AccountPage.render(container));
  Router.register('/author/:id', (container, id) => AuthorPage.render(container, id));

  // 全局事件委托：所有 data-link 元素自动触发 SPA 导航
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-link]');
    if (link) {
      e.preventDefault();
      Router.navigate(link.getAttribute('data-link'));
    }
  });

  Navbar.init();
  Router.init();
})();