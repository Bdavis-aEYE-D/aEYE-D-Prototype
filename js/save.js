'use strict';

// ======================= SAVE & GALLERY =======================
// Stores iris analysis results in localStorage, grouped by person.
// Data model:
//   'aeyed_people'           → [{id,name,isDefault}]
//   'aeyed_analyses_{id}'    → [{id,timestamp,color,cat,conf,thumb,vibe,hetero,limbal,rarity,side}]
//
// thumb: ~80×80px JPEG data URL of the stage canvas at analysis time.
//        Captured by calling saveCapturePendingThumb() right after analysis.
// =============================================================

var SaveStore = (function() {

  var PEOPLE_KEY  = 'aeyed_people';
  var ANA_PREFIX  = 'aeyed_analyses_';
  var _pendingThumb = null;   // stage thumbnail captured at analysis time

  // ── Helpers ───────────────────────────────────────────────────────────────
  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function loadPeople() {
    try { return JSON.parse(localStorage.getItem(PEOPLE_KEY) || '[]'); }
    catch(e) { return []; }
  }

  function savePeople(arr) {
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(arr));
  }

  function loadAnalyses(personId) {
    try { return JSON.parse(localStorage.getItem(ANA_PREFIX + personId) || '[]'); }
    catch(e) { return []; }
  }

  function saveAnalyses(personId, arr) {
    localStorage.setItem(ANA_PREFIX + personId, JSON.stringify(arr));
  }

  function ensureMePerson() {
    var people = loadPeople();
    if (!people.find(function(p){ return p.id === 'me'; })) {
      people.unshift({id:'me', name:'Me', isDefault:true});
      savePeople(people);
    }
    return 'me';
  }

  // ── Thumbnail capture ─────────────────────────────────────────────────────
  // Use the iris image stored in result.analysisImage rather than the DOM
  // canvas — the canvas may be tainted (cross-origin) or cleared by the time
  // we read it. result.analysisImage.src is a data URL from the engine.
  function captureThumbFromResult(result) {
    _pendingThumb = null;
    if (!result) return;
    var src = result.analysisImage ? result.analysisImage.src : null;
    if (!src) return;
    try {
      var size = 80;
      var tmp = document.createElement('canvas');
      tmp.width = size; tmp.height = size;
      var ctx = tmp.getContext('2d');
      var img = new Image();
      // data URLs don't need crossOrigin, but set for blob URLs
      if (src.indexOf('data:') !== 0) img.crossOrigin = 'anonymous';
      img.onload = function() {
        try {
          // Crop to the iris region if we have the ring info
          var ai = result.analysisImage;
          if (ai && ai.iris && ai.drawInfo) {
            var di = ai.drawInfo;
            var cx = ai.iris.cx, cy = ai.iris.cy, r = ai.iris.rIris;
            // iris center in natural image coords
            var scaleX = (ai.naturalW || img.naturalWidth)  / (di.dw || 1);
            var scaleY = (ai.naturalH || img.naturalHeight) / (di.dh || 1);
            var srcX = Math.max(0, (cx - di.dx) / di.dw * (ai.naturalW || img.naturalWidth) - r * scaleX * 1.1);
            var srcY = Math.max(0, (cy - di.dy) / di.dh * (ai.naturalH || img.naturalHeight) - r * scaleY * 1.1);
            var srcS = r * Math.max(scaleX, scaleY) * 2.2;
            ctx.drawImage(img, srcX, srcY, srcS, srcS, 0, 0, size, size);
          } else {
            // Fallback: full image scaled down
            ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, size, size);
          }
          _pendingThumb = tmp.toDataURL('image/jpeg', 0.5);
        } catch(e) { _pendingThumb = null; }
      };
      img.onerror = function() { _pendingThumb = null; };
      img.src = src;
    } catch(e) { _pendingThumb = null; }
  }

  // Legacy alias — still called from analyze.js
  function captureThumb() { /* no-op: use captureThumbFromResult instead */ }

  // ── Save an analysis ─────────────────────────────────────────────────────
  function saveAnalysis(personId, result) {
    if (!personId || !result) return false;
    var analyses = loadAnalyses(personId);
    // Strip large image fields before storing — analysisImage.src can be
    // a multi-MB data URL. Keep everything else for the detail view.
    var stripped = null;
    try {
      stripped = JSON.parse(JSON.stringify(result));
      if (stripped.analysisImage) stripped.analysisImage = null;
      if (stripped.portraitImage) stripped.portraitImage = null;
      // topColors RGB arrays are small — keep them
    } catch(e) { stripped = null; }

    var entry = {
      id:        uid(),
      timestamp: Date.now(),
      // Summary fields (for gallery list display)
      color:     result.overall ? result.overall.name  : '?',
      cat:       result.overall ? result.overall.cat   : '?',
      conf:      result.colorConfidence || null,
      vibe:      result.vibe  || '',
      hetero:    result.hetero || 'None',
      limbal:    result.limbal || 'None',
      rarity:    result.rarity ? result.rarity.label  : '',
      side:      result.side  || 'Right',
      thumb:     _pendingThumb || null,
      // Full result (for detail view — analysisImage stripped to save space)
      fullResult: stripped
    };
    analyses.unshift(entry);  // newest first
    // Keep max 50 analyses per person (to avoid localStorage bloat)
    if (analyses.length > 50) analyses = analyses.slice(0, 50);
    saveAnalyses(personId, analyses);
    _pendingThumb = null;
    return true;
  }

  // ── Person management ─────────────────────────────────────────────────────
  function getOrCreatePerson(name) {
    name = (name || '').trim();
    if (!name) return null;
    if (name.toLowerCase() === 'me') return ensureMePerson();
    var people = loadPeople();
    var existing = people.find(function(p){ return p.name.toLowerCase() === name.toLowerCase(); });
    if (existing) return existing.id;
    var id = uid();
    people.push({id:id, name:name, isDefault:false});
    savePeople(people);
    return id;
  }

  function getAllPeople() {
    ensureMePerson();
    var people = loadPeople();
    // Attach last-analysis colour and count to each person
    return people.map(function(p) {
      var analyses = loadAnalyses(p.id);
      return {
        id:       p.id,
        name:     p.name,
        isDefault:p.isDefault || false,
        count:    analyses.length,
        latest:   analyses[0] || null
      };
    }).filter(function(p){ return p.count > 0 || p.isDefault; });
  }

  function getPersonAnalyses(personId) {
    return loadAnalyses(personId);
  }

  function deleteAnalysis(personId, analysisId) {
    var analyses = loadAnalyses(personId).filter(function(a){ return a.id !== analysisId; });
    saveAnalyses(personId, analyses);
  }

  function deletePerson(personId) {
    if (personId === 'me') return;
    localStorage.removeItem(ANA_PREFIX + personId);
    var people = loadPeople().filter(function(p){ return p.id !== personId; });
    savePeople(people);
  }

  return {
    captureThumb:      captureThumb,
    saveAnalysis:      saveAnalysis,
    getOrCreatePerson: getOrCreatePerson,
    getAllPeople:       getAllPeople,
    getPersonAnalyses: getPersonAnalyses,
    deleteAnalysis:    deleteAnalysis,
    deletePerson:      deletePerson,
    ensureMe:          ensureMePerson
  };
})();


