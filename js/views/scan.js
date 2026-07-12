window.MT_VIEWS = window.MT_VIEWS || {};
window.MT_VIEWS.scan = (function () {
  const FIELD_KEYS = ["company", "companyKana", "name", "nameKana", "tel", "email", "memo"];
  const FIELD_LABELS = {
    company: "会社名", companyKana: "会社名フリガナ", name: "氏名", nameKana: "氏名フリガナ",
    tel: "電話番号", email: "メールアドレス", memo: "メモ",
  };

  let capturedCanvas = null;
  let cropEditor = null;
  let finalCanvas = null;
  let finalBlob = null;
  let ocrLines = [];
  let formData = {};
  let assignTarget = null;

  function reset() {
    capturedCanvas = null;
    cropEditor = null;
    finalCanvas = null;
    finalBlob = null;
    ocrLines = [];
    formData = {};
    FIELD_KEYS.forEach((k) => (formData[k] = ""));
    assignTarget = null;
  }

  async function render(root) {
    reset();
    await renderCamera(root);
  }

  async function renderCamera(root) {
    window.MT_CAMERA.stop();
    root.innerHTML = `
      ${!navigator.onLine ? '<div class="offline-banner">オフラインです。登録にはネットワーク接続が必要です。</div>' : ""}
      <div class="camera-wrap"><video id="camera-video" autoplay playsinline muted></video></div>
      <div class="shutter-row"><button class="shutter-btn" id="shutter-btn" aria-label="撮影"></button></div>
      <p style="text-align:center;color:var(--sub);font-size:0.82rem;">名刺全体が画面に収まるように撮影してください</p>
    `;
    const video = root.querySelector("#camera-video");
    try {
      await window.MT_CAMERA.start(video);
    } catch (e) {
      root.innerHTML = `<div class="empty-state">カメラを起動できませんでした。<br>${window.MT_UTIL.escapeHtml(e.message)}<br>Safariの設定でカメラへのアクセスを許可してください。</div>`;
      return;
    }
    root.querySelector("#shutter-btn").addEventListener("click", async () => {
      capturedCanvas = window.MT_CAMERA.capture(video);
      window.MT_CAMERA.stop();
      await renderCrop(root);
    });
  }

  async function renderCrop(root) {
    root.innerHTML = `<div class="empty-state">輪郭を検出しています...</div>`;
    let corners;
    try {
      await window.MT_CONTOUR.loadOpenCv();
      corners = window.MT_CONTOUR.detectCorners(capturedCanvas) ||
        window.MT_CONTOUR.fallbackCorners(capturedCanvas.width, capturedCanvas.height);
    } catch (e) {
      corners = window.MT_CONTOUR.fallbackCorners(capturedCanvas.width, capturedCanvas.height);
    }

    root.innerHTML = `
      <div class="crop-wrap" id="crop-wrap"></div>
      <p style="text-align:center;color:var(--sub);font-size:0.82rem;margin:0.6rem 0;">四隅のハンドルをドラッグして名刺の枠に合わせてください</p>
      <div class="toolbar">
        <button class="btn" id="retake-btn">撮り直す</button>
        <button class="btn primary" id="confirm-crop-btn">この枠で確定</button>
      </div>
    `;
    cropEditor = window.MT_CONTOUR.createCropEditor(root.querySelector("#crop-wrap"), capturedCanvas, corners);

    root.querySelector("#retake-btn").addEventListener("click", () => renderCamera(root));
    root.querySelector("#confirm-crop-btn").addEventListener("click", () => {
      const finalCorners = cropEditor.getOriginalCorners();
      finalCanvas = window.MT_CONTOUR.warpToCard(capturedCanvas, finalCorners, 1050, 638);
      renderPreview(root);
    });
  }

  function renderPreview(root) {
    root.innerHTML = `
      <div class="crop-wrap"><canvas id="preview-canvas"></canvas></div>
      <div class="toolbar">
        <button class="btn" id="retake2-btn">撮り直す</button>
        <button class="btn primary" id="run-ocr-btn">この画像でOCR実行</button>
      </div>
    `;
    const previewCanvas = root.querySelector("#preview-canvas");
    previewCanvas.width = finalCanvas.width;
    previewCanvas.height = finalCanvas.height;
    previewCanvas.getContext("2d").drawImage(finalCanvas, 0, 0);

    root.querySelector("#retake2-btn").addEventListener("click", () => renderCamera(root));
    root.querySelector("#run-ocr-btn").addEventListener("click", async () => {
      window.MT_UTIL.showLoading("文字を読み取っています...");
      try {
        finalBlob = await new Promise((resolve) => finalCanvas.toBlob(resolve, "image/jpeg", 0.9));
        ocrLines = await window.MT_OCR.recognize(finalBlob);
        prefill();
      } catch (e) {
        window.MT_UTIL.toast(e.message || "OCRに失敗しました。手入力で登録できます。", { error: true });
      } finally {
        window.MT_UTIL.hideLoading();
        renderForm(root);
      }
    });
  }

  function prefill() {
    for (const line of ocrLines) {
      if (!formData.tel && window.MT_UTIL.looksLikePhone(line.text)) formData.tel = line.text;
      if (!formData.email && window.MT_UTIL.looksLikeEmail(line.text)) formData.email = line.text;
    }
  }

  function fieldHtml(key) {
    return `
      <div class="field" data-key="${key}">
        <label>${FIELD_LABELS[key]}</label>
        <input data-key="${key}" value="${window.MT_UTIL.escapeHtml(formData[key])}">
      </div>`;
  }

  function renderForm(root) {
    const maxHeight = ocrLines.length ? Math.max(...ocrLines.map((l) => l.height)) : 0;
    root.innerHTML = `
      <div class="crop-wrap" style="margin-bottom:0.8rem;"><canvas id="form-preview"></canvas></div>
      <div class="section-title">読み取った文字候補(入力欄をタップしてから候補をタップすると転記されます)</div>
      <div class="chip-list" id="ocr-chips">
        ${
          ocrLines.length
            ? ocrLines
                .map(
                  (l, i) =>
                    `<button type="button" class="chip${l.height >= maxHeight * 0.85 && maxHeight > 0 ? " emphasis" : ""}" data-idx="${i}">${window.MT_UTIL.escapeHtml(l.text)}</button>`
                )
                .join("")
            : '<span style="color:var(--sub);font-size:0.85rem;">文字を検出できませんでした。手入力してください。</span>'
        }
      </div>
      <div class="card">
        ${FIELD_KEYS.map(fieldHtml).join("")}
      </div>
      <div class="toolbar">
        <button class="btn" id="retake3-btn">撮り直す</button>
        <button class="btn primary" id="register-btn">登録する</button>
      </div>
    `;

    const previewCanvas = root.querySelector("#form-preview");
    previewCanvas.width = finalCanvas.width;
    previewCanvas.height = finalCanvas.height;
    previewCanvas.getContext("2d").drawImage(finalCanvas, 0, 0);

    root.querySelectorAll(".field input").forEach((input) => {
      input.addEventListener("focus", () => {
        assignTarget = input.dataset.key;
        root.querySelectorAll(".field").forEach((f) => f.classList.toggle("assign-target", f.dataset.key === assignTarget));
      });
      input.addEventListener("input", () => {
        formData[input.dataset.key] = input.value;
      });
    });

    root.querySelectorAll("#ocr-chips .chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const line = ocrLines[Number(chip.dataset.idx)];
        const targetKey = assignTarget || "company";
        formData[targetKey] = (formData[targetKey] ? formData[targetKey] + " " : "") + line.text;
        const input = root.querySelector(`input[data-key="${targetKey}"]`);
        if (input) input.value = formData[targetKey];
      });
    });

    root.querySelector("#retake3-btn").addEventListener("click", () => renderCamera(root));
    root.querySelector("#register-btn").addEventListener("click", () => doRegister(root));
  }

  function makeThumb(canvas) {
    return new Promise((resolve) => {
      const w = 300;
      const h = Math.round(canvas.height * (w / canvas.width));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(canvas, 0, 0, w, h);
      c.toBlob(resolve, "image/jpeg", 0.85);
    });
  }

  async function doRegister(root) {
    if (!formData.company && !formData.name) {
      window.MT_UTIL.toast("会社名か氏名のどちらかは入力してください", { error: true });
      return;
    }
    window.MT_UTIL.showLoading("登録しています...");
    try {
      const id = window.MT_UTIL.uuid();
      const thumbBlob = await makeThumb(finalCanvas);
      const imageFileId = await window.MT_DRIVE.uploadImage(finalBlob, `${id}.jpg`);
      const thumbFileId = await window.MT_DRIVE.uploadImage(thumbBlob, `${id}_thumb.jpg`);
      const now = new Date().toISOString();
      await window.MT_STORE.addCard({
        id,
        company: formData.company,
        companyKana: formData.companyKana,
        name: formData.name,
        nameKana: formData.nameKana,
        tel: formData.tel,
        email: formData.email,
        memo: formData.memo,
        imageFileId,
        thumbFileId,
        createdAt: now,
        updatedAt: now,
      });
      window.MT_UTIL.toast("登録しました");
      window.MT_APP.navigate("list");
    } catch (e) {
      window.MT_UTIL.toast(e.message || "登録に失敗しました", { error: true });
    } finally {
      window.MT_UTIL.hideLoading();
    }
  }

  return { render };
})();
