/**
 * 作者主页
 *
 * 职责：
 *   展示其他用户的公开信息页面，包括个人资料、统计数据和文章列表
 *   支持关注/取消关注操作
 *
 * 页面结构：
 *   - 头部：头像 + 用户名 + 关注按钮（自己访问时不显示）
 *   - 统计卡片：文章数 / 获赞数 / 被收藏数 / 关注者数
 *   - 文章列表：该用户发布的所有文章
 *
 * 权限控制：
 *   - 未登录 → 可查看页面，点击关注时提示登录
 *   - 已登录 + 访问自己 → 不显示关注按钮（避免自己关注自己）
 *   - 已登录 + 访问他人 → 显示关注/取消关注按钮
 *
 * 关注按钮状态：
 *   - 未关注 → 显示「+ 关注」（btn-primary 样式）
 *   - 已关注 → 显示「已关注」（btn-outline 样式）
 *   - 点击切换 → 调用 API → 即时更新按钮文字和样式
 *
 * @dependency API 请求模块
 * @dependency ArticleCard 文章卡片组件
 * @dependency Toast 提示组件
 */
const AuthorPage = {

  /**
   * 渲染作者主页
   *
   * @param {HTMLElement} container - 页面容器元素
   * @param {string}      authorId  - 作者用户 ID
   */
  async render(container, authorId) {
    container.innerHTML = '<div class="author-page"><p>加载中...</p></div>';

    try {
      const profile = await API.get('/users/profile/' + authorId);
      const articles = await API.get('/articles?authorId=' + authorId);
      const avatarChar = profile.username ? profile.username[0] : '?';

      // 获取当前用户与该作者的关注关系（自己访问自己时不查询）
      let followStatus = { followed: false };
      if (State.isLoggedIn() && State.user.id !== authorId) {
        try {
          followStatus = await API.get('/follows/status?targetUserId=' + authorId);
        } catch (e) { /* ignore */ }
      }

      container.innerHTML = `
        <div class="author-page">
          <div class="author-header">
            <div class="author-avatar">
              ${profile.avatar
                ? `<img src="${profile.avatar}" alt="avatar" />`
                : `<span class="avatar-text">${avatarChar}</span>`
              }
            </div>
            <div class="author-info">
              <h2>${ArticleCard.escape(profile.username)}</h2>
              ${State.isLoggedIn() && State.user.id !== authorId ? `
                <button class="btn ${followStatus.followed ? 'btn-outline' : 'btn-primary'} follow-btn" id="follow-btn">
                  ${followStatus.followed ? '已关注' : '+ 关注'}
                </button>
              ` : ''}
            </div>
          </div>
          <div class="author-stats">
            <div class="stat-card">
              <div class="stat-num">${profile.articleCount}</div>
              <div class="stat-label">文章</div>
            </div>
            <div class="stat-card">
              <div class="stat-num">${profile.likeCount}</div>
              <div class="stat-label">获赞</div>
            </div>
            <div class="stat-card">
              <div class="stat-num">${profile.bookmarkCount}</div>
              <div class="stat-label">被收藏</div>
            </div>
            <div class="stat-card">
              <div class="stat-num">${profile.followerCount}</div>
              <div class="stat-label">关注者</div>
            </div>
          </div>
          <h3>文章列表</h3>
          <div class="article-list">
            ${articles.length === 0 ? '<p class="text-muted">暂无文章</p>' : articles.map(a => ArticleCard.render(a)).join('')}
          </div>
        </div>
      `;

      // 关注/取消关注按钮：切换状态并即时更新按钮样式
      const followBtn = container.querySelector('#follow-btn');
      if (followBtn) {
        followBtn.addEventListener('click', async () => {
          if (!State.isLoggedIn()) { Toast.show('请先登录'); return; }
          try {
            const res = await API.post('/follows/toggle', { targetUserId: authorId });
            followBtn.textContent = res.followed ? '已关注' : '+ 关注';
            followBtn.className = 'btn ' + (res.followed ? 'btn-outline' : 'btn-primary') + ' follow-btn';
          } catch (e) { Toast.show(e.message); }
        });
      }
    } catch (e) {
      container.innerHTML = '<div class="author-page"><p class="text-muted">加载失败</p></div>';
    }
  }
};