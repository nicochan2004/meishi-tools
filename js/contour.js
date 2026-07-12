window.MT_CONTOUR = (function () {
  let cvLoadPromise = null;

  function loadOpenCv() {
    if (window.cv && window.cv.Mat) return Promise.resolve();
    if (cvLoadPromise) return cvLoadPromise;
    cvLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = window.MT_CONFIG.OPENCV_JS_URL;
      script.async = true;
      script.onload = () => {
        const check = () => {
          if (window.cv && window.cv.Mat) resolve();
          else setTimeout(check, 50);
        };
        if (window.cv && window.cv.onRuntimeInitialized !== undefined) {
          cv.onRuntimeInitialized = () => resolve();
        } else {
          check();
        }
      };
      script.onerror = () => reject(new Error("OpenCV.jsの読み込みに失敗しました"));
      document.head.appendChild(script);
    });
    return cvLoadPromise;
  }

  function orderCorners(pts) {
    const sums = pts.map((p) => p.x + p.y);
    const diffs = pts.map((p) => p.x - p.y);
    const tl = pts[sums.indexOf(Math.min(...sums))];
    const br = pts[sums.indexOf(Math.max(...sums))];
    const tr = pts[diffs.indexOf(Math.max(...diffs))];
    const bl = pts[diffs.indexOf(Math.min(...diffs))];
    return [tl, tr, br, bl];
  }

  function detectCorners(canvas) {
    let src, gray, blurred, edged, dilated, kernel, contours, hierarchy;
    try {
      src = cv.imread(canvas);
      gray = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      edged = new cv.Mat();
      cv.Canny(blurred, edged, 50, 150);
      dilated = new cv.Mat();
      kernel = cv.Mat.ones(3, 3, cv.CV_8U);
      cv.dilate(edged, dilated, kernel);

      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const imageArea = canvas.width * canvas.height;
      let best = null;
      let bestArea = 0;
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
        if (approx.rows === 4) {
          const area = cv.contourArea(approx);
          if (area > imageArea * 0.15 && area > bestArea) {
            bestArea = area;
            if (best) best.delete();
            best = approx;
          } else {
            approx.delete();
          }
        } else {
          approx.delete();
        }
        cnt.delete();
      }

      let corners = null;
      if (best) {
        const pts = [];
        for (let i = 0; i < 4; i++) {
          pts.push({ x: best.data32S[i * 2], y: best.data32S[i * 2 + 1] });
        }
        corners = orderCorners(pts);
        best.delete();
      }
      return corners;
    } catch (e) {
      console.warn("輪郭検出に失敗しました", e);
      return null;
    } finally {
      [src, gray, blurred, edged, dilated, kernel, contours, hierarchy].forEach((m) => {
        if (m && m.delete) m.delete();
      });
    }
  }

  function fallbackCorners(width, height) {
    const mx = width * 0.05;
    const my = height * 0.05;
    return [
      { x: mx, y: my },
      { x: width - mx, y: my },
      { x: width - mx, y: height - my },
      { x: mx, y: height - my },
    ];
  }

  function warpToCard(canvas, corners, outWidth, outHeight) {
    const src = cv.imread(canvas);
    const dst = new cv.Mat();
    const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      corners[0].x, corners[0].y,
      corners[1].x, corners[1].y,
      corners[2].x, corners[2].y,
      corners[3].x, corners[3].y,
    ]);
    const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0, outWidth, 0, outWidth, outHeight, 0, outHeight,
    ]);
    const M = cv.getPerspectiveTransform(srcTri, dstTri);
    cv.warpPerspective(src, dst, M, new cv.Size(outWidth, outHeight));

    const outCanvas = document.createElement("canvas");
    outCanvas.width = outWidth;
    outCanvas.height = outHeight;
    cv.imshow(outCanvas, dst);

    [src, dst, srcTri, dstTri, M].forEach((m) => m.delete());
    return outCanvas;
  }

  function createCropEditor(container, imageCanvas, initialCorners) {
    container.innerHTML = "";
    const displayCanvas = document.createElement("canvas");
    displayCanvas.className = "crop-canvas";
    const scale = Math.min(1, 900 / imageCanvas.width);
    displayCanvas.width = imageCanvas.width * scale;
    displayCanvas.height = imageCanvas.height * scale;
    displayCanvas.getContext("2d").drawImage(imageCanvas, 0, 0, displayCanvas.width, displayCanvas.height);
    container.appendChild(displayCanvas);

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "crop-overlay");
    svg.setAttribute("viewBox", `0 0 ${displayCanvas.width} ${displayCanvas.height}`);
    container.appendChild(svg);

    const polygon = document.createElementNS(svgNS, "polygon");
    polygon.setAttribute("fill", "rgba(47,111,237,0.25)");
    polygon.setAttribute("stroke", "#2f6fed");
    polygon.setAttribute("stroke-width", "2");
    svg.appendChild(polygon);

    let corners = initialCorners.map((p) => ({ x: p.x * scale, y: p.y * scale }));
    const handles = corners.map(() => {
      const c = document.createElementNS(svgNS, "circle");
      c.setAttribute("r", "14");
      c.setAttribute("class", "crop-handle");
      svg.appendChild(c);
      return c;
    });

    function render() {
      polygon.setAttribute("points", corners.map((p) => `${p.x},${p.y}`).join(" "));
      handles.forEach((h, i) => {
        h.setAttribute("cx", corners[i].x);
        h.setAttribute("cy", corners[i].y);
      });
    }
    render();

    handles.forEach((handle, i) => {
      handle.addEventListener("pointerdown", (e) => {
        handle.setPointerCapture(e.pointerId);
        const move = (ev) => {
          const rect = svg.getBoundingClientRect();
          const scaleX = displayCanvas.width / rect.width;
          const scaleY = displayCanvas.height / rect.height;
          let x = (ev.clientX - rect.left) * scaleX;
          let y = (ev.clientY - rect.top) * scaleY;
          x = Math.max(0, Math.min(displayCanvas.width, x));
          y = Math.max(0, Math.min(displayCanvas.height, y));
          corners[i] = { x, y };
          render();
        };
        const up = (ev) => {
          handle.releasePointerCapture(e.pointerId);
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    });

    return {
      getOriginalCorners() {
        return corners.map((p) => ({ x: p.x / scale, y: p.y / scale }));
      },
    };
  }

  return { loadOpenCv, detectCorners, fallbackCorners, warpToCard, createCropEditor, orderCorners };
})();
