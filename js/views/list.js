window.MT_VIEWS = window.MT_VIEWS || {};
window.MT_VIEWS.list = (function () {
  let sortKey = "kana";
  let query = "";

  async function render(root) {
    root.innerHTML = `
      ${!navigator.onLine ? '<div class="offline-banner">オフラインです。表示は最後に読み込んだ内容のままです。</div>' : ""}
      <div class="search-bar">
        <input type="search" id="search-input" placeholder="会社名・氏名で検索" value="${window.MT_UTIL.escapeHtml(query)}">
      </div>
      <div class="sort-tabs">
        <button data-sort="kana" class="${sortKey === "kana" ? "active" : ""}">五十音順</button>
        <button data-sort="updated" class="${sortKey === "updated" ? "active" : ""}">登録が新しい順</button>
      </div>
      <div id="list-container" class="card-list"><div class="empty-state">読み込み中...</div></div>
    `;

    root.querySelectorAll(".sort-tabs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        sortKey = btn.dataset.sort;
        render(root);
      });
    });

    const input = root.querySelector("#search-input");
    input.addEventListener(
      "input",
      window.MT_UTIL.debounce((e) => {
        query = e.target.value;
        renderList(root);
      }, 200)
    );

    try {
      await window.MT_STORE.loadIndex();
    } catch (e) {
      root.querySelector("#list-container").innerHTML =
        `<div class="empty-state">読み込みに失敗しました<br>${window.MT_UTIL.escapeHtml(e.message)}</div>`;
      return;
    }
    renderList(root);
  }

  function renderList(root) {
    const container = root.querySelector("#list-container");
    const filtered = window.MT_STORE.search(query);
    const sorted = window.MT_STORE.sortCards(filtered, sortKey);
    if (sorted.length === 0) {
      container.innerHTML = `<div class="empty-state">名刺が登録されていません。<br>「スキャン」タブから登録してください。</div>`;
      return;
    }
    container.innerHTML = sorted
      .map(
        (c) => `
      <a class="card-item" href="#/detail/${c.id}">
        <div class="thumb" data-thumb-for="${c.id}"></div>
        <div class="meta">
          <div class="company">${window.MT_UTIL.escapeHtml(c.company || "")}</div>
          <div class="name">${window.MT_UTIL.escapeHtml(c.name || "(氏名未入力)")}</div>
          <div class="kana">${window.MT_UTIL.escapeHtml(c.nameKana || "")}</div>
        </div>
      </a>`
      )
      .join("");

    sorted.forEach((c) => {
      const el = container.querySelector(`[data-thumb-for="${c.id}"]`);
      if (!el) return;
      window.MT_STORE.getThumbUrl(c)
        .then((url) => {
          if (url) el.style.backgroundImage = `url(${url})`;
        })
        .catch(() => {});
    });
  }

  return { render };
})();
