window.MT_AUTH = (function () {
  const LS_TOKEN = "mt_access_token";
  const LS_EXPIRES = "mt_token_expires_at";

  let tokenClient = null;
  let accessToken = null;
  let expiresAt = 0;
  let listeners = [];

  function loadFromStorage() {
    accessToken = localStorage.getItem(LS_TOKEN);
    expiresAt = Number(localStorage.getItem(LS_EXPIRES) || 0);
    if (accessToken && Date.now() >= expiresAt) {
      accessToken = null;
      expiresAt = 0;
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_EXPIRES);
    }
  }

  function saveToStorage() {
    if (accessToken) {
      localStorage.setItem(LS_TOKEN, accessToken);
      localStorage.setItem(LS_EXPIRES, String(expiresAt));
    } else {
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_EXPIRES);
    }
  }

  function notify() {
    const loggedIn = isLoggedIn();
    listeners.forEach((fn) => {
      try { fn(loggedIn); } catch (e) { console.error(e); }
    });
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  function ensureClient() {
    if (tokenClient) return;
    if (!window.google || !google.accounts || !google.accounts.oauth2) {
      throw new Error("Googleログイン機能の読み込みが完了していません。少し待ってからもう一度お試しください。");
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: window.MT_CONFIG.GOOGLE_CLIENT_ID,
      scope: window.MT_CONFIG.DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error) {
          window.MT_UTIL.toast("ログインに失敗しました: " + resp.error, { error: true });
          notify();
          return;
        }
        accessToken = resp.access_token;
        expiresAt = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
        saveToStorage();
        notify();
      },
    });
  }

  // 重要: iOSのホーム画面PWAでポップアップがブロックされないよう、
  // ボタンのclickハンドラの同期的な先頭からこの関数を呼ぶこと(間にawaitを挟まない)。
  function login() {
    ensureClient();
    tokenClient.requestAccessToken({ prompt: accessToken ? "" : "consent" });
  }

  function logout() {
    if (accessToken && window.google && google.accounts && google.accounts.oauth2) {
      google.accounts.oauth2.revoke(accessToken, () => {});
    }
    accessToken = null;
    expiresAt = 0;
    saveToStorage();
    notify();
  }

  function isLoggedIn() {
    return !!accessToken && Date.now() < expiresAt;
  }

  function getToken() {
    return isLoggedIn() ? accessToken : null;
  }

  loadFromStorage();

  return { login, logout, isLoggedIn, getToken, onChange, ensureClient };
})();
