/**
 * 个人中心页面
 *
 * 职责：
 *   用户个人主页，管理个人资料、文章、关注、收藏、点赞等内容
 *   支持头像上传、用户名修改、密码修改、新建文章、账号注销等操作
 *
 * 页面结构：
 *   - 头部：头像（可点击上传）+ 用户名 + 编辑/修改密码按钮
 *   - 工具栏：新建文章按钮 + 注销账号按钮
 *   - 统计卡片：文章数 / 获赞数 / 被收藏数 / 关注者数（点击可查看详细列表）
 *   - Tab 栏：我的文章 / 关注 / 收藏 / 点赞（切换不同内容列表）
 *
 * 权限控制：
 *   - 未登录 → 跳转登录页
 *   - 游客 → 提示「请先登录」
 *   - 正式用户 → 完整功能
 *
 * 我的文章 Tab：
 *   每篇文章卡片下方附带「删除」按钮，点击弹出确认 Modal
 *   删除后重新加载文章列表
 *
 * 关注 Tab：
 *   展示已关注用户列表，每项附带「取消关注」按钮
 *
 * 收藏/点赞 Tab：
 *   展示收藏或点赞的文章卡片列表
 *
 * 统计卡片点击：
 *   - 获赞 → 弹窗展示点赞用户列表
 *   - 被收藏 → 弹窗展示收藏用户列表
 *   - 关注者 → 弹窗展示关注者列表
 *
 * @dependency API 请求模块
 * @dependency ArticleCard 文章卡片组件
 * @dependency Modal 弹窗组件
 * @dependency Toast 提示组件
 * @dependency Navbar 导航栏组件
 * @dependency State 状态管理
 * @dependency Router 路由模块
 */
