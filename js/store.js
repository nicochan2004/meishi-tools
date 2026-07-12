window.MT_STORE = (function () {
  let cards = [];
  let loaded = false;
  const blobUrlCache = new Map();

  async function loadIndex(force) {
    if (loaded && !force) return cards;
    const data = await window.MT_DRIVE.readIndex();
    cards = (data && data.cards) || [];
    loaded = true;
    return cards;
  }

  function getCards() {
    return cards;
  }

  function getCard(id) {
    return cards.find((c) => c.id === id) || null;
  }

  async function persist() {
    await window.MT_DRIVE.writeIndex({ version: 1, cards });
  }

  async function addCard(card) {
    cards.unshift(card);
    await persist();
    return card;
  }

  async function updateCard(id, patch) {
    const idx = cards.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error("名刺データが見つかりません");
    cards[idx] = Object.assign({}, cards[idx], patch, { updatedAt: new Date().toISOString() });
    await persist();
    return cards[idx];
  }

  async function deleteCard(id) {
    const idx = cards.findIndex((c) => c.id === id);
    if (idx === -1) return;
    const card = cards[idx];
    cards.splice(idx, 1);
    await persist();
    window.MT_DRIVE.deleteFile(card.imageFileId);
    window.MT_DRIVE.deleteFile(card.thumbFileId);
  }

  function search(query) {
    const q = (query || "").trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) =>
      [c.company, c.companyKana, c.name, c.nameKana].some((v) => (v || "").toLowerCase().includes(q))
    );
  }

  function sortCards(list, sortKey) {
    const arr = list.slice();
    if (sortKey === "updated") {
      arr.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    } else {
      arr.sort((a, b) => {
        const c = (a.companyKana || a.company || "").localeCompare(b.companyKana || b.company || "", "ja");
        if (c !== 0) return c;
        return (a.nameKana || a.name || "").localeCompare(b.nameKana || b.name || "", "ja");
      });
    }
    return arr;
  }

  async function getBlobUrl(fileId) {
    if (!fileId) return null;
    if (blobUrlCache.has(fileId)) return blobUrlCache.get(fileId);
    const blob = await window.MT_DRIVE.getFileBlob(fileId);
    const url = URL.createObjectURL(blob);
    blobUrlCache.set(fileId, url);
    return url;
  }

  function getThumbUrl(card) {
    return getBlobUrl(card.thumbFileId || card.imageFileId);
  }

  function getPhotoUrl(card) {
    return getBlobUrl(card.imageFileId);
  }

  return { loadIndex, getCards, getCard, addCard, updateCard, deleteCard, search, sortCards, getThumbUrl, getPhotoUrl };
})();
