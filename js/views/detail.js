window.MT_VIEWS = window.MT_VIEWS || {};
window.MT_VIEWS.detail = (function () {
  async function render(root, id) {
    await window.MT_STORE.loadIndex();
    const card = window.MT_STORE.getCard(id);
    if (!card) {
      root.innerHTML = `<div class="empty-state">名刺データが見つかりません</div>`;
      return;
    }
    renderView(root, card);
  }

  function renderView(root, card) {
    root.innerHTML = `
      <img class="detail-photo" id="detail-photo" alt="名刺画像">
      <div class="link-row">
        ${card.tel ? `<a class="btn primary" href="tel:${encodeURIComponent(card.tel)}">📞 電話</a>` : ""}
        ${card.email ? `<a class="btn" href="mailto:${encodeURIComponent(card.email)}">✉️ メール</a>` : ""}
      </div>
      <div class="card">
        <div class="field"><label>会社名</label><input id="f-company" value="${window.MT_UTIL.escapeHtml(card.company)}"></div>
        <div class="field"><label>会社名フリガナ</label><input id="f-companyKana" value="${window.MT_UTIL.escapeHtml(card.companyKana)}"></div>
        <div class="field"><label>氏名</label><input id="f-name" value="${window.MT_UTIL.escapeHtml(card.name)}"></div>
        <div class="field"><label>氏名フリガナ</label><input id="f-nameKana" value="${window.MT_UTIL.escapeHtml(card.nameKana)}"></div>
        <div class="field"><label>電話番号</label><input id="f-tel" type="tel" value="${window.MT_UTIL.escapeHtml(card.tel)}"></div>
        <div class="field"><label>メールアドレス</label><input id="f-email" type="email" value="${window.MT_UTIL.escapeHtml(card.email)}"></div>
        <div class="field"><label>メモ</label><textarea id="f-memo" rows="3">${window.MT_UTIL.escapeHtml(card.memo)}</textarea></div>
      </div>
      <div class="toolbar">
        <button class="btn primary" id="save-btn">保存</button>
        <button class="btn danger" id="delete-btn">削除</button>
      </div>
    `;

    window.MT_STORE.getPhotoUrl(card)
      .then((url) => {
        if (url) root.querySelector("#detail-photo").src = url;
      })
      .catch(() => {});

    root.querySelector("#save-btn").addEventListener("click", async () => {
      const patch = {
        company: root.querySelector("#f-company").value.trim(),
        companyKana: root.querySelector("#f-companyKana").value.trim(),
        name: root.querySelector("#f-name").value.trim(),
        nameKana: root.querySelector("#f-nameKana").value.trim(),
        tel: root.querySelector("#f-tel").value.trim(),
        email: root.querySelector("#f-email").value.trim(),
        memo: root.querySelector("#f-memo").value.trim(),
      };
      window.MT_UTIL.showLoading("保存中...");
      try {
        const updated = await window.MT_STORE.updateCard(card.id, patch);
        Object.assign(card, updated);
        window.MT_UTIL.toast("保存しました");
      } catch (e) {
        window.MT_UTIL.toast(e.message || "保存に失敗しました", { error: true });
      } finally {
        window.MT_UTIL.hideLoading();
      }
    });

    root.querySelector("#delete-btn").addEventListener("click", async () => {
      if (!confirm("この名刺を削除しますか？この操作は取り消せません。")) return;
      window.MT_UTIL.showLoading("削除中...");
      try {
        await window.MT_STORE.deleteCard(card.id);
        window.MT_UTIL.toast("削除しました");
        window.MT_APP.navigate("list");
      } catch (e) {
        window.MT_UTIL.toast(e.message || "削除に失敗しました", { error: true });
      } finally {
        window.MT_UTIL.hideLoading();
      }
    });
  }

  return { render };
})();
