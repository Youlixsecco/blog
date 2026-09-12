/**
 * 首页
 *
 * 职责：
 *   展示所有文章的列表，作为应用的默认着陆页
 *   支持 URL 搜索参数 ?search=xxx，与导航栏搜索框联动
 *
 * 数据流：
 *   1. 从 URL 获取 search 参数 → 同步到导航栏搜索框
 *   2. 调用 API 获取文章列表（如果有搜索关键词则过滤）
 *   3. 通过 ArticleCard.render 渲染每篇文章卡片
 *
 * 搜索联动：
 *   导航栏搜索框回车 → Router.navigate('/?search=xxx')
 *   → HomePage 重新渲染 → 从 URL 读取关键词 → 传给 API
 *
 * @dependency API 请求模块
 * @dependency ArticleCard 文章卡片组件
 */
const HomePage = {

  /**
   * 渲染首页文章列表
   *
   * @param {HTMLElement} container - 页面容器元素
   */
  async render(container) {
    container.innerHTML = '<div class="home-page"><div class="article-list"><p>加载中...</p></div></div>';

    // 从 URL 读取搜索关键词，同步到搜索框
    const search = new URLSearchParams(location.search).get('search') || '';
    if (search) {
      document.getElementById('nav-search-input').value = search;
    }

    try {
      const articles = await API.get('/articles?search=' + encodeURIComponent(search));
      const list = container.querySelector('.article-list');
      if (articles.length === 0) {
        list.innerHTML = '<p class="text-muted text-center">暂无文章</p>';
      } else {
        list.innerHTML = articles.map(a => ArticleCard.render(a)).join('');
      }
    } catch (e) {
      container.querySelector('.article-list').innerHTML = '<p class="text-muted">加载失败</p>';
    }
  }
};