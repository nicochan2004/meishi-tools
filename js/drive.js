window.MT_DRIVE = (function () {
  const LS_FOLDER = "mt_drive_folder_id";
  const LS_IMAGES_FOLDER = "mt_drive_images_folder_id";
  const LS_INDEX = "mt_drive_index_file_id";

  const API = "https://www.googleapis.com/drive/v3";
  const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";

  function authHeader() {
    const token = window.MT_AUTH.getToken();
    if (!token) throw new Error("ログインが必要です");
    return { Authorization: "Bearer " + token };
  }

  async function driveFetch(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, authHeader());
    const res = await fetch(url, options);
    if (res.status === 401) {
      window.MT_AUTH.logout();
      throw new Error("認証の有効期限が切れました。再度ログインしてください。");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Drive APIエラー(${res.status}): ${text.slice(0, 200)}`);
    }
    return res;
  }

  async function findOrCreateFolder(name, parentId) {
    const parentClause = parentId ? `'${parentId}' in parents` : `'root' in parents`;
    const q = encodeURIComponent(
      `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and ${parentClause} and trashed=false`
    );
    const res = await driveFetch(`${API}/files?q=${q}&fields=files(id,name)`);
    const data = await res.json();
    if (data.files && data.files.length > 0) return data.files[0].id;

    const body = { name, mimeType: "application/vnd.google-apps.folder" };
    if (parentId) body.parents = [parentId];
    const createRes = await driveFetch(`${API}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const created = await createRes.json();
    return created.id;
  }

  async function ensureFolder() {
    let folderId = localStorage.getItem(LS_FOLDER);
    if (folderId) return folderId;
    folderId = await findOrCreateFolder(window.MT_CONFIG.DRIVE_FOLDER_NAME, null);
    localStorage.setItem(LS_FOLDER, folderId);
    return folderId;
  }

  async function ensureImagesFolder() {
    let folderId = localStorage.getItem(LS_IMAGES_FOLDER);
    if (folderId) return folderId;
    const parentId = await ensureFolder();
    folderId = await findOrCreateFolder("images", parentId);
    localStorage.setItem(LS_IMAGES_FOLDER, folderId);
    return folderId;
  }

  async function uploadFile(blob, name, mimeType, parentId, existingFileId) {
    const metadata = { name };
    if (!existingFileId && parentId) metadata.parents = [parentId];
    const boundary = "-------mt" + window.MT_UTIL.uuid();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;
    const metaPart = delimiter + "Content-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata);
    const arrayBuffer = await blob.arrayBuffer();
    const bodyParts = [
      new TextEncoder().encode(metaPart + delimiter + `Content-Type: ${mimeType}\r\n\r\n`),
      new Uint8Array(arrayBuffer),
      new TextEncoder().encode(closeDelim),
    ];
    const body = new Blob(bodyParts);
    const method = existingFileId ? "PATCH" : "POST";
    const url = existingFileId
      ? `${UPLOAD_API}/${existingFileId}?uploadType=multipart`
      : `${UPLOAD_API}?uploadType=multipart`;
    const res = await driveFetch(url, {
      method,
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    return res.json();
  }

  async function getIndexFileId() {
    let fileId = localStorage.getItem(LS_INDEX);
    if (fileId) return fileId;
    const folderId = await ensureFolder();
    const q = encodeURIComponent(`name='index.json' and '${folderId}' in parents and trashed=false`);
    const res = await driveFetch(`${API}/files?q=${q}&fields=files(id,name)`);
    const data = await res.json();
    if (data.files && data.files.length > 0) {
      fileId = data.files[0].id;
    } else {
      const initial = { version: 1, cards: [] };
      const blob = new Blob([JSON.stringify(initial)], { type: "application/json" });
      const created = await uploadFile(blob, "index.json", "application/json", folderId, null);
      fileId = created.id;
    }
    localStorage.setItem(LS_INDEX, fileId);
    return fileId;
  }

  async function readIndex() {
    const fileId = await getIndexFileId();
    const res = await driveFetch(`${API}/files/${fileId}?alt=media`);
    return res.json();
  }

  async function writeIndex(data) {
    const fileId = await getIndexFileId();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    await uploadFile(blob, "index.json", "application/json", null, fileId);
  }

  async function uploadImage(blob, filename) {
    const folderId = await ensureImagesFolder();
    const created = await uploadFile(blob, filename, blob.type || "image/jpeg", folderId, null);
    return created.id;
  }

  async function getFileBlob(fileId) {
    const res = await driveFetch(`${API}/files/${fileId}?alt=media`);
    return res.blob();
  }

  async function deleteFile(fileId) {
    if (!fileId) return;
    try {
      await driveFetch(`${API}/files/${fileId}`, { method: "DELETE" });
    } catch (e) {
      console.warn("ファイル削除に失敗しました", fileId, e);
    }
  }

  return { readIndex, writeIndex, uploadImage, getFileBlob, deleteFile };
})();
