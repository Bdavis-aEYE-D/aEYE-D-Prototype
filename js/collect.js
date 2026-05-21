// js/collect.js — iris color dataset collection
// Captures confirmed color labels + zone features + iris crop into localStorage.
// Exported JSON becomes training data for the k-NN classifier (Phase 2).
(function() {
  var STORE_KEY = 'aeyed_dataset_v1';
  var APP_VER   = '1.93';

  // ── Storage helpers ────────────────────────────────────────────────────────
  function getEntries() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
    catch(e) { return []; }
  }

  function saveEntry(confirmedColor) {
    var debug    = window._lastEngineDebug || {};
    var colorEl  = document.getElementById('r-color');
    var detected = colorEl ? colorEl.textContent.trim() : '?';
    var entries  = getEntries();

    entries.push({
      ts:        Date.now(),
      v:         APP_VER,
      side:      window.currentSide  || '?',
      detected:  detected,
      confirmed: confirmedColor,
      // Lab zone features — used directly by the k-NN classifier
      osLab:     debug.osLab         || null,  // outer stroma [L, a, b]
      innerLab:  debug.innerDomLab   || null,  // inner dominant [L, a, b]
      // Extra engine signals
      osMean:    debug.osMean        || null,
      innerWarm: debug.innerWarm     || null,
      // Small iris crop for visual QC + future CNN training
      iris:      _captureIris()
    });

    try { localStorage.setItem(STORE_KEY, JSON.stringify(entries)); }
    catch(e) { /* quota exceeded — skip image next time */ }

    return entries.length;
  }

  // ── Iris crop capture ──────────────────────────────────────────────────────
  // 200×200 circular crop centered on iris, pupil reflections blacked out.
  function _captureIris() {
    var SIZE  = 200;
    var donut = window.donut;
    var di    = window.drawInfo;
    var img   = window.imgEl;
    if (!donut || !di || !img || !(img.naturalWidth || img.width)) return null;
    try {
      var nw  = img.naturalWidth  || img.width;
      var nh  = img.naturalHeight || img.height;
      var sx  = nw / di.dw;
      var sy  = nh / di.dh;
      var sc  = (sx + sy) / 2;
      var icx = (donut.cx      - di.dx) * sx;
      var icy = (donut.cy      - di.dy) * sy;
      var iR  = donut.rIris  * sc;
      var pcx = ((donut.cxPupil != null ? donut.cxPupil : donut.cx) - di.dx) * sx;
      var pcy = ((donut.cyPupil != null ? donut.cyPupil : donut.cy) - di.dy) * sy;
      var pR  = donut.rPupil * sc;
      var cr  = iR * 1.18;
      var c   = document.createElement('canvas');
      c.width = c.height = SIZE;
      var ctx = c.getContext('2d');
      ctx.save();
      ctx.beginPath();
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, icx - cr, icy - cr, cr * 2, cr * 2, 0, 0, SIZE, SIZE);
      var sc2 = SIZE / (cr * 2);
      ctx.beginPath();
      ctx.arc((pcx - (icx - cr)) * sc2, (pcy - (icy - cr)) * sc2, pR * sc2 * 1.02, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();
      return c.toDataURL('image/jpeg', 0.75);
    } catch(e) { return null; }
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function exportDataset() {
    var data = getEntries();
    if (!data.length) { alert('No entries yet — confirm a few results first.'); return; }
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'aeyed-dataset-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Widget state ───────────────────────────────────────────────────────────
  function resetWidget() {
    var box = document.getElementById('collect-box');
    if (!box) return;
    box.querySelector('#collect-main').style.display     = '';
    box.querySelector('#collect-fix').style.display      = 'none';
    box.querySelector('#collect-saved-msg').style.display = 'none';
    var countEl = document.getElementById('collect-count');
    if (countEl) countEl.textContent = getEntries().length || '';
  }

  function showSaved(count) {
    var box = document.getElementById('collect-box');
    if (!box) return;
    box.querySelector('#collect-main').style.display     = 'none';
    box.querySelector('#collect-fix').style.display      = 'none';
    var msg = box.querySelector('#collect-saved-msg');
    msg.textContent   = 'Saved ✓  (' + count + ' total)';
    msg.style.display = '';
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    var box     = document.getElementById('collect-box');
    var resCard = document.getElementById('card-result');
    if (!box || !resCard) return;

    // Reset widget each time the result card is revealed
    var obs = new MutationObserver(function(muts) {
      muts.forEach(function(m) {
        if (m.attributeName === 'style' && resCard.style.display !== 'none') {
          resetWidget();
        }
      });
    });
    obs.observe(resCard, { attributes: true, attributeFilter: ['style'] });

    // Correct
    document.getElementById('collect-yes').addEventListener('click', function() {
      showSaved(saveEntry(
        (document.getElementById('r-color') || {}).textContent.trim() || '?'
      ));
    });

    // Fix it
    document.getElementById('collect-no').addEventListener('click', function() {
      box.querySelector('#collect-main').style.display = 'none';
      box.querySelector('#collect-fix').style.display  = '';
    });

    // Color picks
    box.querySelectorAll('.cc-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        showSaved(saveEntry(this.dataset.c));
      });
    });

    // Export
    document.getElementById('collect-export').addEventListener('click', exportDataset);
  });

  // Expose count for external use
  window.collectCount = function() { return getEntries().length; };
})();
