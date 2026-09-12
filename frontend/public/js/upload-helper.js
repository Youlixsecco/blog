/**
 * 图片上传辅助工具模块
 *
 * 职责：
 *   在 Markdown 编辑器中实现"点击上传图片 → 自动插入 ![](url)"功能
 *
 * 函数：
 *   insertTextAtCursor(textarea, text)
 *     - 在 textarea 光标位置插入文本，保持光标在插入内容之后
 *     - 用于在编辑器中插入 Markdown 图片语法
 *
 *   createImageUploader(textareaId)
 *     - 创建隐藏的 <input type="file">，限制 accept="image/*"
 *     - 选择图片后自动上传到 /api/upload/image
 *     - 上传成功后调用 insertTextAtCursor 插入 ![filename](url)
 *     - 完成后自动移除 input 元素
 *
 * 使用方式：
 *   在页面中给按钮绑定 onclick="createImageUploader('textarea-id')"
 */

/**
 * 在 textarea 光标处插入文本
 * @param {HTMLTextAreaElement} textarea - 目标 textarea
 * @param {string} text - 要插入的文本
 */
function insertTextAtCursor(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  textarea.value = before + text + after;
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.focus();
}

/**
 * 创建图片上传器
 * 动态创建隐藏 file input → 选择图片 → 上传 → 插入 Markdown 语法
 * @param {string} textareaId - 目标 textarea 的 DOM id
 */
function createImageUploader(textareaId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await API.post('/upload/image', formData, true);
      const textarea = document.getElementById(textareaId);
      if (textarea) {
        insertTextAtCursor(textarea, `![${file.name}](${res.url})`);
      }
      Toast.show('图片上传成功');
    } catch (e) {
      Toast.show('图片上传失败: ' + e.message);
    }
    input.remove();
  });

  input.click();
}