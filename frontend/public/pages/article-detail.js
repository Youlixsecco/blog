/**
 * 文章详情页
 *
 * 职责：
 *   渲染单篇文章的完整内容，包括 Markdown 正文、点赞/收藏操作、评论区域
 *   支持文章作者编辑文章、通知跳转定位到指定评论
 *
 * 页面结构：
 *   - 标题 + 作者信息（头像、用户名、日期、阅读量）
 *   - Markdown 渲染的正文内容
 *   - 操作栏：点赞按钮 + 收藏按钮
 *   - 评论区域（由 CommentList 组件渲染）
 *
 * 特殊功能：
 *   - 编辑文章：仅作者可见「✏ 编辑」按钮，点击弹出 Modal 编辑标题和内容
 *   - 通知跳转：URL 参数 ?scroll=commentId → 滚动到对应评论并高亮
 *   - Markdown 渲染：优先使用 marked.js 解析，降级为纯文本换行
 *
 * 点赞/收藏交互：
 *   未登录点击 → Toast 提示「请先登录」
 *   已登录点击 → 调用 API 切换状态 → 即时更新按钮图标和计数
 *
 * @dependency API 请求模块
 * @dependency ArticleCard.escape 用于 HTML 转义
 * @dependency CommentList 评论列表组件
 * @dependency Modal 弹窗组件
 * @dependency Toast 提示组件
 */
const ArticleDetailPage = {

  /**
   * 渲染文章详情页
   *
   * @param {HTMLElement} container  - 页面容器元素
   * @param {string}      articleId  - 文章 ID
   */
  async render(container, articleId) {
    container.innerHTML = '<div class="article-detail-page"><p>加载中...</p></div>';

    try {
      const article = await API.get('/articles/' + articleId);
      const date = new Date(article.createdAt).toLocaleString('zh-CN');

      // 获取当前用户对文章的点赞和收藏状态
      let likeStatus = { liked: false };
      let bookmarkStatus = { bookmarked: false };
      if (State.isLoggedIn()) {
        try {
          const [l, b] = await Promise.all([
            API.get('/likes/status?articleId=' + articleId),
            API.get('/bookmarks/status?articleId=' + articleId)
          ]);
          likeStatus = l;
          bookmarkStatus = b;
        } catch (e) { /* ignore */ }
      }

      // 判断当前用户是否为文章作者（决定是否显示编辑按钮）
      const isAuthor = State.isLoggedIn() && State.user.id === article.author.id;

      container.innerHTML = `
        <div class="article-detail">
          <h1 class="article-title">${ArticleCard.escape(article.title)}</h1>
          <div class="article-meta">
            <span class="article-author" data-link="/author/${article.author.id}">
              <span class="avatar-sm">${article.author.avatar ? `<img src="${article.author.avatar}" alt="">` : (article.author.username || '?')[0]}</span>
              ${ArticleCard.escape(article.author.username)}
            </span>
            <span>${date}</span>
            <span>👁 ${article.views || 0}</span>
            ${isAuthor ? '<button class="btn-sm" id="btn-edit-article">✏ 编辑</button>' : ''}
          </div>
          <div class="article-content markdown-body">${this.renderMarkdown(article.content)}</div>
          <div class="article-actions">
            <button class="btn btn-action ${likeStatus.liked ? 'active' : ''}" id="btn-like">
              ${likeStatus.liked ? '❤' : '🤍'} <span id="like-count">${article.likeCount || 0}</span>
            </button>
            <button class="btn btn-action ${bookmarkStatus.bookmarked ? 'active' : ''}" id="btn-bookmark">
              ${bookmarkStatus.bookmarked ? '⭐' : '☆'} <span id="bookmark-count">${article.bookmarkCount || 0}</span>
            </button>
          </div>
          <div id="comment-section"></div>
        </div>
      `;

      // 渲染评论区
      const commentSection = await CommentList.render(articleId, article.authorId);
      container.querySelector('#comment-section').appendChild(commentSection);

      // 通知跳转：如果 URL 携带 ?scroll=commentId，滚动到对应评论并高亮
      const scrollToId = new URLSearchParams(location.search).get('scroll');
      if (scrollToId) {
        // 使用双重 requestAnimationFrame 确保 DOM 完全渲染后再滚动
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const target = document.getElementById('comment-' + scrollToId);
            if (target) {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              target.classList.add('comment-highlight');
              setTimeout(() => target.classList.remove('comment-highlight'), 2000);
            }
          });
        });
      }

      // 点赞按钮：切换状态并即时更新计数
      document.getElementById('btn-like').addEventListener('click', async () => {
        if (!State.isLoggedIn()) { Toast.show('请先登录'); return; }
        try {
          const res = await API.post('/likes/toggle', { articleId });
          const btn = document.getElementById('btn-like');
          const count = document.getElementById('like-count');
          btn.classList.toggle('active', res.liked);
          btn.innerHTML = `${res.liked ? '❤' : '🤍'} <span id="like-count">${parseInt(count.textContent) + (res.liked ? 1 : -1)}</span>`;
        } catch (e) { Toast.show(e.message); }
      });

      // 收藏按钮：切换状态并即时更新计数
      document.getElementById('btn-bookmark').addEventListener('click', async () => {
        if (!State.isLoggedIn()) { Toast.show('请先登录'); return; }
        try {
          const res = await API.post('/bookmarks/toggle', { articleId });
          const btn = document.getElementById('btn-bookmark');
          const count = document.getElementById('bookmark-count');
          btn.classList.toggle('active', res.bookmarked);
          btn.innerHTML = `${res.bookmarked ? '⭐' : '☆'} <span id="bookmark-count">${parseInt(count.textContent) + (res.bookmarked ? 1 : -1)}</span>`;
        } catch (e) { Toast.show(e.message); }
      });

      // 编辑按钮：仅作者可见，弹出 Modal 编辑标题和 Markdown 内容
      const editBtn = document.getElementById('btn-edit-article');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          Modal.show('编辑文章', `
            <div class="form-group">
              <label>标题</label>
              <input type="text" id="edit-article-title" value="${ArticleCard.escape(article.title)}" />
            </div>
            <div class="form-group">
              <label>内容（支持 Markdown）</label>
              <textarea id="edit-article-content" rows="12">${ArticleCard.escape(article.content)}</textarea>
              <button type="button" class="btn-sm btn-upload-img" onclick="createImageUploader('edit-article-content')">📷 上传图片</button>
            </div>
          `, async () => {
            const newTitle = document.getElementById('edit-article-title').value.trim();
            const newContent = document.getElementById('edit-article-content').value.trim();
            if (!newTitle || !newContent) { Toast.show('标题和内容不能为空'); return; }
            try {
              await API.put('/articles/' + articleId, { title: newTitle, content: newContent });
              Toast.show('文章已更新');
              ArticleDetailPage.render(container, articleId);
            } catch (e) { Toast.show(e.message); }
          });
        });
      }
    } catch (e) {
      container.innerHTML = '<div class="article-detail-page"><p class="text-muted">文章加载失败</p></div>';
    }
  },

  /**
   * 渲染 Markdown 内容为 HTML
   *
   * 优先使用 marked.js 库解析 Markdown 语法，
   * 如果库未加载则降级为将换行符转为 <br> 标签
   *
   * @param {string} content - Markdown 格式的文本内容
   * @returns {string} HTML 字符串
   */
  renderMarkdown(content) {
    if (!content) return '';
    if (typeof marked !== 'undefined') {
      return marked.parse(content);
    }
    // 降级方案：纯文本换行
    return content.replace(/\n/g, '<br>');
  }
};