// ======================= SAVE MODAL UI =======================
(function() {

  var _pendingResult = null;

  // ── Build and inject modal HTML ────────────────────────────────────────────
  function buildModal() {
    var el = document.createElement('div');
    el.id = 'save-modal';
    el.className = 'save-modal-overlay';
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:500;align-items:flex-end;justify-content:center;padding:0';
    el.innerHTML = [
      '<div class="save-modal-sheet" style="background:#1a2240;border-radius:24px 24px 0 0;padding:24px 20px 44px;width:100%;max-width:520px;border-top:1px solid #2a335c">',
        // Confirmation area (hidden until saved)
        '<div id="save-confirm-msg" style="display:none;text-align:center;padding:20px 0;font-size:22px;font-weight:800;color:#6cc4ff"></div>',
        // Main content
        '<div id="save-modal-body">',
          '<div style="font-size:12px;color:#aab1cc;margin-bottom:14px;text-align:center">Who is this iris for?</div>',
          // Me — primary action, large and prominent
          '<button type="button" id="save-btn-me" style="width:100%;background:#1d3050;border:2px solid #6cc4ff;color:#6cc4ff;border-radius:16px;padding:16px;font-size:17px;font-weight:800;margin-bottom:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px"><span style="font-size:22px">👤</span><span>Me</span></button>',
          // Previously saved people
          '<div id="save-people-chips" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px"></div>',
          // Divider + new name
          '<div style="font-size:11px;color:#aab1cc;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Save for someone new</div>',
          '<div style="display:flex;gap:8px;align-items:center">',
            '<input id="save-name-input" type="text" placeholder="Type a name…" autocomplete="off" style="flex:1;background:#0e1430;border:1.5px solid #2a335c;border-radius:10px;padding:12px 14px;color:#f4f6ff;font-size:15px;outline:none">',
            '<button type="button" id="save-name-confirm" disabled style="background:#2a3a5a;color:#4a6a9a;border-radius:10px;padding:12px 18px;font-weight:700;font-size:15px;cursor:default;white-space:nowrap;border:none;transition:all 0.15s">Save</button>',
          '</div>',
          '<button type="button" id="save-modal-close" style="width:100%;margin-top:12px;background:transparent;border:none;color:#aab1cc;border-radius:12px;padding:11px;font-size:14px;cursor:pointer">Cancel</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(el);
    return el;
  }

  function getModal() {
    return document.getElementById('save-modal') || buildModal();
  }

  // ── Show / hide ────────────────────────────────────────────────────────────
  function showSaveModal(result) {
    _pendingResult = result;
    SaveStore.captureThumb();
    var modal = getModal();
    // Populate chips from saved people (excluding 'me')
    var people = SaveStore.getAllPeople().filter(function(p){ return !p.isDefault && p.count > 0; });
    var chips = document.getElementById('save-people-chips');
    chips.innerHTML = '';
    if (people.length > 0) {
      var chipsLabel = document.createElement('div');
      chipsLabel.textContent = 'Or save for:';
      chipsLabel.style.cssText = 'font-size:11px;color:#aab1cc;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;width:100%';
      chips.appendChild(chipsLabel);
    }
    people.slice(0, 6).forEach(function(p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = p.name;
      btn.dataset.pid = p.id;
      btn.dataset.pname = p.name;
      btn.style.cssText = 'background:#0e1430;border:1.5px solid #2a335c;color:#f4f6ff;border-radius:20px;padding:9px 16px;font-size:14px;font-weight:600;cursor:pointer;flex-shrink:0';
      btn.addEventListener('click', function(){ doSave(p.name); });
      chips.appendChild(btn);
    });
    modal.style.display = 'flex';
    setTimeout(function(){ document.getElementById('save-name-input').focus(); }, 100);
  }

  function hideSaveModal() {
    var modal = document.getElementById('save-modal');
    if (modal) modal.style.display = 'none';
    // Reset confirmation state for next open
    var body = document.getElementById('save-modal-body');
    var confirm = document.getElementById('save-confirm-msg');
    var inp = document.getElementById('save-name-input');
    var confirmBtn = document.getElementById('save-name-confirm');
    if (body)    body.style.display = '';
    if (confirm) confirm.style.display = 'none';
    if (inp)     inp.value = '';
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.style.background = '#2a3a5a';
      confirmBtn.style.color = '#4a6a9a';
      confirmBtn.style.cursor = 'default';
    }
    _pendingResult = null;
  }

  // ── Save action — shows inline confirmation before closing ────────────────
  function doSave(name) {
    if (!_pendingResult) { hideSaveModal(); return; }
    var displayName = (name || 'Me').trim() || 'Me';
    var personId = SaveStore.getOrCreatePerson(displayName);
    if (!personId) return;
    SaveStore.saveAnalysis(personId, _pendingResult);
    // Show inline confirmation (don't just silently close)
    var body = document.getElementById('save-modal-body');
    var confirm = document.getElementById('save-confirm-msg');
    if (body && confirm) {
      body.style.display = 'none';
      confirm.textContent = '✓ Saved for ' + displayName;
      confirm.style.display = 'block';
    }
    // Auto-close after user sees confirmation
    setTimeout(function() {
      hideSaveModal();
      if (typeof GalleryUI  !== 'undefined') GalleryUI.refresh();
      if (typeof HomeRecent !== 'undefined') HomeRecent.render();
    }, 1400);
  }

  // ── Wire up after DOM ready ────────────────────────────────────────────────
  function init() {
    var modal = getModal();
    document.getElementById('save-btn-me').addEventListener('click', function(){ doSave('Me'); });
    document.getElementById('save-modal-close').addEventListener('click', hideSaveModal);

    // Enable/disable Save button based on input content
    var inp = document.getElementById('save-name-input');
    var confirmBtn = document.getElementById('save-name-confirm');
    inp.addEventListener('input', function() {
      var hasText = this.value.trim().length > 0;
      confirmBtn.disabled = !hasText;
      confirmBtn.style.background = hasText ? '#6cc4ff' : '#2a3a5a';
      confirmBtn.style.color      = hasText ? '#001a2e' : '#4a6a9a';
      confirmBtn.style.cursor     = hasText ? 'pointer'  : 'default';
    });
    confirmBtn.addEventListener('click', function(){
      var name = inp.value.trim();
      if (name) doSave(name);
    });
    inp.addEventListener('keydown', function(e){
      if (e.key === 'Enter' && this.value.trim()) doSave(this.value.trim());
    });
    // Close on backdrop click (but only if showing body, not confirmation)
    modal.addEventListener('click', function(e){
      if (e.target === modal) hideSaveModal();
    });
  }

  // Expose globally
  window.SaveModal = { show: showSaveModal, hide: hideSaveModal };
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 100); });
})();


