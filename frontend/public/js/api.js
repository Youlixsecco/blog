/**
 * API 请求封装模块
 *
 * 职责：
 *   封装 fetch 请求，统一处理认证头、Content-Type、错误抛出
 *
 * 方法：
 *   API.get(url)              - GET 请求
 *   API.post(url, body, isFD) - POST 请求，isFD=true 表示 FormData（文件上传）
 *   API.put(url, body)        - PUT 请求
 *   API.delete(url, body)     - DELETE 请求（支持 body 传参，用于注销等场景）
 *
 * 认证：
 *   自动从 localStorage 读取 token 注入 Authorization 头
 *   后端返回 401 时抛出异常，由页面层 catch 处理
 */

const API = {
  baseURL: '/api',

  /**
   * 通用请求方法
   * @param {string} method - HTTP 方法
   * @param {string} url    - 路径（不含 /api 前缀）
   * @param {*} body        - 请求体，isFormData=true 时为 FormData 对象
   * @param {boolean} isFormData - 是否文件上传
   */
  async request(method, url, body = null, isFormData = false) {
    const headers = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const options = { method, headers };
    if (body) {
      options.body = isFormData ? body : JSON.stringify(body);
    }

    const res = await fetch(this.baseURL + url, options);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || '请求失败');
    return data;
  },

  get(url) { return this.request('GET', url); },
  post(url, body, isFormData) { return this.request('POST', url, body, isFormData); },
  put(url, body) { return this.request('PUT', url, body); },
  delete(url, body) { return this.request('DELETE', url, body); }
};