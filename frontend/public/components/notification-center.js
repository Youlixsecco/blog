/**
 * 通知中心组件
 *
 * 职责：
 *   渲染导航栏中的通知铃铛入口，管理通知弹窗的显示/隐藏
 *   实时轮询未读通知数量，点击通知可导航到对应文章/评论
 *
 * 交互流程：
 *   1. 页面初始化 → init() 渲染铃铛 → 开始 30 秒轮询未读数
 *   2. 点击铃铛 → 展开/收起通知弹窗 → 加载通知列表
 *   3. 点击通知项 → 标记已读 → 关闭弹窗 → 跳转文章详情页
 *   4. 点击「全部已读」→ 标记所有通知已读 → 刷新列表
 *
 * 通知类型：
 *   - comment: 有人评论了你的文章
 *   - comment_reply: 有人回复了你的评论
 *
 * 点击弹窗外部区域自动关闭（通过全局 click 事件监听）
 *
 * @dependency ArticleCard.escape 用于 HTML 转义
 * @dependency API 请求模块
 * @dependency Router 路由模块
 */
const NotificationCenter = {

  /**
   * 初始化通知中心
   *
   * 挂载到导航栏 #notification-container 中，
   * 渲染铃铛图标和通知弹窗，开始 30 秒轮询未读数量
   */
  init() {
    const container = document.getElementById('notification-container');
    if (!container) return;
    this.container = container;
    this.render();
    this.loadUnreadCount();
    // 每 30 秒轮询一次未读通知数
    setInterval(() => this.loadUnreadCount(), 30000);
  },

  /**
   * 渲染通知铃铛和弹窗 DOM
   *
   * 绑定事件：
   *   - 铃铛点击：切换弹窗显示/隐藏
   *   - 全局点击：点击弹窗外部时关闭弹窗
   *   - 全部已读按钮：标记所有通知为已读
   */
  render() {
    this.container.innerHTML = `
      <div class="notification-bell" id="notification-bell">
        🔔<span class="notification-badge" id="notification-badge" style="display:none">0</span>
      </div>
      <div class="notification-popup" id="notification-popup" style="display:none">
        <div class="notification-header">
          <span>通知</span>
          <button class="btn-sm" id="mark-all-read">全部已读</button>
        </div>
        <div class="notification-list" id="notification-list">
          <p class="text-muted">加载中...</p>
        </div>
      </div>
    `;

    // 铃铛点击：切换弹窗显示/隐藏，首次展开时加载通知列表
    document.getElementById('notification-bell').addEventListener('click', (e) => {
      e.stopPropagation();
      const popup = document.getElementById('notification-popup');
      const isVisible = popup.style.display === 'block';
      popup.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) this.loadNotifications();
    });

    // 全局点击：点击弹窗外部区域时自动关闭弹窗
    document.addEventListener('click', (e) => {
      const popup = document.getElementById('notification-popup');
      if (popup && !this.container.contains(e.target)) {
        popup.style.display = 'none';
      }
    });

    // 全部已读：标记所有通知为已读后刷新未读数和列表
    document.getElementById('mark-all-read').addEventListener('click', async () => {
      try {
        await API.put('/notifications/read-all');
        this.loadUnreadCount();
        this.loadNotifications();
      } catch (e) { /* ignore */ }
    });
  },

  /**
   * 加载未读通知数量
   *
   * 更新铃铛上的红色徽章数字，超过 99 显示为「99+」
   * 未读数为 0 时隐藏徽章
   */
  async loadUnreadCount() {
    if (!State.isLoggedIn()) return;
    try {
      const { count } = await API.get('/notifications/unread-count');
      const badge = document.getElementById('notification-badge');
      if (badge) {
        badge.style.display = count > 0 ? 'flex' : 'none';
        badge.textContent = count > 99 ? '99+' : count;
      }
    } catch (e) { /* ignore */ }
  },

  /**
   * 加载通知列表并渲染到弹窗中
   *
   * 每条通知展示：
   *   - 发送者头像/首字母
   *   - 用户名 + 操作描述（评论/回复）
   *   - 评论内容预览（截断引号包裹）
   *   - 文章标题 + 相对时间
   *
   * 点击通知项：
   *   标记为已读 → 关闭弹窗 → 跳转到文章详情页
   *   如果是评论回复，通过 ?scroll=commentId 参数滚动到对应评论
   */
  async loadNotifications() {
    if (!State.isLoggedIn()) return;
    const list = document.getElementById('notification-list');
    if (!list) return;
    try {
      const notifications = await API.get('/notifications');
      if (notifications.length === 0) {
        list.innerHTML = '<p class="text-muted" style="padding:16px;text-align:center">暂无通知</p>';
        return;
      }
      list.innerHTML = notifications.map(n => {
        const typeLabel = n.type === 'comment_reply' ? '回复了你的评论' : '评论了你的文章';
        const time = this.formatTime(n.createdAt);
        return `
          <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}" data-article-id="${n.articleId}" data-comment-id="${n.commentId || ''}">
            <div class="notification-avatar">
              ${n.fromUser.avatar
                ? `<img src="${n.fromUser.avatar}" alt="">`
                : `<span class="avatar-text-sm">${(n.fromUser.username || '?')[0]}</span>`
              }
            </div>
            <div class="notification-body">
              <div class="notification-text">
                <strong>${ArticleCard.escape(n.fromUser.username)}</strong> ${typeLabel}
              </div>
              <div class="notification-preview">"${ArticleCard.escape(n.content)}"</div>
              <div class="notification-meta">
                <span>${ArticleCard.escape(n.articleTitle)}</span>
                <span>·</span>
                <span>${time}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // 绑定通知项点击：标记已读 → 导航到对应文章/评论
      list.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async () => {
          const id = item.dataset.id;
          const articleId = item.dataset.articleId;
          const commentId = item.dataset.commentId;
          try {
            await API.put('/notifications/' + id + '/read');
            this.loadUnreadCount();
          } catch (e) { /* ignore */ }
          document.getElementById('notification-popup').style.display = 'none';
          // 如果是回复通知，带上 scroll 参数定位到对应评论
          const url = commentId
            ? '/article/' + articleId + '?scroll=' + commentId
            : '/article/' + articleId;
          Router.navigate(url);
        });
      });
    } catch (e) {
      list.innerHTML = '<p class="text-muted">加载失败</p>';
    }
  },

  /**
   * 格式化相对时间
   *
   * 规则：
   *   - 1 分钟内 → 「刚刚」
   *   - 1 小时内 → 「X 分钟前」
   *   - 24 小时内 → 「X 小时前」
   *   - 7 天内   → 「X 天前」
   *   - 超过 7 天 → 显示完整日期
   *
   * @param {string} dateStr - ISO 日期字符串
   * @returns {string} 格式化后的相对时间文本
   */
  formatTime(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return minutes + '分钟前';
    if (hours < 24) return hours + '小时前';
    if (days < 7) return days + '天前';
    return date.toLocaleDateString('zh-CN');
  }
};