// ======================= GALLERY UI =======================
var GalleryUI = (function() {

  function formatDate(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'})
      + ' · ' + d.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});
  }

  function colorDot(cat) {
    var palette = {
      'Amber':'#ffb347','Blue':'#6cc4ff','Brown':'#8b5e3c',
      'Green':'#5dbb6d','Gray':'#9ba8bb','Grey':'#9ba8bb','Hazel':'#c09060',
      'Violet':'#b088e8'
    };
    return palette[cat] || '#aab1cc';
  }

  // ── Detail modal: shows full eyeD Card for a saved analysis ──────────────
  function showDetail(entry) {
    var existing = document.getElementById('gallery-detail-modal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'gallery-detail-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:600;overflow-y:auto;padding:20px 16px 60px';

    // Close on backdrop tap
    modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); });

    var fr = entry.fullResult;
    var dotColor = function(cat) {
      var p={'Amber':'#ffb347','Blue':'#6cc4ff','Brown':'#8b5e3c','Green':'#5dbb6d','Gray':'#9ba8bb','Grey':'#9ba8bb','Hazel':'#c09060'};
      return p[cat]||'#aab1cc';
    };

    var html = '<div style="max-width:520px;margin:0 auto">';
    // Header
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">';
    html += '<div style="font-size:11px;color:#6cc4ff;text-transform:uppercase;letter-spacing:2px">Saved Analysis</div>';
    html += '<button type="button" onclick="document.getElementById(\'gallery-detail-modal\').remove()" style="background:transparent;border:none;color:#aab1cc;font-size:24px;cursor:pointer;padding:0;line-height:1">×</button>';
    html += '</div>';

    // Iris thumbnail (large)
    if (entry.thumb) {
      html += '<div style="text-align:center;margin-bottom:16px"><img src="' + entry.thumb + '" style="width:120px;height:120px;border-radius:50%;border:3px solid #6cc4ff;object-fit:cover"></div>';
    }

    // Color hero
    html += '<div style="background:linear-gradient(140deg,#1d2856,#0e1430);border:1px solid #6cc4ff;border-radius:18px;padding:18px;margin-bottom:12px;text-align:center">';
    html += '<div style="font-size:11px;color:#6cc4ff;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px">' + entry.side + ' Eye · ' + new Date(entry.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) + '</div>';
    html += '<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px">';
    html += '<span style="width:14px;height:14px;border-radius:50%;background:' + dotColor(entry.cat) + ';display:inline-block;flex-shrink:0"></span>';
    html += '<span style="font-size:26px;font-weight:800;color:#6cc4ff">' + (entry.color||entry.cat) + '</span>';
    html += '</div>';
    if (entry.vibe) html += '<div style="font-size:13px;color:#aab1cc;margin-bottom:4px">' + entry.vibe + '</div>';
    if (entry.conf != null) html += '<div style="font-size:11px;color:#aab1cc;background:#0e1430;border-radius:8px;padding:2px 8px;display:inline-block">Confidence: ' + entry.conf + '%</div>';
    html += '</div>';

    // Attributes grid from fullResult
    if (fr) {
      var attrs = [
        ['Hetero', fr.hetero||'None'],
        ['Limbal Ring', fr.limbal||'None'],
        ['Rarity', fr.rarity ? fr.rarity.label : '—'],
        ['Brightness', fr.brightness||'—'],
        ['Saturation', fr.saturation||'—'],
        ['Iris Type', fr.rayid ? fr.rayid.label : '—'],
        ['Collarette', fr.collarette ? fr.collarette.label : '—'],
        ['Freckles', fr.freckles && fr.freckles.length ? fr.freckles.length + ' detected' : 'None'],
        ['Sectoral', fr.sectoral ? (fr.sectoral.color.name + ' @ ' + fr.sectoral.clock + 'h') : 'None']
      ];
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
      attrs.forEach(function(a){
        html += '<div style="background:#0e1430;border:1px solid #2a335c;border-radius:12px;padding:10px">';
        html += '<div style="font-size:10px;color:#aab1cc;text-transform:uppercase;letter-spacing:1px">' + a[0] + '</div>';
        html += '<div style="font-size:14px;color:#f4f6ff;font-weight:600;margin-top:2px">' + a[1] + '</div>';
        html += '</div>';
      });
      html += '</div>';

      // Fingerprint
      if (fr.fingerprint) {
        var fp = fr.fingerprint;
        html += '<div style="background:#0e1430;border:1px solid #2a335c;border-radius:12px;padding:12px;margin-bottom:12px;text-align:center">';
        html += '<div style="font-size:10px;color:#aab1cc;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Colour Fingerprint</div>';
        html += '<div style="display:flex;align-items:center;justify-content:center;gap:10px">';
        html += '<div style="width:32px;height:32px;border-radius:50%;background:rgb(' + fp.rgb.join(',') + ');border:2px solid rgba(255,255,255,0.2)"></div>';
        html += '<div style="font-family:monospace;font-size:13px;color:#f4f6ff">' + fp.hex.toUpperCase() + '<br><span style="color:#aab1cc;font-size:11px">Lab(' + fp.lab.map(function(v){return v.toFixed(0);}).join(', ') + ')</span></div>';
        html += '</div></div>';
      }
    }

    // Close button
    html += '<button type="button" onclick="document.getElementById(\'gallery-detail-modal\').remove()" style="width:100%;background:transparent;border:1.5px solid #2a335c;color:#aab1cc;border-radius:14px;padding:12px;font-size:15px;cursor:pointer">Close</button>';
    html += '</div>';

    modal.innerHTML = html;
    document.body.appendChild(modal);
  }

  function renderPerson(person) {
    var analyses = SaveStore.getPersonAnalyses(person.id);
    var wrap = document.createElement('div');
    wrap.className = 'gallery-person';
    wrap.style.cssText = 'background:#1a2240;border:1px solid #2a335c;border-radius:18px;padding:16px;margin:10px 0';

    // Header
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px';
    header.innerHTML = '<div style="font-size:17px;font-weight:700;color:#f4f6ff">' + person.name + '</div>' +
      '<div style="font-size:12px;color:#aab1cc">' + analyses.length + ' ' + (analyses.length !== 1 ? 'analyses' : 'analysis') + '</div>';
    wrap.appendChild(header);

    if (!analyses.length) {
      var empty = document.createElement('div');
      empty.style.cssText = 'color:#aab1cc;font-size:13px;text-align:center;padding:12px 0';
      empty.textContent = 'No analyses yet';
      wrap.appendChild(empty);
      return wrap;
    }

    // Analysis entries
    analyses.forEach(function(a) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid #2a335c';

      // Thumbnail
      var thumb = document.createElement('div');
      thumb.style.cssText = 'width:52px;height:52px;border-radius:50%;background:#0e1430;flex-shrink:0;overflow:hidden;border:2px solid #2a335c';
      if (a.thumb) {
        var img = document.createElement('img');
        img.src = a.thumb;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover';
        thumb.appendChild(img);
      } else {
        thumb.style.background = colorDot(a.cat);
        thumb.style.opacity = '0.5';
      }

      // Info — single column, no wrapping
      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;overflow:hidden';
      var dateStr = new Date(a.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric'})
                  + ' ' + new Date(a.timestamp).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})
                  + (a.side ? ' · ' + a.side : '');
      info.innerHTML =
        '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px;flex-wrap:nowrap">' +
          '<span style="width:9px;height:9px;border-radius:50%;background:' + colorDot(a.cat) + ';flex-shrink:0;display:inline-block"></span>' +
          '<span style="font-size:15px;font-weight:700;color:#f4f6ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (a.color || a.cat) + '</span>' +
          (a.conf != null ? '<span style="font-size:10px;color:#aab1cc;background:#0e1430;border-radius:6px;padding:1px 5px;flex-shrink:0">' + a.conf + '%</span>' : '') +
        '</div>' +
        '<div style="font-size:11px;color:#aab1cc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + dateStr + '</div>' +
        (a.vibe ? '<div style="font-size:11px;color:#6cc4ff;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + a.vibe + '</div>' : '');

      // Delete button
      var del = document.createElement('button');
      del.type = 'button';
      del.textContent = '×';
      del.style.cssText = 'background:transparent;border:none;color:#4a5c7a;font-size:20px;cursor:pointer;padding:4px;line-height:1;flex-shrink:0';
      del.dataset.pid = person.id;
      del.dataset.aid = a.id;
      del.addEventListener('click', function(e) {
        e.stopPropagation();
        if (confirm('Delete this analysis?')) {
          SaveStore.deleteAnalysis(person.id, a.id);
          GalleryUI.refresh();
        }
      });

      // Tap row → show full detail modal with all stored data
      row.style.cursor = 'pointer';
      (function(capturedEntry){
        row.addEventListener('click', function(e){
          if (e.target.dataset.pid || e.target.dataset.aid) return;
          showDetail(capturedEntry);
        });
      })(a);

      row.appendChild(thumb);
      row.appendChild(info);
      row.appendChild(del);
      wrap.appendChild(row);
    });

    // Delete person (if not 'me')
    if (!person.isDefault) {
      var delPerson = document.createElement('button');
      delPerson.type = 'button';
      delPerson.textContent = 'Remove ' + person.name;
      delPerson.style.cssText = 'width:100%;margin-top:10px;background:transparent;border:1px solid #3a2233;color:#7a4a6a;border-radius:10px;padding:8px;font-size:12px;cursor:pointer';
      delPerson.addEventListener('click', function() {
        if (confirm('Remove ' + person.name + ' and all their analyses?')) {
          SaveStore.deletePerson(person.id);
          GalleryUI.refresh();
        }
      });
      wrap.appendChild(delPerson);
    }

    return wrap;
  }

  function refresh() {
    var container = document.getElementById('gallery-content');
    if (!container) return;
    container.innerHTML = '';
    var people = SaveStore.getAllPeople();
    if (!people.length || (people.length === 1 && people[0].count === 0)) {
      container.innerHTML = '<div style="text-align:center;color:#aab1cc;padding:40px 20px;font-size:14px">No saved results yet.<br><br>Analyze an iris and tap <strong>Save</strong> to keep results here.</div>';
      return;
    }
    people.forEach(function(p) {
      container.appendChild(renderPerson(p));
    });
  }

  return { refresh: refresh, _showDetail: showDetail };
})();


