window.MT_APP = (function () {
  const viewRoot = document.getElementById("view-root");
  const tabbar = document.getElementById("tabbar");
  const headerActions = document.getElementById("header-actions");

  function currentRoute() {
    const hash = location.hash.replace(/^#\/?/, "");
    const parts = hash.split("/").filter(Boolean);
    return { name: parts[0] || "list", param: parts[1] };
  }

  function updateTabbar(route) {
    tabbar.hidden = !window.MT_AUTH.isLoggedIn();
    tabbar.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === route.name);
    });
  }

  function renderHeaderActions() {
    headerActions.innerHTML = "";
    if (window.MT_AUTH.isLoggedIn()) {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.style.width = "auto";
      btn.style.padding = "0.4rem 0.8rem";
      btn.style.fontSize = "0.78rem";
      btn.textContent = "ログアウト";
      btn.addEventListener("click", () => window.MT_AUTH.logout());
      headerActions.appendChild(btn);
    }
  }

  function renderLoginGate() {
    window.MT_CAMERA.stop();
    viewRoot.innerHTML = `
      <div class="login-gate">
        <h2>🗂️ 名刺管理</h2>
        <p>Googleアカウントでログインすると、ご自身のGoogle Driveに名刺データを保存できます。</p>
        <button class="btn primary" id="login-btn">Googleでログイン</button>
      </div>
    `;
    document.getElementById("login-btn").addEventListener("click", () => {
      // iOSホーム画面PWAでのポップアップブロック対策のため、
      // クリックハンドラの同期的な先頭でログイン処理を呼ぶ(間にawaitを挟まない)
      window.MT_AUTH.login();
    });
  }

  async function render() {
    const route = currentRoute();
    updateTabbar(route);
    renderHeaderActions();

    if (!window.MT_AUTH.isLoggedIn()) {
      renderLoginGate();
      return;
    }

    viewRoot.innerHTML = "";
    try {
      if (route.name === "scan") {
        await window.MT_VIEWS.scan.render(viewRoot);
      } else if (route.name === "detail" && route.param) {
        await window.MT_VIEWS.detail.render(viewRoot, route.param);
      } else {
        await window.MT_VIEWS.list.render(viewRoot);
      }
    } catch (e) {
      console.error(e);
      viewRoot.innerHTML = `<div class="empty-state">エラーが発生しました<br>${window.MT_UTIL.escapeHtml(e.message || "")}</div>`;
    }
  }

  function navigate(name, param) {
    location.hash = param ? `#/${name}/${param}` : `#/${name}`;
    if (currentRoute().name === name && !param) render();
  }

  function initTabbar() {
    tabbar.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => navigate(btn.dataset.view));
    });
  }

  function init() {
    initTabbar();
    window.addEventListener("hashchange", render);
    window.addEventListener("online", render);
    window.addEventListener("offline", render);
    window.MT_AUTH.onChange(() => {
      if (window.MT_AUTH.isLoggedIn()) {
        window.MT_STORE.loadIndex(true).catch(() => {});
      }
      render();
    });
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
    render();
  }

  window.addEventListener("DOMContentLoaded", init);

  return { navigate };
})();
