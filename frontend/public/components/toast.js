/**
 * Toast 提示组件
 *
 * 职责：
 *   显示短暂的浮动提示信息，3 秒后自动消失
 *
 * 方法：
 *   Toast.show(message, type)
 *     - message: 提示文本
 *     - type: 'info' | 'success' | 'error'（默认 'info'）
 *
 * 实现：
 *   动态创建 div → 添加到 toast-container → 3 秒后自动移除
 *   类型通过 CSS 类名 toast-{type} 控制样式
 */

const Toast = {
  show(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
};