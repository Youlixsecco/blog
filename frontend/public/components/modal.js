/**
 * 弹窗组件
 *
 * 职责：
 *   显示模态弹窗，用于确认操作（删除文章、修改密码、注销账号等）
 *
 * 方法：
 *   Modal.show(title, content, onConfirm)
 *     - title: 弹窗标题
 *     - content: HTML 内容（可包含表单元素）
 *     - onConfirm: 点击确定按钮的回调
 *
 * 交互：
 *   - 点击「确定」→ 执行 onConfirm → 关闭弹窗
 *   - 点击「取消」/「×」/ 遮罩层 → 关闭弹窗
 *   - 遮罩层点击关闭（事件委托，点击 modal 内部不关闭）
 */

const Modal = {
  show(title, content, onConfirm) {
    const container = document.getElementById('modal-container');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">
          <button class="btn btn-cancel modal-cancel">取消</button>
          <button class="btn btn-primary modal-confirm">确定</button>
        </div>
      </div>
    `;
    container.appendChild(overlay);

    overlay.querySelector('.modal-close').onclick = () => overlay.remove();
    overlay.querySelector('.modal-cancel').onclick = () => overlay.remove();
    overlay.querySelector('.modal-confirm').onclick = () => {
      if (onConfirm) onConfirm();
      overlay.remove();
    };
    // 点击遮罩层关闭（e.target === overlay 确保不误触内部元素）
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
};