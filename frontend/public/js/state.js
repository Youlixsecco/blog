/**
 * 用户状态管理模块
 *
 * 职责：
 *   管理当前用户的登录态和 token，持久化到 localStorage
 *
 * 方法：
 *   State.init()               - 初始化，从 localStorage 恢复登录态
 *   State.setAuth(token, user)  - 设置登录态（写入内存 + localStorage）
 *   State.logout()              - 清除登录态，重定向到登录页
 *   State.isLoggedIn()          - 是否正式用户（非游客）
 *   State.isGuest()             - 是否游客
 *
 * 用户角色：
 *   - 正式用户：{ id, username, avatar }  → isLoggedIn()=true
 *   - 游客：    { id:'guest', username:'游客', isGuest:true } → isGuest()=true
 *   - 未登录：  null → isLoggedIn()=false, isGuest()=false
 */

const State = {
  user: null,
  token: null,

  init() {
    this.token = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (u) {
      try { this.user = JSON.parse(u); } catch (e) { this.user = null; }
    }
  },

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    Router.navigate('/login');
  },

  isLoggedIn() {
    return this.user && !this.user.isGuest;
  },

  isGuest() {
    return this.user && this.user.isGuest;
  }
};