const AccountPage = {

  /** 当前选中的 Tab，默认「我的文章」 */
  currentTab: 'articles',

  /**
   * 渲染个人中心页面
   *
   * @param {HTMLElement} container - 页面容器元素
   */
  async render(container) {
    if (!State.user) { Router.navigate('/login'); return; }
    if (State.isGuest()) {
      container.innerHTML = '<div class="account-page"><p class="text-muted text-center">游客请先<a data-link="/login" href="#">登录</a></p></div>';
      return;
    }

    container.innerHTML = '<div class="account-page"><p>加载中...</p></div>';

    try {
      const profile = await API.get('/users/profile/' + State.user.id);
      const avatarChar = profile.username ? profile.username[0] : '?';

      container.innerHTML = `
        <div class="account-page">
          <div class="account-header">
            <div class="account-avatar" id="avatar-upload-area">
              ${profile.avatar
                ? `<img src="${profile.avatar}" alt="avatar" />`
                : `<span class="avatar-text">${avatarChar}</span>`
              }
              <div class="avatar-overlay">更换头像</div>
            </div>
            <input type="file" id="avatar-input" accept="image/*" style="display:none" />
            <div class="account-name">
              <span id="username-display">${ArticleCard.escape(profile.username)}</span>
              <button class="btn-sm" id="edit-username">编辑</button>
              <button class="btn-sm" id="change-password">修改密码</button>
            </div>
          </div>
          <div class="account-toolbar">
            <button class="btn btn-primary" id="new-article-btn">📝 新建文章</button>
            <button class="btn btn-danger btn-sm" id="btn-delete-account">注销账号</button>
          </div>
          <div class="account-stats">
            <div class="stat-card" id="stat-articles">
              <div class="stat-num">${profile.articleCount}</div>
              <div class="stat-label">文章</div>
            </div>
            <div class="stat-card" id="stat-likes">
              <div class="stat-num">${profile.likeCount}</div>
              <div class="stat-label">获赞</div>
            </div>
            <div class="stat-card" id="stat-bookmarks">
              <div class="stat-num">${profile.bookmarkCount}</div>
              <div class="stat-label">被收藏</div>
            </div>
            <div class="stat-card" id="stat-followers">
              <div class="stat-num">${profile.followerCount}</div>
              <div class="stat-label">关注者</div>
            </div>
          </div>
          <div class="account-tabs">
            <button class="account-tab active" data-tab="articles">我的文章</button>
            <button class="account-tab" data-tab="following">关注</button>
            <button class="account-tab" data-tab="bookmarks">收藏</button>
            <button class="account-tab" data-tab="liked">点赞</button>
          </div>
          <div class="account-tab-content" id="tab-content">
            <p>加载中...</p>
          </div>
          </div>
      `;

      this.bindEvents(container);
      await this.loadTab('articles');

      // Tab 切换：更新 active 状态并加载对应内容
      container.querySelectorAll('.account-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
          container.querySelectorAll('.account-tab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          this.currentTab = tab.dataset.tab;
          await this.loadTab(tab.dataset.tab);
        });
      });
    } catch (e) {
      container.innerHTML = '<div class="account-page"><p class="text-muted">加载失败</p></div>';
    }
  },

  /**
   * 绑定个人中心页面的所有交互事件
   *
   * 包含：头像上传、用户名编辑、密码修改、新建文章、账号注销、统计卡片点击
   *
   * @param {HTMLElement} container - 页面容器元素
   */
  bindEvents(container) {
    // 头像上传：点击头像区域触发文件选择，上传后更新用户信息
    const avatarArea = container.querySelector('#avatar-upload-area');
    const avatarInput = container.querySelector('#avatar-input');
    avatarArea.addEventListener('click', () => avatarInput.click());
    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('file', file);
      try {
        const res = await API.post('/upload/avatar', formData, true);
        await API.put('/users/profile', { avatar: res.url });
        State.user.avatar = res.url;
        localStorage.setItem('user', JSON.stringify(State.user));
        Navbar.render();
        Router.navigate('/account');
      } catch (e) { Toast.show(e.message); }
    });

    // 编辑用户名：弹出 Modal 输入新用户名
    container.querySelector('#edit-username').addEventListener('click', () => {
      Modal.show('修改用户名', `
        <div class="form-group">
          <input type="text" id="new-username" value="${State.user.username}" placeholder="新用户名" />
        </div>
      `, async () => {
        const newName = document.getElementById('new-username').value.trim();
        if (!newName) { Toast.show('用户名不能为空'); return; }
        try {
          await API.put('/users/profile', { username: newName });
          State.user.username = newName;
          localStorage.setItem('user', JSON.stringify(State.user));
          Navbar.render();
          Router.navigate('/account');
        } catch (e) { Toast.show(e.message); }
      });
    });

    // 修改密码：弹出 Modal 输入原密码、新密码、确认密码
    container.querySelector('#change-password').addEventListener('click', () => {
      Modal.show('修改密码', `
        <div class="form-group">
          <label>原密码</label>
          <input type="password" id="old-password" placeholder="输入原密码" />
        </div>
        <div class="form-group">
          <label>新密码</label>
          <input type="password" id="new-password" placeholder="输入新密码" />
        </div>
        <div class="form-group">
          <label>确认新密码</label>
          <input type="password" id="confirm-password" placeholder="再次输入新密码" />
        </div>
      `, async () => {
        const oldPassword = document.getElementById('old-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        if (!oldPassword || !newPassword || !confirmPassword) {
          Toast.show('请填写完整'); return;
        }
        if (newPassword !== confirmPassword) {
          Toast.show('两次新密码不一致'); return;
        }
        if (newPassword.length < 6) {
          Toast.show('新密码至少6位'); return;
        }
        try {
          await API.put('/users/password', { oldPassword, newPassword });
          Toast.show('密码修改成功');
        } catch (e) { Toast.show(e.message); }
      });
    });

    // 新建文章：弹出 Modal 支持标题 + Markdown 内容 + 图片上传 + .md 文件导入
    container.querySelector('#new-article-btn').addEventListener('click', () => {
      this.showNewArticleModal();
    });

    // 注销账号：弹出 Modal 要求输入密码确认，确认后删除所有数据并登出
    container.querySelector('#btn-delete-account').addEventListener('click', () => {
      Modal.show('注销账号', `
        <div class="form-group">
          <p style="margin-bottom:12px;color:var(--danger)">⚠ 注销后所有数据将被永久删除（文章、评论、点赞、收藏、关注），且无法恢复。</p>
          <label>请输入密码确认</label>
          <input type="password" id="delete-password" placeholder="输入密码" />
        </div>
      `, async () => {
        const password = document.getElementById('delete-password').value;
        if (!password) { Toast.show('请输入密码'); return; }
        try {
          await API.delete('/users/me', { password });
          Toast.show('账号已注销');
          State.logout();
        } catch (e) { Toast.show(e.message); }
      });
    });

    // 获赞统计卡片点击：弹窗展示点赞用户列表
    container.querySelector('#stat-likes').addEventListener('click', async () => {
      try {
        const likers = await API.get('/likes/user-likers');
        const list = likers.map(u => `<div class="user-list-item"><span class="avatar-sm">${u.avatar ? `<img src="${u.avatar}" alt="">` : (u.username || '?')[0]}</span> ${ArticleCard.escape(u.username)}</div>`).join('');
        Modal.show('点赞用户', '<div class="user-list">' + (list || '<p>暂无</p>') + '</div>');
      } catch (e) { /* ignore */ }
    });

    // 被收藏统计卡片点击：弹窗展示收藏用户列表
    container.querySelector('#stat-bookmarks').addEventListener('click', async () => {
      try {
        const stargazers = await API.get('/bookmarks/stargazers');
        const list = stargazers.map(u => `<div class="user-list-item"><span class="avatar-sm">${u.avatar ? `<img src="${u.avatar}" alt="">` : (u.username || '?')[0]}</span> ${ArticleCard.escape(u.username)}</div>`).join('');
        Modal.show('收藏用户', '<div class="user-list">' + (list || '<p>暂无</p>') + '</div>');
      } catch (e) { /* ignore */ }
    });

    // 关注者统计卡片点击：弹窗展示关注者列表
    container.querySelector('#stat-followers').addEventListener('click', async () => {
      try {
        const followers = await API.get('/follows/followers');
        const list = followers.map(u => `<div class="user-list-item"><span class="avatar-sm">${u.avatar ? `<img src="${u.avatar}" alt="">` : (u.username || '?')[0]}</span> ${ArticleCard.escape(u.username)}</div>`).join('');
        Modal.show('关注者', '<div class="user-list">' + (list || '<p>暂无</p>') + '</div>');
      } catch (e) { /* ignore */ }
    });
  },

  /**
   * 加载指定 Tab 的内容
   *
   * 支持的 Tab：
   *   - articles: 我的文章列表（含删除按钮）
   *   - following: 关注用户列表（含取消关注按钮）
   *   - bookmarks: 收藏文章列表
   *   - liked: 点赞文章列表
   *
   * @param {string} tab - Tab 名称
   */
  async loadTab(tab) {
    const content = document.getElementById('tab-content');
    try {
      let data = [];
      switch (tab) {
        case 'articles':
          data = await API.get('/articles?authorId=' + State.user.id);
          break;
        case 'following':
          data = await API.get('/follows/following');
          break;
        case 'bookmarks':
          data = await API.get('/bookmarks/my');
          break;
        case 'liked':
          data = await API.get('/users/liked-articles');
          break;
      }

      if (tab === 'following') {
        // 关注列表：每个用户附带「取消关注」按钮
        if (data.length === 0) {
          content.innerHTML = '<p class="text-muted">暂无关注</p>';
        } else {
          content.innerHTML = data.map(u => `
            <div class="follow-item">
              <span class="follow-user" data-link="/author/${u.id}">
                <span class="avatar-sm">${u.avatar ? `<img src="${u.avatar}" alt="">` : (u.username || '?')[0]}</span>
                ${ArticleCard.escape(u.username)}
              </span>
              <button class="btn-sm btn-danger unfollow-btn" data-user-id="${u.id}">取消关注</button>
            </div>
          `).join('');

          // 取消关注：调用 API 后刷新列表
          content.querySelectorAll('.unfollow-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              try {
                await API.post('/follows/toggle', { targetUserId: btn.dataset.userId });
                await this.loadTab('following');
              } catch (err) { Toast.show(err.message); }
            });
          });
        }
      } else {
        // 文章类 Tab：articles / bookmarks / liked
        if (data.length === 0) {
          content.innerHTML = '<p class="text-muted">暂无内容</p>';
        } else {
          content.innerHTML = data.map(item => {
            if (tab === 'following') return '';
            // 我的文章 Tab 额外附带「删除」按钮
            if (tab === 'articles') {
              return ArticleCard.render(item) + `
                <button class="btn-sm btn-danger delete-article-btn" data-article-id="${item.id}" style="margin-left:16px">删除</button>
                <hr style="margin:8px 0;opacity:0.1">
              `;
            }
            return ArticleCard.render(item) + '<hr style="margin:8px 0;opacity:0.1">';
          }).join('');

          // 删除文章：弹出确认 Modal，确认后调用 API 删除
          content.querySelectorAll('.delete-article-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              Modal.show('确认删除', '<p>确定要删除这篇文章吗？此操作不可恢复。</p>', async () => {
                try {
                  await API.delete('/articles/' + btn.dataset.articleId);
                  await this.loadTab('articles');
                  Toast.show('删除成功');
                } catch (err) { Toast.show(err.message); }
              });
            });
          });
        }
      }
    } catch (e) {
      content.innerHTML = '<p class="text-muted">加载失败</p>';
    }
  },

  /**
   * 显示新建文章弹窗
   *
   * 支持两种内容输入方式：
   *   1. 手动输入：标题 + Markdown 文本区域 + 图片上传按钮
   *   2. 文件导入：上传 .md 文件，自动读取内容填充到文本区域
   *
   * 提交时优先使用文件内容（如果上传了 .md 文件），
   * 否则使用手动输入的文本内容
   */
  showNewArticleModal() {
    Modal.show('新建文章', `
      <div class="form-group">
        <label>标题</label>
        <input type="text" id="new-article-title" placeholder="文章标题" />
      </div>
      <div class="form-group">
        <label>内容（支持 Markdown）</label>
        <textarea id="new-article-content" rows="10" placeholder="文章内容..."></textarea>
        <button type="button" class="btn-sm btn-upload-img" onclick="createImageUploader('new-article-content')">📷 上传图片</button>
      </div>
      <div class="form-group">
        <label>或上传 Markdown 文件</label>
        <input type="file" id="md-file-input" accept=".md,.markdown" />
      </div>
    `, async () => {
      const title = document.getElementById('new-article-title').value.trim();
      let content = document.getElementById('new-article-content').value.trim();
      const fileInput = document.getElementById('md-file-input');

      // 如果上传了 .md 文件，优先使用文件内容
      if (fileInput.files[0]) {
        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        try {
          const uploadRes = await API.post('/upload/markdown', formData, true);
          const res = await fetch(uploadRes.url);
          content = await res.text();
        } catch (e) { Toast.show('文件上传失败'); return; }
      }

      if (!title) { Toast.show('请输入标题'); return; }
      if (!content) { Toast.show('请输入内容或上传文件'); return; }

      try {
        await API.post('/articles', { title, content });
        Toast.show('文章发布成功');
        Router.navigate('/account');
      } catch (e) { Toast.show(e.message); }
    });
  }
};