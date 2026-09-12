/**
 * 导航栏组件
 *
 * 职责：
 *   渲染全局顶部导航栏，包含 Logo、搜索框、用户区域、通知入口
 *
 * 显示逻辑：
 *   - 未登录 → 显示「登录」链接
 *   - 游客   → 显示「👤 游客」+「登录」链接
 *   - 正式用户 → 显示「👤 用户名」+「退出」+ 通知铃铛
 *
 * 搜索功能：
 *   输入关键词 → 回车 → 跳转 /?search=xxx → HomePage 重新渲染文章列表
 *
 * 通知入口：
 *   仅正式用户显示 NotificationCenter 组件（铃铛 + 未读徽章 + 下拉弹窗）
 */

const Navbar = {
  init() {
    this.render();
  },

  render() {
    const user = State.user;
    const nav = document.getElementById('navbar');
    nav.innerHTML = `
      <div class="nav-inner">
        <a class="nav-logo" data-link="/">📝 Blog</a>
        <div class="nav-search">
          <input type="text" id="nav-search-input" placeholder="搜索文章..." />
        </div>
        <div class="nav-links">
          ${user && !State.isGuest()
            ? `<div id="notification-container"></div>`
            : ''
          }
          ${user
            ? `<a class="nav-link" data-link="/account">👤 ${user.username}</a>
               ${State.isGuest()
                 ? '<a class="nav-link" data-link="/login">登录</a>'
                 : '<a class="nav-link" href="#" id="nav-logout">退出</a>'
               }`
            : `<a class="nav-link" data-link="/login">登录</a>`
          }
        </div>
      </div>
    `;

    // 搜索框：回车触发搜索
    const searchInput = document.getElementById('nav-search-input');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const keyword = searchInput.value.trim();
          Router.navigate('/?search=' + encodeURIComponent(keyword));
        }
      });
    }

    // 退出按钮：清除登录态
    const logoutBtn = document.getElementById('nav-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        State.logout();
      });
    }

    // 正式用户初始化通知中心（铃铛 + 轮询）
    if (user && !State.isGuest()) {
      NotificationCenter.init();
    }
  }
};