/**
 * 登录/注册页面
 *
 * 职责：
 *   提供用户登录、注册和游客登录三种身份认证入口
 *   通过 Tab 切换在登录表单和注册表单之间切换
 *
 * 页面结构：
 *   - 登录 Tab（默认）：用户名 + 密码输入框 → 登录按钮
 *   - 注册 Tab：用户名 + 密码 + 确认密码 → 注册按钮
 *   - 分隔线 + 游客登录按钮（一键登录，无需填写信息）
 *
 * 登录/注册成功后的流程：
 *   1. 调用 State.setAuth 保存 token 和用户信息到 localStorage
 *   2. 刷新 Navbar（更新导航栏用户区域）
 *   3. 跳转到首页
 *
 * 校验规则：
 *   - 登录：用户名和密码均不能为空
 *   - 注册：密码需二次确认，两次输入必须一致
 *
 * @dependency API 请求模块
 * @dependency State 状态管理
 * @dependency Navbar 导航栏组件
 * @dependency Router 路由模块
 * @dependency Toast 提示组件
 */
const LoginPage = {

  /**
   * 渲染登录页面
   *
   * @param {HTMLElement} container - 页面容器元素
   */
  render(container) {
    container.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <h2>📝 Blog</h2>
          <div class="login-tabs">
            <button class="login-tab active" data-tab="login">登录</button>
            <button class="login-tab" data-tab="register">注册</button>
          </div>
          <div id="login-form">
            <div class="form-group">
              <input type="text" id="login-username" placeholder="用户名" />
            </div>
            <div class="form-group">
              <input type="password" id="login-password" placeholder="密码" />
            </div>
            <button class="btn btn-primary btn-block" id="login-submit">登录</button>
          </div>
          <div id="register-form" style="display:none">
            <div class="form-group">
              <input type="text" id="reg-username" placeholder="用户名" />
            </div>
            <div class="form-group">
              <input type="password" id="reg-password" placeholder="密码" />
            </div>
            <div class="form-group">
              <input type="password" id="reg-password2" placeholder="确认密码" />
            </div>
            <button class="btn btn-primary btn-block" id="register-submit">注册</button>
          </div>
          <div class="login-divider"><span>或</span></div>
          <button class="btn btn-outline btn-block" id="guest-login">游客登录</button>
        </div>
      </div>
    `;

    // Tab 切换：登录 ↔ 注册表单
    const tabs = container.querySelectorAll('.login-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const isLogin = tab.dataset.tab === 'login';
        document.getElementById('login-form').style.display = isLogin ? 'block' : 'none';
        document.getElementById('register-form').style.display = isLogin ? 'none' : 'block';
      });
    });

    // 登录提交：校验 → 调用 API → 保存状态 → 刷新导航栏 → 跳转首页
    document.getElementById('login-submit').addEventListener('click', async () => {
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value.trim();
      if (!username || !password) { Toast.show('请输入用户名和密码'); return; }
      try {
        const data = await API.post('/auth/login', { username, password });
        State.setAuth(data.token, data.user);
        Navbar.render();
        Router.navigate('/');
      } catch (e) { Toast.show(e.message); }
    });

    // 注册提交：校验两次密码一致性 → 调用 API → 保存状态 → 跳转首页
    document.getElementById('register-submit').addEventListener('click', async () => {
      const username = document.getElementById('reg-username').value.trim();
      const password = document.getElementById('reg-password').value.trim();
      const password2 = document.getElementById('reg-password2').value.trim();
      if (!username || !password) { Toast.show('请输入用户名和密码'); return; }
      if (password !== password2) { Toast.show('两次密码不一致'); return; }
      try {
        const data = await API.post('/auth/register', { username, password });
        State.setAuth(data.token, data.user);
        Navbar.render();
        Router.navigate('/');
      } catch (e) { Toast.show(e.message); }
    });

    // 游客登录：无需输入，直接调用后端获取游客身份的 token
    document.getElementById('guest-login').addEventListener('click', async () => {
      try {
        const data = await API.get('/auth/guest');
        State.setAuth(data.token, data.user);
        Navbar.render();
        Router.navigate('/');
      } catch (e) { Toast.show(e.message); }
    });
  }
};