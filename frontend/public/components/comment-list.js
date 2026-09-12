/**
 * 评论列表组件
 *
 * 职责：
 *   渲染文章详情页的评论区域，包含排序栏、评论列表、发表评论表单
 *   支持嵌套回复（树形结构）、评论点赞、多维度排序
 *
 * 排序方式：
 *   - newest: 按时间倒序（默认）
 *   - hot: 按点赞数倒序
 *   - author: 仅显示作者回复或作者赞过的评论（用于筛选与文章作者的互动）
 *
 * 嵌套结构：
 *   buildCommentTree 递归构建评论树，子评论通过 .comment-replies 容器嵌套
 *   每层评论独立绑定事件（点赞、回复切换）
 *
 * @dependency ArticleCard.escape 用于 HTML 转义
 * @dependency API 请求模块
 * @dependency Toast 提示组件
 */
const CommentList = {

  /**
   * 渲染评论区域
   *
   * @param {string} articleId - 文章 ID
   * @param {string} authorId  - 文章作者 ID（用于判断作者徽章和作者筛选）
   * @returns {HTMLElement} 包含排序栏、评论列表、发表表单的容器元素
   */
  async render(articleId, authorId) {
    const container = document.createElement('div');
    container.className = 'comment-section';

    // 排序栏：最新 / 最热 / 作者回复
    const sortBar = document.createElement('div');
    sortBar.className = 'comment-sort';
    sortBar.innerHTML = `
      <span>评论</span>
      <div class="comment-sort-btns">
        <button class="btn-sm active" data-sort="newest">最新</button>
        <button class="btn-sm" data-sort="hot">最热</button>
        <button class="btn-sm" data-sort="author">作者回复/赞过</button>
      </div>
    `;
    container.appendChild(sortBar);

    const listContainer = document.createElement('div');
    listContainer.className = 'comment-list';
    container.appendChild(listContainer);

    // 发表评论表单：未登录时显示登录提示
    const commentForm = document.createElement('div');
    commentForm.className = 'comment-form';
    commentForm.innerHTML = `
      <textarea id="comment-input" placeholder="写下你的评论..." rows="3"></textarea>
      <button class="btn btn-primary" id="comment-submit">发表评论</button>
    `;
    if (!State.isLoggedIn()) {
      commentForm.innerHTML = '<p class="text-muted">请<a data-link="/login" href="#">登录</a>后发表评论</p>';
    }
    container.appendChild(commentForm);

    // 默认按「最新」排序加载评论
    await this.loadComments(listContainer, articleId, authorId, 'newest');

    // 排序按钮切换：切换 active 样式后重新加载评论
    sortBar.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', async () => {
        sortBar.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        await this.loadComments(listContainer, articleId, authorId, btn.dataset.sort);
      });
    });

    // 发表评论：提交后清空输入框并刷新列表
    const submitBtn = container.querySelector('#comment-submit');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const input = container.querySelector('#comment-input');
        const content = input.value.trim();
        if (!content) return;
        try {
          await API.post('/comments', { articleId, content });
          input.value = '';
          const activeSort = sortBar.querySelector('.active').dataset.sort;
          await this.loadComments(listContainer, articleId, authorId, activeSort);
        } catch (e) {
          Toast.show(e.message);
        }
      });
    }

    return container;
  },

  /**
   * 加载评论列表并渲染到容器
   *
   * @param {HTMLElement} container - 评论列表容器
   * @param {string}      articleId - 文章 ID
   * @param {string}      authorId  - 文章作者 ID
   * @param {string}      sort      - 排序方式：newest / hot / author
   */
  async loadComments(container, articleId, authorId, sort) {
    try {
      const comments = await API.get(`/comments/article/${articleId}?sort=${sort}`);
      container.innerHTML = '';
      if (comments.length === 0) {
        container.innerHTML = '<p class="text-muted">暂无评论</p>';
        return;
      }
      // 遍历顶层评论，递归构建评论树
      comments.forEach(c => {
        container.appendChild(this.buildCommentTree(c, articleId, authorId));
      });
    } catch (e) {
      container.innerHTML = '<p class="text-muted">加载评论失败</p>';
    }
  },

  /**
   * 递归构建单条评论的 DOM 树
   *
   * 每条评论包含：
   *   - 头部：作者头像 + 用户名 + 作者徽章 + 时间
   *   - 内容：评论正文
   *   - 操作栏：点赞按钮 + 回复按钮
   *   - 回复表单：默认隐藏，点击回复按钮展开
   *   - 子评论容器：嵌套渲染子回复
   *
   * @param {Object}  comment  - 评论对象
   * @param {string}  articleId - 文章 ID
   * @param {string}  authorId  - 文章作者 ID
   * @param {boolean} isReply   - 是否为子回复（用于添加缩进样式）
   * @returns {HTMLElement} 评论 DOM 元素
   */
  buildCommentTree(comment, articleId, authorId, isReply = false) {
    const div = document.createElement('div');
    div.className = `comment-item${isReply ? ' comment-reply' : ''}`;
    div.id = 'comment-' + comment.id;
    const date = new Date(comment.createdAt).toLocaleDateString('zh-CN');

    // 作者徽章：评论者是文章作者 或 后端标记为 isAuthorReply
    let badges = '';
    if (comment.isAuthorReply) badges += '<span class="badge badge-author">作者</span>';
    if (comment.userId === authorId) badges += '<span class="badge badge-author">作者</span>';

    div.innerHTML = `
      <div class="comment-header">
        <span class="comment-author" data-link="/author/${comment.author.id}">
          <span class="avatar-sm">${comment.author.avatar ? `<img src="${comment.author.avatar}" alt="">` : (comment.author.username || '?')[0]}</span>
          ${ArticleCard.escape(comment.author.username)}
          ${badges}
        </span>
        <span class="comment-time">${date}</span>
      </div>
      <div class="comment-content">${ArticleCard.escape(comment.content)}</div>
      <div class="comment-actions">
        <button class="btn-sm comment-like-btn" data-comment-id="${comment.id}">
          ${comment.liked ? '❤' : '🤍'} <span>${comment.likeCount || 0}</span>
        </button>
        ${State.isLoggedIn() ? '<button class="btn-sm comment-reply-btn" data-comment-id="' + comment.id + '">回复</button>' : ''}
      </div>
      <div class="comment-reply-form" style="display:none">
        <textarea rows="2" placeholder="写下回复..."></textarea>
        <button class="btn-sm btn-primary comment-reply-submit">回复</button>
      </div>
      <div class="comment-replies"></div>
    `;

    this.bindCommentEvents(div, comment, articleId, authorId);

    // 递归渲染子回复
    const repliesContainer = div.querySelector('.comment-replies');
    if (comment.replies && comment.replies.length > 0) {
      comment.replies.forEach(r => {
        repliesContainer.appendChild(this.buildCommentTree(r, articleId, authorId, true));
      });
    }

    return div;
  },

  /**
   * 绑定单条评论的交互事件
   *
   * - 点赞按钮：调用 API 切换点赞状态，即时更新 UI
   * - 回复按钮：切换回复表单的显示/隐藏
   * - 回复提交：发送评论 API，刷新当前排序下的评论列表
   *
   * @param {HTMLElement} div       - 评论 DOM 元素
   * @param {Object}      comment   - 评论对象
   * @param {string}      articleId - 文章 ID
   * @param {string}      authorId  - 文章作者 ID
   */
  bindCommentEvents(div, comment, articleId, authorId) {
    // 评论点赞/取消点赞
    div.querySelector('.comment-like-btn')?.addEventListener('click', async () => {
      if (!State.isLoggedIn()) { Toast.show('请先登录'); return; }
      try {
        const res = await API.post('/likes/toggle', { articleId, commentId: comment.id });
        comment.liked = res.liked;
        comment.likeCount += res.liked ? 1 : -1;
        const btn = div.querySelector('.comment-like-btn');
        btn.innerHTML = `${comment.liked ? '❤' : '🤍'} <span>${comment.likeCount}</span>`;
      } catch (e) { Toast.show(e.message); }
    });

    // 展开/收起回复表单
    div.querySelector('.comment-reply-btn')?.addEventListener('click', () => {
      const form = div.querySelector('.comment-reply-form');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });

    // 提交回复：发送后清空输入框，刷新整个评论列表以获取最新排序
    div.querySelector('.comment-reply-submit')?.addEventListener('click', async () => {
      const textarea = div.querySelector('.comment-reply-form textarea');
      const content = textarea.value.trim();
      if (!content) return;
      try {
        await API.post('/comments', { articleId, content, parentId: comment.id });
        textarea.value = '';
        const activeSort = document.querySelector('.comment-sort .active')?.dataset?.sort || 'newest';
        const listContainer = div.closest('.comment-list');
        await this.loadComments(listContainer, articleId, authorId, activeSort);
      } catch (e) { Toast.show(e.message); }
    });
  }
};