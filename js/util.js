window.MT_UTIL = (function () {
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function debounce(fn, wait) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function looksLikePhone(line) {
    const digits = line.replace(/[^\d]/g, "");
    return /^[\d\-+()０-９ー－ 　]{8,}$/.test(line.trim()) && digits.length >= 8 && digits.length <= 13;
  }

  function looksLikeEmail(line) {
    return /[^\s]+@[^\s]+\.[^\s]+/.test(line);
  }

  function toast(message, opts) {
    opts = opts || {};
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "toast" + (opts.error ? " error" : "");
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => el.remove(), opts.duration || 2600);
  }

  let loadingEl = null;
  let loadingCount = 0;
  function showLoading(label) {
    loadingCount++;
    if (loadingEl) {
      loadingEl.querySelector(".label").textContent = label || "処理中...";
      return;
    }
    loadingEl = document.createElement("div");
    loadingEl.className = "loading-overlay";
    loadingEl.innerHTML = '<div class="spinner"></div><div class="label"></div>';
    loadingEl.querySelector(".label").textContent = label || "処理中...";
    document.body.appendChild(loadingEl);
  }
  function hideLoading() {
    loadingCount = Math.max(0, loadingCount - 1);
    if (loadingCount === 0 && loadingEl) {
      loadingEl.remove();
      loadingEl = null;
    }
  }

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  }

  return { uuid, debounce, escapeHtml, looksLikePhone, looksLikeEmail, toast, showLoading, hideLoading, formatDate };
})();
