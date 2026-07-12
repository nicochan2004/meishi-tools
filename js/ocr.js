window.MT_OCR = (function () {
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function extractLines(result) {
    const lines = [];
    const page = result && result.fullTextAnnotation && result.fullTextAnnotation.pages && result.fullTextAnnotation.pages[0];
    if (!page) return lines;
    for (const block of page.blocks || []) {
      for (const para of block.paragraphs || []) {
        let text = "";
        let minY = Infinity;
        let maxY = -Infinity;
        for (const word of para.words || []) {
          const wordText = (word.symbols || []).map((s) => s.text).join("");
          text += wordText;
          const breakType = word.property && word.property.detectedBreak && word.property.detectedBreak.type;
          if (breakType === "SPACE" || breakType === "SURE_SPACE") text += " ";
          if (breakType === "LINE_BREAK" || breakType === "EOL_SURE_SPACE") text += "\n";
          const verts = (word.boundingBox && word.boundingBox.vertices) || [];
          verts.forEach((v) => {
            if (typeof v.y === "number") {
              minY = Math.min(minY, v.y);
              maxY = Math.max(maxY, v.y);
            }
          });
        }
        text
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean)
          .forEach((t) => {
            lines.push({ text: t, height: isFinite(maxY - minY) ? maxY - minY : 0 });
          });
      }
    }
    return lines;
  }

  async function recognize(blob) {
    const apiKey = window.MT_CONFIG.VISION_API_KEY;
    if (!apiKey || apiKey === "YOUR_VISION_API_KEY") {
      throw new Error("Vision APIキーが設定されていません(js/config.jsを編集してください)");
    }
    const base64 = await blobToBase64(blob);
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64 },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["ja", "en"] },
          },
        ],
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OCRに失敗しました(${res.status}): ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const result = data.responses && data.responses[0];
    if (result && result.error) {
      throw new Error("OCRエラー: " + result.error.message);
    }
    return extractLines(result);
  }

  return { recognize };
})();