// ======================= HOME SCREEN RECENT SAVES =======================
var HomeRecent = (function() {

  function colorDot(cat) {
    var p={'Amber':'#ffb347','Blue':'#6cc4ff','Brown':'#8b5e3c','Green':'#5dbb6d','Gray':'#9ba8bb','Grey':'#9ba8bb','Hazel':'#c09060'};
    return p[cat]||'#aab1cc';
  }

  function render() {
    var wrap = document.getElementById('home-recent-saves');
    var row  = document.getElementById('home-recent-row');
    if (!wrap || !row) return;

    // Collect the 5 most recent analyses across all people
    var people = SaveStore.getAllPeople();
    var all = [];
    people.forEach(function(p) {
      SaveStore.getPersonAnalyses(p.id).forEach(function(a) {
        all.push({ person: p.name, entry: a });
      });
    });
    all.sort(function(a,b){ return b.entry.timestamp - a.entry.timestamp; });
    var recent = all.slice(0, 5);

    if (!recent.length) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    row.innerHTML = '';

    recent.forEach(function(item) {
      var a = item.entry;
      var card = document.createElement('div');
      card.style.cssText = 'flex-shrink:0;width:80px;text-align:center;cursor:pointer';
      card.title = item.person + ' · ' + a.color;

      // Circular thumbnail
      var thumb = document.createElement('div');
      thumb.style.cssText = 'width:64px;height:64px;border-radius:50%;margin:0 auto 6px;overflow:hidden;border:2px solid ' + colorDot(a.cat) + ';background:#0e1430;position:relative';
      if (a.thumb) {
        var img = document.createElement('img');
        img.src = a.thumb;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover';
        thumb.appendChild(img);
      } else {
        thumb.style.background = colorDot(a.cat);
        thumb.style.opacity = '0.6';
      }

      // Name label
      var label = document.createElement('div');
      label.style.cssText = 'font-size:11px;color:#f4f6ff;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      label.textContent = item.person;

      // Color sub-label
      var sub = document.createElement('div');
      sub.style.cssText = 'font-size:10px;color:#aab1cc;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
      sub.textContent = a.color || a.cat;

      card.appendChild(thumb);
      card.appendChild(label);
      card.appendChild(sub);

      // Tap → open detail view
      (function(capturedEntry) {
        card.addEventListener('click', function() {
          if (typeof GalleryUI !== 'undefined' && typeof GalleryUI._showDetail === 'function') {
            GalleryUI._showDetail(capturedEntry);
          }
        });
      })(a);

      row.appendChild(card);
    });
  }

  // Wire up "See all →"
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      render();
      var seeAll = document.getElementById('home-see-all');
      if (seeAll) {
        seeAll.addEventListener('click', function() {
          var galBtn = document.querySelector('.tab-btn[data-tab="gallery"]');
          if (galBtn) {
            // index.html: switch to People tab
            var tabs = document.querySelectorAll('.tab-btn');
            for (var i=0; i<tabs.length; i++) tabs[i].classList.remove('active');
            galBtn.classList.add('active');
            ['capture','gallery','post','about'].forEach(function(n){
              var el = document.getElementById('tab-'+n);
              if (el) el.classList.toggle('hidden', n !== 'gallery');
            });
            if (typeof GalleryUI !== 'undefined') GalleryUI.refresh();
          } else {
            // reveal.html: show inline full-gallery overlay
            showAllGallery();
          }
        });
      }
    }, 150);
  });

  function showAllGallery() {
    var existing = document.getElementById('all-gallery-modal');
    if (existing) { existing.remove(); return; }
    var modal = document.createElement('div');
    modal.id = 'all-gallery-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:#0c0a08;z-index:700;overflow-y:auto;padding:20px 16px 60px';
    var header = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
      '<div style="font-size:17px;font-weight:700;color:#e8e0d0">My Saved Eyes</div>' +
      '<button onclick="document.getElementById(\'all-gallery-modal\').remove()" style="background:transparent;border:none;color:#7a6e60;font-size:24px;cursor:pointer;padding:0;line-height:1;width:auto">×</button>' +
      '</div>';
    modal.innerHTML = header + '<div id="all-gallery-inner"></div>';
    document.body.appendChild(modal);
    // Render using GalleryUI
    var inner = document.getElementById('all-gallery-inner');
    if (inner && typeof GalleryUI !== 'undefined') {
      var people = SaveStore.getAllPeople();
      if (!people.length || (people.length===1 && people[0].count===0)) {
        inner.innerHTML = '<div style="text-align:center;color:#7a6e60;padding:40px 0">No saved results yet.</div>';
      } else {
        // Reuse the existing gallery renderer by temporarily swapping #gallery-content
        var tmp = document.createElement('div');
        tmp.id = 'gallery-content';
        inner.appendChild(tmp);
        GalleryUI.refresh();
        // Move rendered children back
        while (tmp.firstChild) inner.insertBefore(tmp.firstChild, tmp);
        tmp.remove();
      }
    }
  }

  return { render: render };
})();
