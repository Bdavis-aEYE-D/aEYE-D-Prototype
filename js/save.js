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
  // Called from app.js/analyze.js right after analysis completes.
  // Grabs the stage canvas and stores a small JPEG.
  function captureThumb() {
    _pendingThumb = null;
    try {
      // Try the main stage canvas (rendered iris photo + ring overlay)
      var canvas = document.querySelector('.stage canvas') ||
                   document.querySelector('canvas#stage-canvas') ||
                   document.querySelector('canvas');
      if (!canvas) return;
      var size = 80;
      var tmp = document.createElement('canvas');
      tmp.width = size; tmp.height = size;
      var ctx = tmp.getContext('2d');
      ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, size, size);
      _pendingThumb = tmp.toDataURL('image/jpeg', 0.35);
    } catch(e) { _pendingThumb = null; }
  }

  // ── Save an analysis ─────────────────────────────────────────────────────
  function saveAnalysis(personId, result) {
    if (!personId || !result) return false;
    var analyses = loadAnalyses(personId);
    var entry = {
      id:        uid(),
      timestamp: Date.now(),
      color:     result.overall ? result.overall.name  : '?',
      cat:       result.overall ? result.overall.cat   : '?',
      conf:      result.colorConfidence || null,
      vibe:      result.vibe  || '',
      hetero:    result.hetero || 'None',
      limbal:    result.limbal || 'None',
      rarity:    result.rarity ? result.rarity.label  : '',
      side:      result.side  || 'Right',
      thumb:     _pendingThumb || null
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
      '<div class="save-modal-sheet" style="background:#1a2240;border-radius:24px 24px 0 0;padding:24px 20px 40px;width:100%;max-width:520px;border-top:1px solid #2a335c">',
        '<div style="font-size:11px;color:#6cc4ff;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px">Save Result For</div>',
        '<button type="button" id="save-btn-me" style="width:100%;background:#1d3050;border:2px solid #6cc4ff;color:#6cc4ff;border-radius:14px;padding:14px;font-size:16px;font-weight:700;margin-bottom:12px;cursor:pointer">👤 Me</button>',
        '<div id="save-people-chips" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px"></div>',
        '<div style="display:flex;gap:8px;align-items:center">',
          '<input id="save-name-input" type="text" placeholder="Type a name…" autocomplete="off" style="flex:1;background:#0e1430;border:1.5px solid #2a335c;border-radius:10px;padding:11px 14px;color:#f4f6ff;font-size:15px;outline:none">',
          '<button type="button" id="save-name-confirm" style="background:#6cc4ff;color:#001a2e;border-radius:10px;padding:11px 18px;font-weight:700;font-size:15px;cursor:pointer;white-space:nowrap">Save</button>',
        '</div>',
        '<button type="button" id="save-modal-close" style="width:100%;margin-top:14px;background:transparent;border:1px solid #2a335c;color:#aab1cc;border-radius:12px;padding:11px;font-size:14px;cursor:pointer">Cancel</button>',
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
    people.slice(0, 8).forEach(function(p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = p.name;
      btn.dataset.pid = p.id;
      btn.dataset.pname = p.name;
      btn.style.cssText = 'background:#0e1430;border:1.5px solid #2a335c;color:#f4f6ff;border-radius:20px;padding:7px 14px;font-size:13px;cursor:pointer';
      btn.addEventListener('click', function(){ doSave(p.name); });
      chips.appendChild(btn);
    });
    modal.style.display = 'flex';
    setTimeout(function(){ document.getElementById('save-name-input').focus(); }, 100);
  }

  function hideSaveModal() {
    var modal = document.getElementById('save-modal');
    if (modal) modal.style.display = 'none';
    _pendingResult = null;
  }

  // ── Save action ────────────────────────────────────────────────────────────
  function doSave(name) {
    if (!_pendingResult) { hideSaveModal(); return; }
    var personId = SaveStore.getOrCreatePerson(name || 'Me');
    if (!personId) return;
    SaveStore.saveAnalysis(personId, _pendingResult);
    hideSaveModal();
    showToast('Saved for ' + (name || 'Me') + ' ✓');
    // Refresh gallery if it's open
    if (typeof GalleryUI !== 'undefined') GalleryUI.refresh();
  }

  function showToast(msg) {
    var t = document.getElementById('save-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'save-toast';
      t.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#1a2240;border:1px solid #6cc4ff;color:#6cc4ff;font-size:13px;font-weight:700;padding:10px 20px;border-radius:999px;z-index:600;transition:opacity 0.4s;pointer-events:none';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    clearTimeout(t._tid);
    t._tid = setTimeout(function(){ t.style.opacity = '0'; }, 2200);
  }

  // ── Wire up after DOM ready ────────────────────────────────────────────────
  function init() {
    var modal = getModal();
    document.getElementById('save-btn-me').addEventListener('click', function(){ doSave('Me'); });
    document.getElementById('save-modal-close').addEventListener('click', hideSaveModal);
    document.getElementById('save-name-confirm').addEventListener('click', function(){
      var name = (document.getElementById('save-name-input').value || '').trim();
      if (name) doSave(name);
    });
    document.getElementById('save-name-input').addEventListener('keydown', function(e){
      if (e.key === 'Enter') {
        var name = (this.value || '').trim();
        if (name) doSave(name);
      }
    });
    // Close on backdrop click
    modal.addEventListener('click', function(e){ if (e.target === modal) hideSaveModal(); });
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

  function renderPerson(person) {
    var analyses = SaveStore.getPersonAnalyses(person.id);
    var wrap = document.createElement('div');
    wrap.className = 'gallery-person';
    wrap.style.cssText = 'background:#1a2240;border:1px solid #2a335c;border-radius:18px;padding:16px;margin:10px 0';

    // Header
    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px';
    header.innerHTML = '<div style="font-size:17px;font-weight:700;color:#f4f6ff">' + person.name + '</div>' +
      '<div style="font-size:12px;color:#aab1cc">' + analyses.length + ' analysis' + (analyses.length !== 1 ? 'es' : '') + '</div>';
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

      // Info
      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0';
      info.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">' +
          '<span style="width:10px;height:10px;border-radius:50%;background:' + colorDot(a.cat) + ';flex-shrink:0;display:inline-block"></span>' +
          '<span style="font-size:15px;font-weight:700;color:#f4f6ff">' + (a.color || a.cat) + '</span>' +
          (a.conf != null ? '<span style="font-size:10px;color:#aab1cc;background:#0e1430;border-radius:8px;padding:2px 6px">' + a.conf + '%</span>' : '') +
        '</div>' +
        '<div style="font-size:11px;color:#aab1cc">' + formatDate(a.timestamp) + (a.side ? ' · ' + a.side : '') + '</div>' +
        (a.vibe ? '<div style="font-size:11px;color:#6cc4ff;margin-top:2px">' + a.vibe + '</div>' : '');

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

  return { refresh: refresh };
})();
