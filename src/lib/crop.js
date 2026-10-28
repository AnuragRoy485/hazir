// Built-in banner crop: the host frames any image to Hazir's exact banner shape
// (1200 x 630 px - the size used for the event page banner and the link preview)
// before anything is uploaded. Cancel keeps the previously saved banner untouched;
// only "Use this crop" replaces the pending file.
const FW = 1200, FH = 630;

export function cropBanner(file) {
  return new Promise(async (resolve) => {
    let bmp;
    try { bmp = await createImageBitmap(file); } catch { resolve(null); return; }
    const ov = document.createElement('div');
    ov.className = 'cropov';
    ov.innerHTML = `
      <div class="cropdlg" role="dialog" aria-modal="true" aria-label="Fit your banner">
        <h4>Fit your banner</h4>
        <p class="muted">Drag the photo to position it, zoom to fill the frame. This is exactly how the banner appears (1200 x 630 px).</p>
        <div class="cropframe"><canvas id="cropcv" width="${FW}" height="${FH}" tabindex="0" aria-label="Banner crop preview. Use arrow keys to move the image, Enter to apply."></canvas></div>
        <div class="croprow"><button type="button" class="mini" id="cropzm" aria-label="Zoom out">&minus;</button><input type="range" id="cropz" min="100" max="300" value="100" aria-label="Zoom"><button type="button" class="mini" id="cropzp" aria-label="Zoom in">+</button></div>
        <div class="croprow end"><button type="button" class="btn btn-ghost btn-sm" id="cropcancel">Cancel</button><button type="button" class="btn btn-sm" id="cropok">Use this crop</button></div>
      </div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector('#cropcv'), x = cv.getContext('2d');
    const base = Math.max(FW / bmp.width, FH / bmp.height);
    let zoom = 1, ox = (FW - bmp.width * base) / 2, oy = (FH - bmp.height * base) / 2;
    const draw = () => {
      const w = bmp.width * base * zoom, h = bmp.height * base * zoom;
      ox = Math.min(0, Math.max(FW - w, ox)); oy = Math.min(0, Math.max(FH - h, oy));
      x.fillStyle = '#111'; x.fillRect(0, 0, FW, FH);
      x.drawImage(bmp, ox, oy, w, h);
    };
    draw();
    const done = (val) => { ov.remove(); document.removeEventListener('keydown', onKey, true); try { bmp.close(); } catch {} resolve(val); };
    let drag = null;
    cv.addEventListener('pointerdown', e => { drag = { px: e.clientX, py: e.clientY, ox, oy }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e => { if (!drag) return; const r = cv.getBoundingClientRect(); ox = drag.ox + (e.clientX - drag.px) * FW / r.width; oy = drag.oy + (e.clientY - drag.py) * FH / r.height; draw(); });
    cv.addEventListener('pointerup', () => { drag = null; });
    cv.addEventListener('pointercancel', () => { drag = null; });
    const z = ov.querySelector('#cropz');
    const setZoom = v => {
      v = Math.min(300, Math.max(100, v));
      const w0 = bmp.width * base * zoom, h0 = bmp.height * base * zoom;
      const rx = (FW / 2 - ox) / w0, ry = (FH / 2 - oy) / h0;
      zoom = v / 100;
      ox = FW / 2 - rx * bmp.width * base * zoom; oy = FH / 2 - ry * bmp.height * base * zoom;
      z.value = String(v); draw();
    };
    z.oninput = () => setZoom(+z.value);
    ov.querySelector('#cropzm').onclick = () => setZoom(+z.value - 10);
    ov.querySelector('#cropzp').onclick = () => setZoom(+z.value + 10);
    cv.addEventListener('wheel', e => { e.preventDefault(); setZoom(+z.value + (e.deltaY < 0 ? 5 : -5)); }, { passive: false });
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); done(null); } };
    document.addEventListener('keydown', onKey, true);
    cv.addEventListener('keydown', e => {
      const step = 12;
      if (e.key === 'ArrowLeft') ox += step; else if (e.key === 'ArrowRight') ox -= step;
      else if (e.key === 'ArrowUp') oy += step; else if (e.key === 'ArrowDown') oy -= step;
      else if (e.key === 'Enter') { ov.querySelector('#cropok').click(); return; } else return;
      e.preventDefault(); draw();
    });
    ov.querySelector('#cropcancel').onclick = () => done(null);
    ov.addEventListener('click', e => { if (e.target === ov) done(null); });
    ov.querySelector('#cropok').onclick = () => {
      const type = (file.type === 'image/png' || file.type === 'image/webp') ? file.type : 'image/jpeg';
      cv.toBlob(b => { if (!b) { done(null); return; } done(new File([b], file.name, { type })); }, type, 0.92);
    };
    cv.focus();
  });
}
