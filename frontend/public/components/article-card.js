/**
 * 文章卡片组件
 *
 * 职责：
 *   渲染文章列表中的单篇文章卡片，展示标题、作者、日期、统计数据
 *
 * 方法：
 *   ArticleCard.render(article)  - 返回 HTML 字符串
 *   ArticleCard.escape(str)      - HTML 转义，防止 XSS 攻击
 *
 * 交互：
 *   整个卡片可点击 → data-link 跳转文章详情
 *   作者名可点击 → data-link 跳转作者页（onclick.stopPropagation 防止触发卡片跳转）
 *
 * 显示字段：
 *   - 标题
 *   - 作者头像 + 用户名
 *   - 发布日期
 *   - 👁 阅读量 / ❤ 点赞数 / 💬 评论数 / ⭐ 收藏数
 */

const ArticleCard = {
  render(article) {
    const date = new Date(article.createdAt).toLocaleDateString('zh-CN');
    return `
      <div class="article-card" data-link="/article/${article.id}">
        <h3 class="article-card-title">${this.escape(article.title)}</h3>
        <div class="article-card-meta">
          <span class="article-card-author" data-link="/author/${article.author.id}" onclick="event.stopPropagation()">
            <span class="avatar-sm">${article.author.avatar ? `<img src="${article.author.avatar}" alt="">` : (article.author.username || '?')[0]}</span>
            ${this.escape(article.author.username)}
          </span>
          <span>${date}</span>
          <span>👁 ${article.views || 0}</span>
          <span>❤ ${article.likeCount || 0}</span>
          <span>💬 ${article.commentCount || 0}</span>
          <span>⭐ ${article.bookmarkCount || 0}</span>
        </div>
      </div>
    `;
  },

  /**
   * HTML 转义
   * 将用户输入转义为安全文本，防止 XSS 注入
   */
  escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};