'use strict';

// ---- JS-health indicator: flip to green on load so Bryan knows JS is running
function markRunning() {
  var h = document.getElementById('jshealth');
  if (h) { h.style.background = '#116b2d'; h.textContent = 'JAVASCRIPT RUNNING'; }
  var hh = document.getElementById('open-help');
  if (hh) hh.style.display = 'none';
}

// Visible error reporter
function showError(msg) {
  var e = document.getElementById('err');
  if (!e) { alert('ERROR: ' + msg); return; }
  e.style.display = 'block';
  e.textContent = 'Error: ' + msg;
}
window.addEventListener('error', function(ev){
  showError((ev.message || 'unknown') + (ev.filename ? ' (' + ev.filename + ':' + ev.lineno + ')' : ''));
});

var $ = function (id) { return document.getElementById(id); };

// ======================= TAB SWITCHING =======================
var tabs = document.querySelectorAll('.tab-btn');
for (var i=0;i<tabs.length;i++){
  (function(btn){
    btn.addEventListener('click', function(){
      for (var j=0;j<tabs.length;j++) tabs[j].classList.remove('active');
      btn.classList.add('active');
      var t = btn.getAttribute('data-tab');
      ['capture','gallery','post','about'].forEach(function(n){
        var el = $('tab-'+n);
        if (el) el.classList.toggle('hidden', n !== t);
      });
      if (t === 'post') drawPostStage();
      if (t === 'gallery' && typeof GalleryUI !== 'undefined') GalleryUI.refresh();
    });
  })(tabs[i]);
}

// ======================= FILE LOADING =======================
var fileInput = $('file-input');

// ── Ring Correction Memory ─────────────────────────────────────────────────
// Saves user-accepted ring placements (filename:size key) so the same image
// never needs to be re-corrected. Corrections survive page reloads.
var _loadedFile = null;   // File object currently loaded
var _ringStore = (function () {
  var KEY = 'aeyed_ring_v1';
  function _rd() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function _wr(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  function _fp(f) { return f ? f.name + ':' + f.size : ''; }
  return {
    get: function (f) { var k = _fp(f); return k ? (_rd()[k] || null) : null; },
    set: function (f, v) { if (!f) return; var d = _rd(), k = _fp(f); d[k] = v; _wr(d); },
    list: function () { return _rd(); }
  };
})();
// Convert current donut canvas coords → normalised image fractions for storage
function _donutToImgCoords() {
  if (!imgEl || !imgEl.naturalWidth) return null;
  var sx = drawInfo.dw / imgEl.naturalWidth, sy = drawInfo.dh / imgEl.naturalHeight;
  return {
    irisCxFrac:  (donut.cx - drawInfo.dx) / sx / imgEl.naturalWidth,
    irisCyFrac:  (donut.cy - drawInfo.dy) / sy / imgEl.naturalHeight,
    irisRFrac:    donut.rIris / sx / imgEl.naturalWidth,
    pupilCxFrac: ((donut.cxPupil != null ? donut.cxPupil : donut.cx) - drawInfo.dx) / sx / imgEl.naturalWidth,
    pupilCyFrac: ((donut.cyPupil != null ? donut.cyPupil : donut.cy) - drawInfo.dy) / sy / imgEl.naturalHeight,
    pupilRFrac:  (donut.rPupil || 0) / sx / imgEl.naturalWidth,
    ts: Date.now()
  };
}
// Apply stored correction (normalised fractions → canvas coords)
function _applyStoredRing(stored) {
  if (!stored || !imgEl || !imgEl.naturalWidth) return false;
  var sx = drawInfo.dw / imgEl.naturalWidth, sy = drawInfo.dh / imgEl.naturalHeight;
  donut.cx      = drawInfo.dx + stored.irisCxFrac  * imgEl.naturalWidth  * sx;
  donut.cy      = drawInfo.dy + stored.irisCyFrac  * imgEl.naturalHeight * sy;
  donut.rIris   =               stored.irisRFrac   * imgEl.naturalWidth  * sx;
  donut.cxPupil = drawInfo.dx + stored.pupilCxFrac * imgEl.naturalWidth  * sx;
  donut.cyPupil = drawInfo.dy + stored.pupilCyFrac * imgEl.naturalHeight * sy;
  donut.rPupil  =               stored.pupilRFrac  * imgEl.naturalWidth  * sx;
  return true;
}

// Native camera buttons — opens iOS full-resolution camera directly
function _nativeCamHandler(inputId) {
  var input = $(inputId);
  input.value = '';   // reset so same file can be re-selected
  input.click();
}
$('btn-cam-rear').addEventListener('click',  function(){ _nativeCamHandler('native-cam-rear');  });
$('btn-cam-front').addEventListener('click', function(){ _nativeCamHandler('native-cam-front'); });

// Wire native cam inputs into the same load path as file upload
['native-cam-rear', 'native-cam-front'].forEach(function(id) {
  $(id).addEventListener('change', function(e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    _loadedFile = f;
    var reader = new FileReader();
    reader.onload = function(){ loadOriginalFromUrl(reader.result); };
    reader.onerror = function(){ showError('Could not read file.'); };
    reader.readAsDataURL(f);
  });
});

$('btn-upload').addEventListener('click', function(){
  fileInput.removeAttribute('capture');
  fileInput.click();
});

$('btn-sample').addEventListener('click', function(){
  drawSyntheticFace();
});
$('btn-tips').addEventListener('click', function(){
  $('tips-modal').classList.add('show');
});
$('btn-tips-close').addEventListener('click', function(){
  $('tips-modal').classList.remove('show');
});
$('tips-modal').addEventListener('click', function(e){
  if (e.target === this) this.classList.remove('show');
});
fileInput.addEventListener('change', function(e){
  var f = e.target.files && e.target.files[0];
  if (!f) return;
  _loadedFile = f;
  var reader = new FileReader();
  reader.onload = function(){ loadOriginalFromUrl(reader.result); };
  reader.onerror = function(){ showError('Could not read file.'); };
  reader.readAsDataURL(f);
});

// Synthetic "face" with two tinted irises so the locate flow can be demoed without a camera
function drawSyntheticFace(){
  // Portrait close-up so MediaPipe iris radius lands at ~0.20× stage width after crop scaling
  var c = document.createElement('canvas'); c.width = 600; c.height = 800;
  var ctx = c.getContext('2d');
  // background
  var bg = ctx.createLinearGradient(0,0,0,800);
  bg.addColorStop(0,'#c8b09a'); bg.addColorStop(1,'#a08060');
  ctx.fillStyle = bg; ctx.fillRect(0,0,600,800);
  // face silhouette — fills most of frame for a close-up look
  ctx.fillStyle = '#eac9a8';
  ctx.beginPath(); ctx.ellipse(300, 460, 240, 340, 0, 0, Math.PI*2); ctx.fill();
  // eyebrows
  ctx.strokeStyle = '#6b3a1f'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(110,235); ctx.quadraticCurveTo(180,215,250,240); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(350,240); ctx.quadraticCurveTo(420,215,490,235); ctx.stroke();
  // eyes: subject's right = viewer's left (smaller x), hetero=true; left eye = pure blue
  drawSynthEye(ctx, 182, 305, true);
  drawSynthEye(ctx, 418, 305, false);
  // nose
  ctx.strokeStyle = '#b58f70'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(300,355); ctx.quadraticCurveTo(286,415,300,455); ctx.stroke();
  // mouth
  ctx.strokeStyle = '#8a4e3a'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(238,530); ctx.quadraticCurveTo(300,562,362,530); ctx.stroke();
  loadOriginalFromUrl(c.toDataURL());
}
function drawSynthEye(ctx, cx, cy, hetero){
  var irisR = 50, eyeW = 80, eyeH = 50;
  // sclera
  ctx.fillStyle = '#fafafa';
  ctx.beginPath(); ctx.ellipse(cx, cy, eyeW, eyeH, 0, 0, Math.PI*2); ctx.fill();
  // clip iris to sclera ellipse
  ctx.save();
  ctx.beginPath(); ctx.ellipse(cx, cy, eyeW, eyeH, 0, 0, Math.PI*2); ctx.clip();
  // iris gradient
  var grad = ctx.createRadialGradient(cx,cy,9, cx,cy,irisR);
  if (hetero){
    grad.addColorStop(0.00,'#caa15a');
    grad.addColorStop(0.30,'#caa15a');
    grad.addColorStop(0.45,'#7aa4d0');
    grad.addColorStop(0.90,'#3d6a98');
    grad.addColorStop(1.00,'#1d3a60');
  } else {
    grad.addColorStop(0.00,'#6f9abf');
    grad.addColorStop(0.70,'#4d7aa5');
    grad.addColorStop(1.00,'#23466b');
  }
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx,cy,irisR,0,Math.PI*2); ctx.fill();
  // texture strands
  for (var k=0;k<220;k++){
    var a = Math.random()*Math.PI*2;
    var r1 = 13 + Math.random()*28, r2 = r1+2+Math.random()*5;
    ctx.strokeStyle = 'rgba(255,255,255,'+(0.04+Math.random()*0.08)+')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*r1, cy+Math.sin(a)*r1);
    ctx.lineTo(cx+Math.cos(a)*r2, cy+Math.sin(a)*r2);
    ctx.stroke();
  }
  // limbal ring
  ctx.strokeStyle = 'rgba(10,15,35,0.65)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx,cy,irisR,0,Math.PI*2); ctx.stroke();
  // pupil
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx,cy,13,0,Math.PI*2); ctx.fill();
  // catch-light
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath(); ctx.arc(cx-7, cy-7, 5, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  // lid arcs drawn over clipped area
  ctx.strokeStyle = '#3a2717'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(cx-84, cy-7); ctx.quadraticCurveTo(cx, cy-56, cx+84, cy-7); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx-82, cy+7); ctx.quadraticCurveTo(cx, cy+48, cx+82, cy+7); ctx.stroke();
}

// ======================= STATE =======================
var originalImgEl = null;     // full-face image user loaded
var imgEl = null;             // working (cropped) image used by fit/analyze steps
var imgLoaded = false;
var currentSide = null;       // 'Left' or 'Right'
var cropRegion = null;        // {x,y,w,h} of crop in originalImgEl pixels
var mpEyes = null;            // {Right:{ci,cx,cy}, Left:{ci,cx,cy}} in natural pixels, from MP detection
var isCloseupMode = false;    // true when no face was detected and we used close-up detection directly
var preZoomState  = null;     // {imgEl, cropRegion} saved before zoomToEye so Auto-Fit Again can reset
var mpZoomHint    = null;     // {eyeW, midX, midY} — canthus geometry saved by 1-eye gate for close-up zoom

// ======================= MEDIAPIPE =======================
var mpLandmarker = null;
var mpLoadPromise = null;

function initMediaPipe() {
  if (mpLoadPromise) return mpLoadPromise;
  mpLoadPromise = import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs')
    .then(function(m) {
      return m.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      ).then(function(fs) {
        return m.FaceLandmarker.createFromOptions(fs, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          outputFaceBlendshapes: false,
          runningMode: 'IMAGE',
          numFaces: 1
        });
      }).then(function(lm) { mpLandmarker = lm; return lm; });
    }).catch(function(e) {
      console.warn('MediaPipe init failed:', e);
      mpLoadPromise = null;
      return null;
    });
  return mpLoadPromise;
}
// Start loading immediately so it's ready by the time the user crops
initMediaPipe();
var eyeResults = {};          // { 'Left': resultObj, 'Right': resultObj }
var captureMode = 'analysis'; // 'analysis' | 'portrait' — controls what the
                              // Analyze button does (run analyzer vs. save
                              // a portrait shot to the existing result).

// ======================= LOCATE STAGE =======================
var locCanvas = $('locate-canvas'), lctx = locCanvas.getContext('2d');
var locStageW = 600, locStageH = 600;
var locDraw = { dx:0, dy:0, dw:600, dh:600 };
var locTap = null;      // {sx, sy} in stage pixels, or null
var cropPct = 25;       // crop size as % of longer image side — wide enough to contain iris even with MP landmark error

var loadOriginalFromUrl = function(url){
  var img = new Image();
  img.onload = function(){
    originalImgEl = img;
    mpEyes        = null;
    mpZoomHint    = null;   // clear canthus geometry hint from previous image
    preZoomState  = null;   // clear any leftover zoom state from previous image
    isCloseupMode = false;  // reset — previous photo's close-up state must not carry over
    cropRegion    = null;   // reset — stale crop coords from a different image corrupt applyAutoFit

    // ── Early face upload ──────────────────────────────────────────────────
    // Assign a session ID and push the face photo to Supabase storage NOW,
    // before analysis even starts.  This way the face record exists even if
    // the user closes the tab after seeing the fit but before saving results.
    if (!_sessionId) _sessionId = String(Date.now());
    if (!_sessionFaceUploaded && typeof SUPABASE_URL !== 'undefined' && SUPABASE_URL) {
      _sessionFaceUploaded = true;
      var _faceUrl = url;
      var _facePath = SUPABASE_URL + '/storage/v1/object/iris-photos/' + _sessionId + '-face.jpg';
      fetch(_faceUrl)
        .then(function(r){ return r.blob(); })
        .then(function(blob){
          return fetch(_facePath, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': 'Bearer ' + SUPABASE_KEY,
              'Content-Type': 'image/jpeg'
            },
            body: blob
          });
        })
        .catch(function(){});  // silent — don't block the UI if upload fails
    }
    // ──────────────────────────────────────────────────────────────────────

    $('card-capture').scrollIntoView({behavior:'smooth', block:'start'});
    autoDetectAndJumpToFit();
  };
  img.onerror = function(){ showError('Could not load image.'); };
  img.src = url;
}

function autoDetectAndJumpToFit() {
  $('card-locate').style.display = 'none';
  $('card-fit').style.display = 'block';
  $('card-result').style.display = 'none';
  var hint = $('autofit-hint');
  var sl   = $('fit-side-label');
  if (hint) hint.textContent = 'Detecting eyes…';
  if (sl)   sl.textContent   = 'Detecting…';
  setTimeout(function(){
    $('card-fit').scrollIntoView({behavior:'smooth', block:'start'});
  }, 40);

  initMediaPipe().then(function(lm) {
    if (!lm || !originalImgEl) { $('card-fit').style.display='none'; _tryCloseupFit(); return; }
    try {
      var result = lm.detect(originalImgEl);
      if (!result || !result.faceLandmarks || !result.faceLandmarks.length) {
        $('card-fit').style.display='none'; _tryCloseupFit(); return;
      }
      var L   = result.faceLandmarks[0];
      var imgW = originalImgEl.naturalWidth  || originalImgEl.width;
      var imgH = originalImgEl.naturalHeight || originalImgEl.height;
      // Landmark with smaller x = subject's right eye (left side of photo)
      var rightCI = L[468].x < L[473].x ? 468 : 473;
      var leftCI  = rightCI === 468 ? 473 : 468;

      // ── 1-eye vs 2-eye gate ──────────────────────────────────────────────────
      // Determine upfront whether this is a single-eye close-up or a full-face
      // photo, and branch immediately to the correct path.
      //
      // Single-eye close-ups cause MediaPipe to hallucinate a phantom "second eye"
      // in skin, hair, or cheek texture.  Three reliable signals expose this:
      //
      //   badYLevel    — real two-eye photos have both eyes at ~same vertical
      //                  position (|ry−ly| < 0.12).  A real eye + phantom in the
      //                  cheek always differ by more than 12 % of image height.
      //   badPlacement — either "iris" landmark sits below 60 % of image height
      //                  (cheek / mouth territory — never a real iris position).
      //   badIPD       — the two detected iris centres are < 6 % of image width
      //                  apart (coincident — something is very wrong).
      //
      // On any hit: route directly to _tryCloseupFit() rather than showLocate().
      // Single-eye close-ups are fully automatable via the close-up cascade;
      // there is no need to ask the user to manually tap the eye.
      var ry = L[rightCI].y, ly = L[leftCI].y;
      var ipdFrac = Math.abs(L[468].x - L[473].x);
      var badYLevel    = (Math.abs(ry - ly) > 0.12);
      var badPlacement = (ry > 0.60 || ly > 0.60);
      var badIPD       = (ipdFrac < 0.06);
      // Guard: nose proportion — the most reliable single-eye close-up signal.
      // On a real face the nose tip sits 35–50 % of the way from eye level to chin.
      // When MediaPipe hallucinates a face on a single-eye close-up the phantom
      // nose ends up barely below the phantom eyes (< 25 % of eye-to-chin span)
      // because there is no real nose/chin structure to anchor the mesh.
      // Landmark 1 = nose tip, landmark 152 = chin.
      var _noseTip = L[1], _chin = L[152];
      var _avgIrisY  = (ry + ly) / 2;
      var _eyeToChin = _chin.y - _avgIrisY;
      var _noseFrac  = _eyeToChin > 0.05 ? (_noseTip.y - _avgIrisY) / _eyeToChin : 1.0;
      var badNoseProp = (_noseFrac < 0.25);
      if (badYLevel || badPlacement || badIPD || badNoseProp) {
        console.warn('1-eye gate → closeup: ry=' + ry.toFixed(3) +
                     ' ly=' + ly.toFixed(3) + ' ipdFrac=' + ipdFrac.toFixed(3) +
                     ' noseFrac=' + _noseFrac.toFixed(3) +
                     ' badYLevel=' + badYLevel + ' badPlacement=' + badPlacement +
                     ' badIPD=' + badIPD + ' badNoseProp=' + badNoseProp);
        // Save canthus geometry for close-up zoom calibration.
        // The right-eye canthus landmarks (L[33]=outer, L[133]=inner) correspond to the
        // real visible eye even when the face mesh is hallucinated — they are more stable
        // than the iris perimeter.  zoomToEye uses this hint instead of iR×2.0.
        // Target framing: eye opening fills ~95 % of frame width → pad = eyeW × 0.53.
        var _hOC = L[rightCI === 468 ? 33 : 263];
        var _hIC = L[rightCI === 468 ? 133 : 362];
        var _hdx = (_hOC.x - _hIC.x) * imgW, _hdy = (_hOC.y - _hIC.y) * imgH;
        mpZoomHint = {
          eyeW: Math.sqrt(_hdx*_hdx + _hdy*_hdy),
          midX: ((_hOC.x + _hIC.x) / 2) * imgW,
          midY: ((_hOC.y + _hIC.y) / 2) * imgH
        };
        console.log('mpZoomHint: eyeW=' + Math.round(mpZoomHint.eyeW) +
                    ' midX=' + Math.round(mpZoomHint.midX) +
                    ' midY=' + Math.round(mpZoomHint.midY));
        $('card-fit').style.display = 'none';
        _tryCloseupFit();
        return;
      }

      // Eye corner landmarks (canthus points — far more stable than iris centre on
      // extreme close-ups where the iris landmark can misfire to eyelid/sclera).
      // Right eye: outer corner=33, inner corner=133
      // Left eye:  inner corner=362, outer corner=263
      function _eyeCornerSpan(oc, ic) {
        var dx = (oc.x - ic.x) * imgW, dy = (oc.y - ic.y) * imgH;
        return Math.sqrt(dx*dx + dy*dy);
      }
      var _rOC = L[33], _rIC = L[133], _lIC = L[362], _lOC = L[263];
      var _rEyeW = _eyeCornerSpan(_rOC, _rIC);
      var _lEyeW = _eyeCornerSpan(_lOC, _lIC);
      mpEyes = {
        Right: { ci: rightCI, cx: L[rightCI].x * imgW, cy: L[rightCI].y * imgH,
                 eyeW: _rEyeW,
                 eyeMidX: ((_rOC.x + _rIC.x) / 2) * imgW,
                 eyeMidY: ((_rOC.y + _rIC.y) / 2) * imgH },
        Left:  { ci: leftCI,  cx: L[leftCI].x  * imgW, cy: L[leftCI].y  * imgH,
                 eyeW: _lEyeW,
                 eyeMidX: ((_lOC.x + _lIC.x) / 2) * imgW,
                 eyeMidY: ((_lOC.y + _lIC.y) / 2) * imgH }
      };
      var startSide = eyeResults['Right'] ? 'Left' : 'Right';

      // ── Macro close-up detection ─────────────────────────────────────────────
      // Two independent signals — either is sufficient to route to close-up:
      //
      //   _irMacro   — iris landmark perimeter radius > 10 % of image width.
      //                Reliable when MP landmarks are accurate; can be falsely
      //                small when landmarks are bunched at the wrong location.
      //
      //   _maxEyeW   — largest canthus-to-canthus span > 15 % of image width.
      //                Canthus landmarks are more stable than iris perimeter
      //                landmarks on close-ups.  Full-face portraits have eyeW
      //                ≈ 8–12 % of image width; close-ups have 20–50 %.
      //                Threshold 15 % cleanly separates the two cases without
      //                depending on iris perimeter accuracy.
      var _startCI = startSide === 'Right' ? rightCI : leftCI;
      var _irMacro = 0;
      for (var _mk = 1; _mk <= 4; _mk++) {
        var _mp = L[_startCI + _mk];
        var _mdx = (_mp.x - L[_startCI].x) * imgW;
        var _mdy = (_mp.y - L[_startCI].y) * imgH;
        _irMacro += Math.sqrt(_mdx * _mdx + _mdy * _mdy);
      }
      _irMacro /= 4;
      if (_irMacro > imgW * 0.10) {
        console.warn('Macro close-up detected — ir=' + Math.round(_irMacro) +
                     ' imgW=' + imgW +
                     ' — routing to closeup fit');
        $('card-fit').style.display = 'none';
        _tryCloseupFit();
        return;
      }
      // ────────────────────────────────────────────────────────────────────────

      jumpToEye(startSide);
    } catch(e) {
      console.warn('Eye auto-detect failed:', e);
      $('card-fit').style.display='none';
      _tryCloseupFit();
    }
  });
}

function jumpToEye(side) {
  if (!mpEyes || !mpEyes[side]) { showLocate(); return; }
  // Clear any pre-zoom state from the previous eye — applyAutoFit restores it
  // on "Auto-Fit Again", but when switching eyes it would wrongly restore the
  // other eye's crop and corrupt cropRegion / imgEl.
  preZoomState = null;
  var eye  = mpEyes[side];
  var imgW = originalImgEl.naturalWidth  || originalImgEl.width;
  var imgH = originalImgEl.naturalHeight || originalImgEl.height;
  // Per-eye guard: if this eye's landmark Y sits below 62 % of the image
  // it is almost certainly on the cheek — show manual locate instead.
  if (imgH > 0 && eye.cy / imgH > 0.62) {
    console.warn('jumpToEye(' + side + ') landmark Y=' + (eye.cy/imgH).toFixed(3) +
                 ' > 0.62 — landmark in cheek zone, falling back to manual locate');
    showLocate(); return;
  }
  // Crop sizing: prefer corner-span × 1.5 (stable for all zoom levels) over the
  // fixed cropPct fallback. Corner midpoint centres the crop even when the iris
  // landmark has misfired (e.g. close-up where MP places the iris in the eyelid).
  var _cropCx, _cropCy, cropR;
  if (eye.eyeW && eye.eyeW > 20) {
    cropR   = eye.eyeW * 1.50;          // 1.50× eye-corner span — enough room for close-up iris + sclera margin on both sides
    _cropCx = eye.eyeMidX;
    _cropCy = eye.eyeMidY;
    console.log('jumpToEye(' + side + ') corner-span=' + Math.round(eye.eyeW) +
                ' cropR=' + Math.round(cropR));
  } else {
    var longer = Math.max(imgW, imgH);
    cropR   = longer * (cropPct / 100) / 2;
    _cropCx = eye.cx;
    _cropCy = eye.cy;
  }
  var cx0 = Math.max(0, Math.round(_cropCx - cropR));
  var cy0 = Math.max(0, Math.round(_cropCy - cropR));
  var cx1 = Math.min(imgW, Math.round(_cropCx + cropR));
  var cy1 = Math.min(imgH, Math.round(_cropCy + cropR));
  var cw = cx1 - cx0, ch = cy1 - cy0;
  // Hard minimum: a crop smaller than 120px gives the colour engine too few
  // iris pixels for reliable sampling. Fall back to the full-image close-up
  // path which uses center-bias-off detection on the original image.
  if (cw < 120 || ch < 120) { _tryCloseupFit(); return; }
  if (cw < 40  || ch < 40)  { showLocate(); return; }

  currentSide = side;
  cropRegion  = { x: cx0, y: cy0, w: cw, h: ch };

  var off = document.createElement('canvas');
  off.width = cw; off.height = ch;
  off.getContext('2d', { colorSpace: 'srgb' }).drawImage(originalImgEl, cx0, cy0, cw, ch, 0, 0, cw, ch);
  var img = new Image();
  img.onload = function() {
    imgEl = img; imgLoaded = true;
    $('card-locate').style.display = 'none';
    $('card-fit').style.display    = 'block';
    $('card-result').style.display = 'none';
    $('fit-side-label').textContent = side + ' Eye';
    _updateSwitchEyeBtn(side);
    setTimeout(function() {
      layoutStage();
      applyAutoFit();
      $('card-fit').scrollIntoView({behavior:'smooth', block:'start'});
    }, 50);
  };
  img.src = off.toDataURL();
}

function _updateSwitchEyeBtn(activeSide) {
  var btn = $('btn-switch-eye');
  if (!btn) return;
  if (mpEyes) {
    var other = activeSide === 'Right' ? 'Left' : 'Right';
    btn.textContent = 'Switch to ' + other + ' Eye';
    btn.style.display = '';
  } else {
    btn.style.display = 'none';
  }
}

function showLocate(){
  $('card-locate').style.display = 'block';
  $('card-fit').style.display = 'none';
  // When re-locating, keep previous result on screen only if we're about to analyze the OTHER eye
  // Otherwise hide it.
  if (!currentSide) $('card-result').style.display = 'none';
  locTap = null;
  $('btn-zoom-in').disabled = true;
  $('btn-zoom-in').style.opacity = '0.5';
  setTimeout(function(){
    layoutLocate();
    $('card-locate').scrollIntoView({behavior:'smooth', block:'start'});
  }, 40);
  // If we already have one eye result, adjust titles to steer user to the OTHER eye
  var firstDone = eyeResults['Left'] ? 'Left' : (eyeResults['Right'] ? 'Right' : null);
  if (firstDone){
    var other = firstDone === 'Left' ? 'Right' : 'Left';
    $('locate-title').textContent = 'Now tap on the ' + other.toLowerCase() + ' eye';
    $('locate-sub').textContent = 'That’s the one on the ' + (other === 'Left' ? 'right side of the photo' : 'left side of the photo') + ' as you look at it.';
  } else {
    $('locate-title').textContent = 'Tap on the eye you want to analyze';
    $('locate-sub').textContent = 'We’ll zoom in and fit the iris ring automatically on the next step.';
  }
}

function sizeLocCanvas(){
  var stage = $('locate-stage');
  var rect = stage.getBoundingClientRect();
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  locStageW = Math.round(rect.width);
  locStageH = Math.round(rect.height);
  locCanvas.width  = locStageW * dpr;
  locCanvas.height = locStageH * dpr;
  locCanvas.style.width  = locStageW + 'px';
  locCanvas.style.height = locStageH + 'px';
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function layoutLocate(){
  if (!originalImgEl) return;
  sizeLocCanvas();
  var ar = originalImgEl.width / originalImgEl.height;
  var dw = locStageW, dh = locStageH;
  if (ar > 1) dh = locStageW / ar; else dw = locStageH * ar;
  locDraw.dx = (locStageW - dw) / 2;
  locDraw.dy = (locStageH - dh) / 2;
  locDraw.dw = dw;
  locDraw.dh = dh;
  drawLocate();
}

function drawLocate(){
  if (!originalImgEl) return;
  lctx.fillStyle = '#000'; lctx.fillRect(0,0,locStageW, locStageH);
  lctx.drawImage(originalImgEl, locDraw.dx, locDraw.dy, locDraw.dw, locDraw.dh);
  if (locTap){
    // translate crop % to a radius in stage pixels based on the LONGER image dimension
    var longer = Math.max(locDraw.dw, locDraw.dh);
    var rStage = longer * (cropPct / 100) / 2;
    // dim outside the crop box
    lctx.save();
    lctx.fillStyle = 'rgba(0,0,0,0.55)';
    lctx.beginPath();
    lctx.rect(0,0,locStageW, locStageH);
    lctx.rect(locTap.sx - rStage, locTap.sy - rStage, rStage*2, rStage*2);
    lctx.fill('evenodd');
    lctx.restore();
    // crosshair + box
    lctx.strokeStyle = '#6cc4ff'; lctx.lineWidth = 2;
    lctx.strokeRect(locTap.sx - rStage, locTap.sy - rStage, rStage*2, rStage*2);
    lctx.strokeStyle = '#ffffffcc';
    lctx.beginPath();
    lctx.moveTo(locTap.sx - 10, locTap.sy); lctx.lineTo(locTap.sx + 10, locTap.sy);
    lctx.moveTo(locTap.sx, locTap.sy - 10); lctx.lineTo(locTap.sx, locTap.sy + 10);
    lctx.stroke();
    // side label
    var imgCx = locTap.sx - locDraw.dx;
    var side = (imgCx < locDraw.dw / 2) ? 'Right Eye' : 'Left Eye'; // "your right eye" appears on left side of image
    lctx.fillStyle = '#ffd66c'; lctx.font = '700 13px -apple-system, system-ui, sans-serif';
    lctx.textAlign = 'center';
    lctx.fillText(side, locTap.sx, locTap.sy - rStage - 8);
  }
}

function handleLocateTap(clientX, clientY){
  if (!originalImgEl) return;
  var rect = locCanvas.getBoundingClientRect();
  var sx = clientX - rect.left, sy = clientY - rect.top;
  // only accept taps within the image area
  if (sx < locDraw.dx || sx > locDraw.dx + locDraw.dw ||
      sy < locDraw.dy || sy > locDraw.dy + locDraw.dh) return;
  locTap = { sx: sx, sy: sy };
  $('btn-zoom-in').disabled = false;
  $('btn-zoom-in').style.opacity = '1';
  drawLocate();
}
locCanvas.addEventListener('click', function(ev){ handleLocateTap(ev.clientX, ev.clientY); });
locCanvas.addEventListener('touchstart', function(ev){
  if (!ev.touches || !ev.touches[0]) return;
  handleLocateTap(ev.touches[0].clientX, ev.touches[0].clientY);
  ev.preventDefault();
}, {passive:false});
$('r-crop').addEventListener('input', function(e){ cropPct = +e.target.value; drawLocate(); });

$('btn-locate-back').addEventListener('click', function(){
  $('card-locate').style.display = 'none';
  window.scrollTo({top: 0, behavior: 'smooth'});
});

$('btn-zoom-in').addEventListener('click', function(){
  if (!locTap || !originalImgEl) return;
  // Convert tap to natural-pixel coordinates (drawImage source & MediaPipe use natural pixels)
  var nw = originalImgEl.naturalWidth  || originalImgEl.width;
  var nh = originalImgEl.naturalHeight || originalImgEl.height;
  var sx = locTap.sx - locDraw.dx;
  var sy = locTap.sy - locDraw.dy;
  var scaleX = nw / locDraw.dw;
  var scaleY = nh / locDraw.dh;
  var ix = sx * scaleX, iy = sy * scaleY;
  var longer = Math.max(nw, nh);
  var cropR = longer * (cropPct / 100) / 2;
  var cx0 = Math.max(0, Math.round(ix - cropR));
  var cy0 = Math.max(0, Math.round(iy - cropR));
  var cx1 = Math.min(nw, Math.round(ix + cropR));
  var cy1 = Math.min(nh, Math.round(iy + cropR));
  var cw = cx1 - cx0, ch = cy1 - cy0;
  if (cw < 40 || ch < 40){ showError('Crop too small. Enlarge crop size.'); return; }
  cropRegion = {x: cx0, y: cy0, w: cw, h: ch};
  // Determine L/R side label using natural-pixel midpoint
  currentSide = (ix < nw / 2) ? 'Right' : 'Left';
  // Build cropped image canvas from natural-pixel source region
  var off = document.createElement('canvas');
  off.width = cw; off.height = ch;
  var octx = off.getContext('2d', { colorSpace: 'srgb' });
  octx.drawImage(originalImgEl, cx0, cy0, cw, ch, 0, 0, cw, ch);
  var img = new Image();
  img.onload = function(){
    imgEl = img; imgLoaded = true;
    $('card-locate').style.display = 'none';
    $('card-fit').style.display = 'block';
    $('card-result').style.display = 'none';
    $('fit-side-label').textContent = currentSide + ' Eye';
    setTimeout(function(){
      layoutStage();
      applyAutoFit();
      $('card-fit').scrollIntoView({behavior:'smooth', block:'start'});
    autoRunFit();
    }, 50);
  };
  img.onerror = function(){ showError('Could not crop image.'); };
  img.src = off.toDataURL();
});

function applyAutoFit(){
  if (!imgEl) return false;
  // Restore pre-zoom state so we always fit on the original (un-zoomed) image
  if (preZoomState) {
    imgEl       = preZoomState.imgEl;
    cropRegion  = preZoomState.cropRegion;
    preZoomState = null;
    layoutStage();
  }
  var hint = $('autofit-hint');
  var st   = $('autofit-status');
  if (hint) hint.textContent = 'Detecting iris…';
  if (st)   st.textContent   = ' ';
  var retakeBtn = $('btn-quality-retake');
  if (retakeBtn) retakeBtn.style.display = 'none';
  window.currentEyeShape = null; // reset per-eye; set below when MP landmarks are available

  initMediaPipe().then(function(lm) {
    if (!lm || !originalImgEl) { _applyFitClassical(); return; }
    try {
      var result = lm.detect(originalImgEl);
      if (!result || !result.faceLandmarks || !result.faceLandmarks.length) {
        if (hint) hint.textContent = 'Face not detected — using fallback';
        _applyFitClassical(isCloseupMode); return;
      }
      var L = result.faceLandmarks[0];
      var imgW = originalImgEl.naturalWidth || originalImgEl.width;
      var imgH = originalImgEl.naturalHeight || originalImgEl.height;

      // currentSide 'Right' = subject's right = LEFT side of image (smaller x)
      // currentSide 'Left'  = subject's left  = RIGHT side of image (larger x)
      var ci;
      if (currentSide === 'Right') {
        ci = (L[468].x < L[473].x) ? 468 : 473;
      } else {
        ci = (L[468].x > L[473].x) ? 468 : 473;
      }

      var c = L[ci];
      // Average radius from center to 4 boundary landmarks
      var ir = 0;
      for (var k = 1; k <= 4; k++) {
        var p = L[ci + k];
        var dx = (p.x - c.x) * imgW, dy = (p.y - c.y) * imgH;
        ir += Math.sqrt(dx*dx + dy*dy);
      }
      ir /= 4;
      if (ir < 4) { if (hint) hint.textContent = 'Iris too small — using fallback'; _applyFitClassical(isCloseupMode); return; }

      // For tilted faces MediaPipe's iris boundary landmarks project to an artificially
      // small radius. Floor ir against an IPD-based estimate.
      // The human iris diameter is ~17% of IPD, so iris RADIUS ≈ 8.5% of IPD.
      // (0.17 was the original constant but it measures diameter, not radius — using it
      // as a radius floor doubles the estimate and inflates the zoom crop 2×.)
      var ipdPx = Math.hypot((L[468].x - L[473].x) * imgW, (L[468].y - L[473].y) * imgH);
      if (ipdPx > 20) ir = Math.max(ir, ipdPx * 0.085);

      // Eye shape classification — uses eyelid corner + lid-peak landmarks
      window.currentEyeShape = _classifyEyeShape(L, currentSide, imgW, imgH);

      // Transform from originalImgEl space → cropped imgEl space → stage
      var cx_img = c.x * imgW - (cropRegion ? cropRegion.x : 0);
      var cy_img = c.y * imgH - (cropRegion ? cropRegion.y : 0);

      // Step 1: Refine pupil center — pupil is always the darkest region
      var refined = findPupilCenter(imgEl, cx_img, cy_img, ir * 0.55);
      var cxPupil_img = cx_img, cyPupil_img = cy_img;
      if (refined) {
        var shiftX = refined.cx - cx_img, shiftY = refined.cy - cy_img;
        if (Math.sqrt(shiftX*shiftX + shiftY*shiftY) < ir * 0.5) {
          cxPupil_img = refined.cx;
          cyPupil_img = refined.cy;
        }
      }

      // Step 2a: Pupil radius (needed as guard for horizontal limbus scan secondary)
      var pupilR_pre = findPupilRadiusByRays(imgEl, cxPupil_img, cyPupil_img, ir);

      // Step 2b: Iris OD — three-tier cascade:
      //   Primary:   RIP (full-circle mean intensity profile, confidence-scored)
      //   Secondary: horizontal gradient scan (3/9 o'clock + near-horizontal rays)
      //   Tertiary:  ring-contrast global search, then raw MediaPipe radius
      var cxIris_img, cyIris_img, irisR_img, radSrc;
      var rip1 = findIrisODByRIP(imgEl, cxPupil_img, cyPupil_img, ir);
      // Threshold 0.35: close-up images score 0.35+; full-face portrait crops score
      // lower (~0.15–0.30) because the limbus transition is softer at portrait resolution.
      // When RIP confidence is below 0.35, fall through to ODH which uses a capped
      // search range (irisRHint = ir) so it stays within the iris zone.
      if (rip1 && rip1.confidence >= 0.35 && rip1.irisR > ir * 0.4 && rip1.irisR < ir * 3.5) {
        cxIris_img = cx_img;
        cyIris_img = cy_img;
        irisR_img  = rip1.irisR;
        radSrc = 'RIP' + Math.round(rip1.confidence * 10);
      } else {
        // Secondary: horizontal gradient scan with iris-radius cap to stay within iris zone
        var odh = findIrisODHorizontal(imgEl, cxPupil_img, cyPupil_img, pupilR_pre, ir);
        if (odh && odh.irisR > ir * 0.4 && odh.irisR < ir * 1.6) {
          cxIris_img = odh.cxIris;
          cyIris_img = cy_img;
          irisR_img  = odh.irisR;
          radSrc = 'OD';
        } else {
          // Tertiary: ring contrast (global search)
          var rc = findIrisByRingContrast(imgEl, cx_img, cy_img, ir);
          if (rc) {
            cxIris_img = cx_img;
            cyIris_img = cy_img;
            irisR_img  = rc.r;
            radSrc = 'RC' + Math.round(rc.score);
          } else {
            // Tier 3.5: saturation ring profile — for dark irises where luminance fails
            var sat = findIrisODBySaturation(imgEl, cx_img, cy_img, ir);
            if (sat && sat.confidence >= 0.25 && sat.irisR > ir * 0.4 && sat.irisR < ir * 1.5) {
              cxIris_img = cx_img;
              cyIris_img = cy_img;
              irisR_img  = sat.irisR;
              radSrc = 'SAT' + Math.round(sat.confidence * 100);
            } else {
              // Last resort: radial scan or raw MP hint
              cxIris_img = cx_img;
              cyIris_img = cy_img;
              var scanR = findIrisRadiusByRadialScan(imgEl, cx_img, cy_img, ir, 1.35);
              irisR_img  = (scanR && scanR > 6) ? scanR : ir;
              radSrc = (scanR && scanR > 6) ? 'scan' : 'MP';
            }
          }
        }
      }
      // IPD-based radius floor: horizontal scan / RC / scan can return too-small a radius
      // for dark irises or tilted faces where limbus contrast is low. The IPD estimate
      // gives a reliable minimum — human iris radius ≈ 8.5% of inter-pupillary distance
      // (iris diameter ≈ 17% of IPD; divide by 2 to get the radius floor).
      if (ipdPx > 20) irisR_img = Math.max(irisR_img, ipdPx * 0.085);
      // Collarette guard: if the cascade anchored on the inner amber ring,
      // scan outward to find the true limbus.
      irisR_img = findLimbusBySaturation(imgEl, cxPupil_img, cyPupil_img, irisR_img);

      // Macro close-up guard: if the MediaPipe cascade returned a very small iris
      // on a jumpToEye crop (<12% of shorter crop side), the MediaPipe radius hint
      // was too small and all cascade tiers searched the wrong range.
      //
      // Strategy: anchor a RIP scan at the CASCADE centre (from MP iris landmark —
      // approximately correct in position even when radius is wrong) and try
      // increasing radius hints until we find the true limbus.  This avoids the
      // autoFit false-positive on brow/hair/eye-socket features.
      // Fallback if RIP fails: use autoFit for the centre, then let the sclera-pair
      // sweep in _tryCloseupFit find the precise iris location.
      // Either path routes back to _tryCloseupFit WITHOUT _fromBand so the
      // sclera-pair scan (now with a sweep) refines the centre before zoom.
      if (cropRegion != null &&
          irisR_img < Math.min(imgEl.width, imgEl.height) * 0.12) {
        // ── Step 0: Sclera-pair sweep on the jumpToEye CROP ───────────────────
        // For full-face portraits (Bryan-type): the crop shows ONE eye, so the
        // bilateral sclera scan reliably finds the iris without detecting the
        // opposite eye (which would dominate on the full-original sweep).
        // For macro close-ups (Iliana-type): the iris fills >18% of the crop width,
        // exceeding _scleraPairScan's halfwidth ceiling — returns null, falls through
        // to the RIP cascade below.
        var _mgCropPair = null, _mgCropBestScore = 20;
        var _mgCropSweepFracs = [0.35, 0.40, 0.45, 0.50, 0.55, 0.60];
        for (var _mgCSI = 0; _mgCSI < _mgCropSweepFracs.length; _mgCSI++) {
          var _mgCSY = Math.round(imgEl.height * _mgCropSweepFracs[_mgCSI]);
          var _mgCSP = _scleraPairScan(imgEl, _mgCSY);
          if (_mgCSP && _mgCSP.score > _mgCropBestScore) {
            _mgCropPair = _mgCSP; _mgCropBestScore = _mgCSP.score;
          }
        }
        if (_mgCropPair) {
          var _mgCXO = Math.round(cropRegion.x + _mgCropPair.cx);
          var _mgCYO = Math.round(cropRegion.y + _mgCropPair.cy);
          // Consistency check: the crop pair's radius should be plausible given the
          // cascade estimate. For full-face portraits (Bryan-type), the cascade found
          // a small but roughly correct iris — the crop scan should agree (ratio ≤ 2×).
          // For macro close-ups (Iliana-type), the iris exceeds the scan's halfwidth
          // ceiling so a true iris pair is impossible; the scan can still find a weak
          // false pair (e.g. eyelid/lash brightness) at 2-4× cascadeR — reject those.
          if (_mgCropPair.r <= irisR_img * 2.0) {
            // Scale radius from crop-pixel space → original-image space so zoomToEye
            // computes the correct pad. irisR_img and _mgCropPair.r are both in crop
            // space; the sanity floor and zoomToEye both operate in original space.
            var _mgCropToOrigScale = originalImgEl.width / imgEl.width;
            var _mgIrisR_orig = Math.round(_mgCropPair.r * _mgCropToOrigScale);
            console.log('[MACRO-GUARD] crop sclera-pair: cx=' + _mgCXO + ' cy=' + _mgCYO +
                        ' irisR_crop=' + Math.round(_mgCropPair.r) + ' irisR_orig=' + _mgIrisR_orig +
                        ' (scale×' + _mgCropToOrigScale.toFixed(2) + ')' +
                        ' score=' + Math.round(_mgCropBestScore));
            mpZoomHint = { midX: _mgCXO, midY: _mgCYO, irisR: _mgIrisR_orig, _fromBand: true, _macroGuardCrop: true };
            imgEl = originalImgEl; cropRegion = null; isCloseupMode = true;
            _tryCloseupFit(); return;
          } else {
            console.log('[MACRO-GUARD] crop sclera-pair r=' + Math.round(_mgCropPair.r) +
                        ' > cascadeR×2 (' + Math.round(irisR_img*2) + ') — likely macro close-up, using RIP');
          }
        }
        // ─────────────────────────────────────────────────────────────────────
        var _mgRipR = null;
        for (var _mgScale = 1.5; _mgScale <= 5.0 && !_mgRipR; _mgScale += 0.5) {
          var _mgHint = Math.round(irisR_img * _mgScale);
          var _mgRip  = findIrisODByRIP(imgEl, cxIris_img, cyIris_img, _mgHint);
          if (_mgRip && _mgRip.confidence >= 0.05 && _mgRip.irisR > irisR_img * 1.5) {
            _mgRipR = _mgRip.irisR;
          }
        }
        var _mgCxOrig, _mgCyOrig;
        if (_mgRipR) {
          // RIP found the limbus from the cascade centre — use cascade centre coords
          _mgCxOrig = cropRegion.x + cxIris_img;
          _mgCyOrig = cropRegion.y + cyIris_img;
          console.log('[MACRO-GUARD] cascadeR=' + Math.round(irisR_img) +
                      ' → ripR=' + Math.round(_mgRipR) +
                      ' cx_orig=' + Math.round(_mgCxOrig) +
                      ' cy_orig=' + Math.round(_mgCyOrig) +
                      ' — routing via sclera-pair sweep on original');
        } else {
          // RIP failed — fall back to autoFit for approximate centre
          var _macroFit = autoFit(imgEl, true);
          if (_macroFit && _macroFit.rIrisFrac > (irisR_img / imgEl.width) * 2.0) {
            _mgCxOrig = cropRegion.x + _macroFit.cxFrac * imgEl.width;
            _mgCyOrig = cropRegion.y + _macroFit.cyFrac * imgEl.height;
            console.log('[MACRO-GUARD] cascadeR=' + Math.round(irisR_img) +
                        ' RIP failed → autoFit cx_orig=' + Math.round(_mgCxOrig) +
                        ' cy_orig=' + Math.round(_mgCyOrig) +
                        ' — routing via sclera-pair sweep on original');
          }
        }
        if (_mgCxOrig != null) {
          // Route to _tryCloseupFit WITHOUT _fromBand so the sclera-pair sweep
          // can refine the centre from the approximate hint.
          // _ripR carries the RIP radius so the sweep can validate its result.
          //
          // IMPORTANT: _mgRipR is in CROP pixel coordinates (imgEl is the jumpToEye
          // crop). The sclera-pair sweep in _tryCloseupFit runs on originalImgEl.
          // Scale _ripR to original-image coordinates before storing in mpZoomHint
          // so the false-pair threshold comparison uses the same coordinate system.
          var _mgRipR_origScale = _mgRipR ? Math.round(_mgRipR * (originalImgEl.width / imgEl.width)) : 0;
          console.log('[MACRO-GUARD] RIP ripR=' + (_mgRipR ? Math.round(_mgRipR) : 0) +
                      ' (crop) → ' + _mgRipR_origScale + ' (orig, scale×' +
                      (originalImgEl.width / imgEl.width).toFixed(2) + ')');
          mpZoomHint = { midX: Math.round(_mgCxOrig), midY: Math.round(_mgCyOrig), eyeW: 0,
                         _ripR: _mgRipR_origScale };
          imgEl      = originalImgEl;
          cropRegion = null;
          isCloseupMode = true;
          _tryCloseupFit();
          return;
        }
      }

      // Step 3: Pupil radius via 8-ray scan anchored on pupil center
      var pupilR_img = findPupilRadiusByRays(imgEl, cxPupil_img, cyPupil_img, irisR_img);

      var scaleX = drawInfo.dw / imgEl.width;
      var scaleY = drawInfo.dh / imgEl.height;
      donut.cx     = drawInfo.dx + cxIris_img  * scaleX;
      donut.cy     = drawInfo.dy + cyIris_img  * scaleY;
      donut.cxPupil = drawInfo.dx + cxPupil_img * scaleX;
      donut.cyPupil = drawInfo.dy + cyPupil_img * scaleY;

      var ripx = Math.min(irisR_img  * scaleX, Math.min(stageW,stageH) * 0.45);
      var rpx  = Math.max(6, Math.min(pupilR_img * scaleX, ripx * 0.26));  // cap reduced from 0.32

      donut.rIris  = ripx;
      donut.rPupil = rpx;
      draw();
      if (validateIrisFit()) {
        if (hint) hint.textContent = 'Auto-fit complete. Drag to adjust, then tap "Analyze Iris".';
        if (hint) hint.style.color = '';
        if (st)   st.textContent   = 'MP+' + radSrc + ' ri=' + Math.round(ripx) + ' rp=' + Math.round(rpx) + ' cxI=' + Math.round(cxIris_img) + ' cxP=' + Math.round(cxPupil_img);
        // validateIrisFit already confirmed sclera is brighter than iris at 1.2×iR,
        // so skipSanityCheck=true: the in-zoom luminance check is redundant and can
        // abort valid zooms on colourful irises (amber collarette, hazel eyes).
        zoomToEye(true);
      } else {
        // MP position failed validation — try classical CV before falling back to manual
        _applyFitClassical(isCloseupMode);
      }
    } catch(e) {
      console.warn('MediaPipe detect error:', e);
      if (hint) hint.textContent = 'Detection error — using fallback';
      _applyFitClassical(isCloseupMode);
    }
  });
}

// ---- Eye shape classifier (MediaPipe landmarks) ----
// Uses eyelid corner landmarks and upper/lower lid peaks to compute
// aspect ratio and canthal tilt, then classifies into 5 shapes.
// Landmark indices (MediaPipe 478-point face mesh):
//   Right eye (subject's right, viewer's left): outer=33, inner=133, top=159, bot=145
//   Left  eye (subject's left, viewer's right): outer=263, inner=362, top=386, bot=374
function _classifyEyeShape(L, side, imgW, imgH) {
  try {
    var outer, inner, upper, lower;
    if (side === 'Right') {
      outer = L[33];  inner = L[133]; upper = L[159]; lower = L[145];
    } else {
      outer = L[263]; inner = L[362]; upper = L[386]; lower = L[374];
    }
    if (!outer || !inner || !upper || !lower) return null;
    // Eye width: corner-to-corner distance
    var eyeW = Math.hypot((outer.x - inner.x) * imgW, (outer.y - inner.y) * imgH);
    if (eyeW < 8) return null;
    // Eye height: upper-lid-peak to lower-lid-valley distance
    var eyeH = Math.hypot((upper.x - lower.x) * imgW, (upper.y - lower.y) * imgH);
    var ar = eyeH / eyeW;  // aspect ratio: round eyes >0.33, narrow <0.21
    // Canthal tilt: angle of line from inner corner to outer corner.
    // Using abs(dx) so formula is identical for both eyes.
    // tiltDeg > 0 = outer corner HIGHER (upturned); < 0 = outer lower (downturned).
    var dx = Math.abs(outer.x - inner.x) * imgW;
    var dy = (outer.y - inner.y) * imgH;      // positive = outer lower = downturned
    var tiltDeg = Math.atan2(-dy, dx) * 180 / Math.PI;
    // Classify
    var label;
    if      (tiltDeg >  6)  label = 'Upturned';
    else if (tiltDeg < -6)  label = 'Downturned';
    else if (ar      > 0.33) label = 'Round';
    else if (ar      < 0.21) label = 'Narrow';
    else                    label = 'Almond';
    return {
      label:    label,
      ar:       Math.round(ar      * 100) / 100,
      tiltDeg:  Math.round(tiltDeg * 10)  / 10
    };
  } catch(e) {
    return null;
  }
}

function _applyFitClassical(closeup, skipZoom){
  if (!imgEl) return false;
  var hint = $('autofit-hint');
  var st   = $('autofit-status');
  try {
    var fit = autoFit(imgEl, !!closeup);
    var scaleX = drawInfo.dw / imgEl.width;
    var scaleY = drawInfo.dh / imgEl.height;

    // Macro close-up guard: if full-face autoFit found a very small iris on a
    // jumpToEye crop (rIrisFrac < 0.08), the image is likely a macro close-up
    // where the iris fills the frame and the full-face model cannot see the
    // sclera boundary clearly.  Fall back to the close-up cascade immediately
    // — it floors the RIP search at 0.28×shorter-side so the true limbus is
    // in range even when autoFit's initial estimate is too small.
    if (!closeup && cropRegion != null && fit.rIrisFrac > 0 && fit.rIrisFrac < 0.08) {
      console.log('[MACRO-GUARD] rIrisFrac=' + fit.rIrisFrac.toFixed(3) +
                  ' < 0.08 on jumpToEye crop → switching to closeup cascade');
      _applyFitClassical(true, skipZoom);
      return;
    }

    // Close-up: refine pupil center with weighted-centroid dark-pixel scan —
    // same findPupilCenter() step the MediaPipe full-face path uses.
    // This ensures close-up independent centers match full-face accuracy (#5).
    var cxPupil_cu = fit.cxPupilFrac != null ? fit.cxPupilFrac * imgEl.width  : fit.cxFrac * imgEl.width;
    var cyPupil_cu = fit.cyPupilFrac != null ? fit.cyPupilFrac * imgEl.height : fit.cyFrac * imgEl.height;
    if (closeup && fit.ok) {
      var cuHintR = Math.max(8, fit.rPupilFrac * imgEl.width * 1.6);
      var cuRef   = findPupilCenter(imgEl, cxPupil_cu, cyPupil_cu, cuHintR);
      if (cuRef) {
        var cuDx = cuRef.cx - cxPupil_cu, cuDy = cuRef.cy - cyPupil_cu;
        if (Math.sqrt(cuDx*cuDx + cuDy*cuDy) < fit.rIrisFrac * imgEl.width * 0.40) {
          cxPupil_cu = cuRef.cx;
          cyPupil_cu = cuRef.cy;
        }
      }
    }

    // Close-up iris radius refinement cascade — same RIP → ODH → RC → SAT cascade
    // the full-face MediaPipe path uses. autoFit()'s horizontal band scan gives a good
    // center but can mis-size the radius on high-contrast or asymmetric close-up shots.
    // Anchoring the RIP/ODH cascade on autoFit's detected center reliably tightens it.
    var cuIrisR  = fit.rIrisFrac * imgEl.width;
    var cuIrisCx = fit.cxFrac    * imgEl.width;
    var cuIrisCy = fit.cyFrac    * imgEl.height;
    var cuRadSrc = 'AF';
    // Sanity check: iris must be at least 1.3× the pupil radius (even a maximally
    // dilated pupil is still <50% of iris diameter). autoFit can latch onto the
    // collarette/pupil boundary instead of the true limbus for very close-up images
    // where no sclera is visible — giving irisR ≈ pupilR. Correct the estimate here
    // so the RIP/ODH/RC/SAT cascade searches from the right starting point.
    var cuPupEstimate = fit.rPupilFrac * imgEl.width;
    if (closeup && cuPupEstimate > 4 && cuIrisR < cuPupEstimate * 1.3) {
      cuIrisR = Math.round(cuPupEstimate * 2.5);
    }
    // Allow cascade even when fit.ok=false: autoFit falls back to pr×2.1 when no
    // limbus was found, which is a reasonable seed for the refinement cascade.
    if (closeup && cuIrisR > 8) {
      // Close-up: autoFit's horizontal scan sometimes anchors on the
      // collarette/pupil boundary instead of the true iris-sclera limbus,
      // returning an irisR that is 40–60 % of the true value.  If we feed that
      // underestimate straight into findIrisODByRIP the function's search window
      // (0.75×hint … 1.40×hint) never reaches the real limbus.
      //
      // Use the pupil radius to compute a minimum floor: the human iris is always
      // at least 3.0× the pupil radius in extreme close-ups.  Also floor at
      // 28 % of the shorter image dimension (smallest possible close-up iris).
      // Take the maximum of autoFit's estimate and these two floors so we always
      // search over a range that can reach the true limbus.
      var cuMinHint = Math.max(
        Math.round(cuPupEstimate * 3.0),
        Math.round(Math.min(imgEl.width, imgEl.height) * 0.28)
      );
      var cuRipHint = Math.max(cuIrisR, cuMinHint);

      // Primary: Radial Intensity Profile (full-circle mean, confidence-scored)
      // Close-up threshold lowered to 0.08: extreme macro shots show a very
      // gradual iris-sclera luminance ramp (80-100 px wide) because the iris
      // fills nearly the full frame and only a thin sclera crescent is visible.
      // The RIP confidence formula (peak-gradient / total-lum-range) naturally
      // produces low values (0.08–0.13) for these gradual transitions even though
      // the radius estimate is correct.  Full-face threshold stays at 0.22 since
      // portraits have a sharper, well-lit limbus.
      var cuRipThresh = closeup ? 0.08 : 0.22;
      var cuRip = findIrisODByRIP(imgEl, cxPupil_cu, cyPupil_cu, cuRipHint);
      if (cuRip && cuRip.confidence >= cuRipThresh &&
          cuRip.irisR > cuRipHint * 0.40 && cuRip.irisR < cuRipHint * 2.00) {
        cuIrisR = cuRip.irisR;
        cuRadSrc = 'RIP' + Math.round(cuRip.confidence * 10);
        // RIP is anchored on the pupil center (cxPupil_cu/cyPupil_cu), so
        // the iris circle center is the pupil center. Update cuIrisCx/Cy so
        // analyzeIris samples the correct annular region around the true iris.
        cuIrisCx = cxPupil_cu;
        cuIrisCy = cyPupil_cu;
      } else {
        // Secondary: horizontal gradient scan (3/9 o'clock + near-horizontal rays)
        var cuPupR = findPupilRadiusByRays(imgEl, cxPupil_cu, cyPupil_cu, cuIrisR);
        var cuODH  = findIrisODHorizontal(imgEl, cxPupil_cu, cyPupil_cu, cuPupR);
        if (cuODH && cuODH.irisR > cuIrisR * 0.50 && cuODH.irisR < cuIrisR * 1.60) {
          // Adopt horizontal scan's x-center only if it didn't drift far from autoFit
          if (Math.abs(cuODH.cxIris - cuIrisCx) < cuIrisR * 0.40) cuIrisCx = cuODH.cxIris;
          cuIrisR = cuODH.irisR;
          cuRadSrc = 'ODH';
        } else {
          // Tertiary: ring-contrast global search
          var cuRC = findIrisByRingContrast(imgEl, cuIrisCx, cuIrisCy, cuIrisR);
          if (cuRC && cuRC.score > 15 && cuRC.r > cuIrisR * 0.50 && cuRC.r < cuIrisR * 1.60) {
            cuIrisR = cuRC.r;
            cuRadSrc = 'RC' + Math.round(cuRC.score);
          } else {
            // Tier 3.5: saturation ring — dark irises where all luminance methods fail
            var cuSAT = findIrisODBySaturation(imgEl, cuIrisCx, cuIrisCy, cuIrisR);
            if (cuSAT && cuSAT.confidence >= 0.25 &&
                cuSAT.irisR > cuIrisR * 0.50 && cuSAT.irisR < cuIrisR * 1.60) {
              cuIrisR = cuSAT.irisR;
              cuRadSrc = 'SAT' + Math.round(cuSAT.confidence * 100);
            }
            // else: keep autoFit's radius estimate
          }
        }
      }
    }
    // autoFit's horizontal band scan fires at the outer limbal/sclera boundary,
    // systematically overestimating the iris radius by ~4%.  Trim only when
    // all cascade methods failed (cuRadSrc still 'AF') so confident detections
    // (RIP/ODH/RC/SAT) are never touched.
    if (closeup && cuRadSrc === 'AF') cuIrisR = Math.round(cuIrisR * 0.93);
    // Collarette guard: applies after every cascade path.
    cuIrisR = Math.round(findLimbusBySaturation(imgEl, cxPupil_cu, cyPupil_cu, cuIrisR));

    donut.cx     = drawInfo.dx + cuIrisCx   * scaleX;
    donut.cy     = drawInfo.dy + cuIrisCy   * scaleY;
    donut.cxPupil = drawInfo.dx + cxPupil_cu * scaleX;
    donut.cyPupil = drawInfo.dy + cyPupil_cu * scaleY;
    var rpx  = fit.rPupilFrac * imgEl.width * scaleX;
    var ripx = cuIrisR * scaleX;
    ripx = Math.max(rpx*1.3, Math.min(ripx, Math.min(stageW,stageH)*0.48));
    rpx  = Math.max(6, Math.min(rpx, ripx*0.45));
    // Low-confidence close-up override: when the cascade returned a barely-
    // passing RIP (confidence ≤ 0.20, cuRadSrc 'RIP1'/'RIP2') or fell all the
    // way back to autoFit's estimate ('AF'), the radius is unreliable — the
    // limbus gradient is too gradual to measure precisely.  Substitute a
    // pupil-proportional estimate (pupil × 2.7 ≈ ratio 0.37, center of the
    // normal 0.30–0.45 range) which is far more stable for dark/blurry irises.
    // High-confidence paths (ODH, RC, SAT, RIP3+) are left untouched.
    // _overridedRipx=true also suppresses zoomToEye below: zoomToEye would use
    // the overridden donut.rIris as hint, produce an oversized crop, and run its
    // own cascade that overwrites the override — defeating the fix.
    var _overridedRipx = false;
    if (closeup && rpx > 8) {
      // RIP2 (confidence 0.15–0.24) is the expected range for portrait-resolution
      // photos where the limbus transition is soft — do not treat this as low
      // confidence.  Only suppress zoom for RIP1 (< 0.15) and AF (no detection).
      var _cuLowConf = cuRadSrc === 'AF' ||
                       (cuRadSrc.startsWith('RIP') && parseInt(cuRadSrc.slice(3)) <= 1);
      if (_cuLowConf) {
        ripx = Math.round(rpx * 2.7);
        ripx = Math.max(rpx * 1.3, Math.min(ripx, Math.min(stageW, stageH) * 0.48));
        _overridedRipx = true;
      }
    }
    donut.rIris  = ripx;
    donut.rPupil = rpx;
    draw();
    var _fitValid = validateIrisFit();
    if (_fitValid) {
      if (hint) { hint.textContent = 'Auto-fit complete. Drag to adjust, then tap "Analyze Iris".'; hint.style.color = ''; }
      if (st)   st.textContent = (closeup ? 'Close-up ' + cuRadSrc : 'Classical') + ': ' + (fit.ok ? 'snapped' : 'estimated');
    } else {
      // Placement check failed.
      // If this was a full-face pass on a jumpToEye crop (cropRegion is set),
      // silently retry with the close-up cascade — it sizes the iris ring from
      // local contrast rather than full-face priors, giving a tighter result for
      // eye-crop images where the full-face model over-extends rOut.
      if (!closeup && cropRegion != null) {
        _applyFitClassical(true, skipZoom);
        return;  // let the recursive call own zoomToEye and the hint
      }
      // Placement check failed — show advisory warning but don't block.
      // draw() already ran above with the autoFit circle set; no need to overwrite.
      if (hint) { hint.textContent = 'Uncertain fit — drag the ring to adjust if needed, then tap "Analyze Iris".'; hint.style.color = '#fa0'; }
      if (st)   st.textContent = (closeup ? 'Close-up ' + cuRadSrc : 'Classical') + ': unconfirmed';
      var rb = $('btn-quality-retake');
      if (rb) rb.style.display = '';
    }
    // zoomToEye always runs: it crops the canvas to the iris, then refines the
    // ring via a second cascade.  The ±25 % deviation guard (_zDevMax) already
    // protects against bad zoom results.  Previously this was gated on
    // validateIrisFit(), but on iOS the canvas P3 colour-space makes the sclera
    // brightness check unreliable — the gate caused zoom to be skipped entirely,
    // leaving the unrefined ring on a full-size image and producing a Brown result
    // on blue-grey eyes with a prominent amber collarette.
    // When iris detection was confident (fit.ok=true), skip the zoom sanity
    // check — _applyFitClassical already confirmed the ring is on the iris, so
    // the gradient/pupil check is redundant and rejects valid dark/glare eyes.
    // Previously gated on (closeup && fit.ok), which excluded the full-face
    // MediaPipe path (closeup=false) and caused zoom to abort for dark eyes.
    // Skip zoomToEye when the low-conf override fired: zoomToEye would re-run
    // its own cascade using the overridden donut.rIris as hint, which produces an
    // oversized crop and overwrites the pupil-proportional radius we just set.
    // Exception: when _fromBand is true, zoomToEye uses mpZoomHint.irisR directly
    // (not donut.rIris), so the override concern does not apply — always call
    // zoomToEye when the band scan gave us a reliable iris center+radius.
    // Always zoom so the user has a close-up view for manual ring adjustment.
    // Previously zoom was suppressed when _overridedRipx=true (low-conf detection)
    // to prevent the cascade re-running and overwriting the override — but this
    // left users unable to see the iris clearly to drag and correct it manually.
    // The cascade on the zoomed image is typically MORE reliable than on the full
    // image (iris fills more of the frame), so letting it run is usually beneficial.
    var _bandZoomOk = mpZoomHint && mpZoomHint._fromBand;
    if (!skipZoom) zoomToEye(fit.ok);
    return fit.ok;
  } catch(e) {
    if (st) st.textContent = 'Auto-fit error: ' + (e.message || e);
    return false;
  }
}

// Sclera-pair detector: find two bilateral sclera brightness peaks flanking
// the iris at a given y-position.
// imgEl  — image element to scan (should be the full/original image)
// midY   — y-coordinate of the horizontal strip to analyse (original px)
// Returns {cx, cy, r, score} or null if no valid pair found.
function _scleraPairScan(imgEl, midY) {
  try {
    var _bImgH = imgEl.height, _bImgW = imgEl.width;
    var _bHalf = Math.round(_bImgH * 0.05);
    var _bY0 = Math.max(0,      Math.round(midY - _bHalf));
    var _bY1 = Math.min(_bImgH, Math.round(midY + _bHalf));
    var _bH  = _bY1 - _bY0;
    if (_bH < 1) return null;
    var _bW2 = Math.min(_bImgW, 800);
    var _bSc = _bW2 / _bImgW;
    var _bH2 = Math.max(1, Math.round(_bH * _bSc));
    var _bOff = document.createElement('canvas');
    _bOff.width = _bW2; _bOff.height = _bH2;
    var _bCtx = _bOff.getContext('2d', { colorSpace: 'srgb' });
    _bCtx.drawImage(imgEl, 0, _bY0, _bImgW, _bH, 0, 0, _bW2, _bH2);
    var _bD = _bCtx.getImageData(0, 0, _bW2, _bH2).data;
    // Column mean luminance
    var _bLum = new Float32Array(_bW2);
    for (var _by = 0; _by < _bH2; _by++) {
      for (var _bx = 0; _bx < _bW2; _bx++) {
        var _bi = (_by * _bW2 + _bx) * 4;
        _bLum[_bx] += 0.299*_bD[_bi] + 0.587*_bD[_bi+1] + 0.114*_bD[_bi+2];
      }
    }
    for (var _bx = 0; _bx < _bW2; _bx++) _bLum[_bx] /= _bH2;
    // Gaussian smooth (sigma=8 px in 800-wide space)
    var _bSm = new Float32Array(_bW2);
    var _bSig = 8, _bKR = 24;
    for (var _bx = 0; _bx < _bW2; _bx++) {
      var _bws = 0, _bwt = 0;
      for (var _bk = -_bKR; _bk <= _bKR; _bk++) {
        var _bxi = _bx + _bk;
        if (_bxi < 0 || _bxi >= _bW2) continue;
        var _bwk = Math.exp(-_bk*_bk / (2*_bSig*_bSig));
        _bws += _bLum[_bxi] * _bwk; _bwt += _bwk;
      }
      _bSm[_bx] = _bws / _bwt;
    }
    // Prefix sum for O(1) range-mean queries
    var _bPfx = new Float64Array(_bW2 + 1);
    for (var _bx = 0; _bx < _bW2; _bx++) _bPfx[_bx+1] = _bPfx[_bx] + _bSm[_bx];
    function _bRM(a, b) {
      a = Math.max(0, a|0); b = Math.min(_bW2, b|0);
      return b > a ? (_bPfx[b] - _bPfx[a]) / (b - a) : 128;
    }
    // Per-pixel pupil check at original resolution
    var _bRowC = document.createElement('canvas');
    _bRowC.width = _bImgW; _bRowC.height = 1;
    _bRowC.getContext('2d', { colorSpace: 'srgb' })
          .drawImage(imgEl, 0, Math.max(0, Math.round(midY)), _bImgW, 1, 0, 0, _bImgW, 1);
    var _bRowD = _bRowC.getContext('2d', { colorSpace: 'srgb' })
                       .getImageData(0, 0, _bImgW, 1).data;
    var _bHP = function(x0, x1) {
      x0 = Math.max(0, x0|0); x1 = Math.min(_bImgW, x1|0);
      for (var _bxi = x0; _bxi < x1; _bxi++) {
        var _bi = _bxi * 4;
        if (0.299*_bRowD[_bi] + 0.587*_bRowD[_bi+1] + 0.114*_bRowD[_bi+2] < 40) return true;
      }
      return false;
    };
    // Find local maxima > 130 (sclera candidates)
    var _bPeaks = [];
    for (var _bx = 2; _bx < _bW2 - 2; _bx++) {
      var _bv = _bSm[_bx];
      if (_bv < 130) continue;
      if (_bv >= _bSm[_bx-1] && _bv >= _bSm[_bx+1] &&
          _bv >= _bSm[_bx-2] && _bv >= _bSm[_bx+2]) {
        _bPeaks.push({ x: _bx, lum: _bv });
      }
    }
    // Pair peaks: gap 8–36% of image width AND dark pupil in gap
    var _bMinHW = Math.round(_bW2 * 0.04);
    var _bMaxHW = Math.round(_bW2 * 0.18);
    var _bBScore = -1, _bBCx = -1, _bBHW = -1;
    for (var _bpi = 0; _bpi < _bPeaks.length; _bpi++) {
      for (var _bpj = _bpi + 1; _bpj < _bPeaks.length; _bpj++) {
        var _bLP = _bPeaks[_bpi], _bRP = _bPeaks[_bpj];
        var _bhw = (_bRP.x - _bLP.x) >> 1;
        if (_bhw < _bMinHW || _bhw > _bMaxHW) continue;
        var _bgX0 = Math.round(_bLP.x / _bSc), _bgX1 = Math.round(_bRP.x / _bSc);
        if (!_bHP(_bgX0, _bgX1)) continue;
        var _bgm = _bRM(_bLP.x, _bRP.x);
        var _bsc2 = (_bLP.lum + _bRP.lum) / 2 - _bgm;
        if (_bsc2 > _bBScore) { _bBScore = _bsc2; _bBHW = _bhw; _bBCx = (_bLP.x + _bRP.x) >> 1; }
      }
    }
    if (_bBCx >= 0 && _bBScore > 20) {
      var _bEstCx = Math.round(_bBCx / _bSc);
      var _bEstR  = Math.round(_bBHW / _bSc);
      if (_bEstR >= _bImgW * 0.05 && _bEstR <= _bImgW * 0.30) {
        return { cx: _bEstCx, cy: Math.round(midY), r: _bEstR, score: _bBScore };
      }
    }
    return null;
  } catch(e) { return null; }
}

// Close-up iris model: used when no face is detected.
// Runs autoFit with center-bias disabled directly on the original image,
// then proceeds to the fit stage without requiring a manual locate tap.
function _tryCloseupFit() {
  if (!originalImgEl) { showLocate(); return; }

  // ── autoFit probe — run first so we have a reliable irisR reference ──────
  // Serves two purposes:
  //   1. Gate: bail if no real iris found in the original image.
  //   2. Reference: _probeIrisR guards the sclera-pair result against false hits
  //      (e.g. inner-corner highlight) that return a tiny r, regardless of whether
  //      MACRO-GUARD's RIP also succeeded (_swRipR may be 0).
  var probe, _probeIrisR = 0;
  try {
    probe = autoFit(originalImgEl, true);
    if (!probe.ok || probe.rIrisFrac < 0.08) { showLocate(); return; }
    _probeIrisR = Math.round(probe.rIrisFrac * originalImgEl.width);
  } catch(e) { showLocate(); return; }

  // ── Sclera-pair scan to find the iris X-centre ───────────────────────────
  // When mpZoomHint has a known y-position (1-eye gate / MACRO-GUARD path),
  // scan there first, then fall back to ±10/20% offsets if needed.
  // When mpZoomHint is absent (MediaPipe found no face at all — Jeri-type),
  // sweep multiple y-positions across the image to locate the eye.
  // Uses _scleraPairScan() — the bilateral sclera brightness detector.
  //
  // _mpHintHadEyeW: true when the hint came from the 1-eye gate (canthus
  // midpoint, eyeW>0). Probe-based cx-mismatch and irisR floor must NOT fire
  // in that case — the probe irisR reflects the true iris size in the full
  // portrait (too large for the zoom pad) and the canthus midX is not a
  // reliable iris-centre reference for sclera-pair validation.
  var _mpHintHadEyeW = !!(mpZoomHint && mpZoomHint.eyeW > 0);
  if (!mpZoomHint || !mpZoomHint._fromBand) {
    var _swSweep, _swH = originalImgEl.height;
    if (mpZoomHint && mpZoomHint.midY > 0) {
      // Start at the hint y, then try ±10% and ±20% as fallback
      var _swY = mpZoomHint.midY;
      _swSweep = [_swY,
                  Math.round(_swY - _swH * 0.10), Math.round(_swY + _swH * 0.10),
                  Math.round(_swY - _swH * 0.20), Math.round(_swY + _swH * 0.20)];
    } else {
      // No face hint — sweep across the frame to find the eye autonomously
      _swSweep = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60].map(
        function(f) { return Math.round(_swH * f); });
    }
    var _swBest = null, _swBestScore = 20;
    for (var _swI = 0; _swI < _swSweep.length; _swI++) {
      var _swY2 = _swSweep[_swI];
      if (_swY2 < 1 || _swY2 >= _swH) continue;
      var _swPair = _scleraPairScan(originalImgEl, _swY2);
      if (_swPair && _swPair.score > _swBestScore) { _swBest = _swPair; _swBestScore = _swPair.score; }
    }
    var _swRipR = (mpZoomHint && mpZoomHint._ripR) ? mpZoomHint._ripR : 0;
    if (_swBest) {
      var _swIrisR = _swBest.r;
      // When MACRO-GUARD provided a RIP radius, validate the sclera-pair result.
      // The sweep can hit a horizontal level above/below the iris equator where the
      // bilateral brightness peaks are 1.5-2× wider than the true limbus.
      // RIP (anchored on the iris) is far more reliable for radius estimation.
      // If the sclera-pair radius exceeds ripR×1.3, treat the pair as a false positive:
      // discard sclera-pair entirely and fall back to the MACRO-GUARD centre + ripR.
      if (_swRipR > 0 && _swIrisR > _swRipR * 1.3) {
        console.log('[BAND] false pair: r=' + _swBest.r + ' > ripR×1.3 (' +
                    Math.round(_swRipR * 1.3) + ') — using MACRO-GUARD cx/ripR=' + _swRipR);
        mpZoomHint = { midX: mpZoomHint.midX, midY: mpZoomHint.midY, irisR: _swRipR, _fromBand: true };
      } else {
        // Validate the sclera-pair cx against the MACRO-GUARD centre (when available).
        // A large offset means the pair hit a false structure (inner-corner highlight, etc.).
        // Reference radius: RIP radius if available, else autoFit probe estimate.
        // Both are more reliable for scale than the sclera-pair's own r.
        var _refR = _swRipR > 0 ? _swRipR : _probeIrisR;
        // cx-mismatch only validated against MACRO-GUARD centres (eyeW=0).
        // 1-eye gate hints (eyeW>0) are canthus midpoints, not iris centres —
        // comparing sclera-pair cx to a canthus midpoint is unreliable.
        var _swCxDelta = (_refR > 0 && !_mpHintHadEyeW && mpZoomHint && mpZoomHint.midX > 0) ?
                         Math.abs(_swBest.cx - mpZoomHint.midX) : 0;
        if (_swCxDelta > 0 && _swCxDelta > _refR * 0.25) {
          // cx-mismatch: sclera-pair hit a false structure.
          // Its irisR is also unreliable (two close peaks → tiny r).
          // Use MACRO-GUARD's cx and the best available irisR reference.
          console.log('[BAND] cx-mismatch: pair cx=' + _swBest.cx +
                      ' vs MACRO-GUARD cx=' + Math.round(mpZoomHint.midX) +
                      ' (Δ=' + Math.round(_swCxDelta) + ' > 0.25×refR=' + Math.round(_refR * 0.25) +
                      ', src:' + (_swRipR > 0 ? 'ripR' : 'probe') + ')' +
                      ' — MACRO-GUARD cx+refR=' + _refR + ' (pair r=' + Math.round(_swIrisR) + ' discarded)');
          mpZoomHint = { midX: mpZoomHint.midX, midY: _swBest.cy, irisR: _refR, _fromBand: true };
        } else {
          console.log('[BAND] sclera-pair: cx=' + _swBest.cx + ' cy=' + _swBest.cy +
                      ' irisR=' + _swIrisR + ' score=' + Math.round(_swBest.score));
          mpZoomHint = { midX: _swBest.cx, midY: _swBest.cy, irisR: _swIrisR, _fromBand: true };
        }
      }
    } else if (_swRipR > 0) {
      // No sclera pair found anywhere in the sweep, but MACRO-GUARD RIP gave a
      // reliable radius. Use it directly with the MACRO-GUARD cascade centre.
      console.log('[BAND] no sclera pair — falling back to MACRO-GUARD cx/ripR=' + _swRipR);
      mpZoomHint = { midX: mpZoomHint.midX, midY: mpZoomHint.midY, irisR: _swRipR, _fromBand: true };
    } else {
      console.warn('[BAND] no sclera pair' +
        (mpZoomHint && mpZoomHint.midY ? (' at y=' + Math.round(mpZoomHint.midY) + ' or nearby') : ' (sweep)'));
    }
  }

  // ── irisR sanity floor ────────────────────────────────────────────────────
  // The sclera-pair can produce a tiny irisR even when cx-mismatch didn't fire
  // (pair cx close enough to MACRO-GUARD but r still from false peaks, or no
  // MACRO-GUARD hint at all).  Floor = 50% of the probe's irisR estimate.
  // pad = irisR×3.0 in zoomToEye, so a tiny irisR collapses the crop to almost
  // just the iris and breaks the downstream detection cascade.
  //
  // NOT applied for 1-eye gate paths (_mpHintHadEyeW): the probe's irisR equals
  // the TRUE iris radius in the full close-up portrait and is correct for
  // colour analysis, but is too large for the zoom pad — the sclera-pair's
  // smaller r gives a tighter, useful crop for those images.
  // Skip the floor when MACRO-GUARD already validated the sclera-pair on the
  // eye crop. In that path the probe runs on the full-face original image and
  // returns an irisR that reflects a large structure (face oval / eye socket)
  // rather than the actual iris — overriding a valid crop result with this
  // probe value blows the zoom pad out to nearly the full image width.
  if (!_mpHintHadEyeW && mpZoomHint && mpZoomHint._fromBand && !mpZoomHint._macroGuardCrop &&
      _probeIrisR > 0 && mpZoomHint.irisR < _probeIrisR * 0.50) {
    console.log('[BAND] irisR sanity floor: hint.irisR=' + mpZoomHint.irisR +
                ' < probeR×0.5=' + Math.round(_probeIrisR * 0.50) +
                ' — correcting to probeR=' + _probeIrisR);
    mpZoomHint = Object.assign({}, mpZoomHint, { irisR: _probeIrisR, _probeFloorFired: true });
  }

  isCloseupMode = true;
  currentSide   = 'Right';
  cropRegion    = null;
  imgEl         = originalImgEl;
  imgLoaded     = true;

  $('card-locate').style.display = 'none';
  $('card-fit').style.display    = 'block';
  $('card-result').style.display = 'none';
  $('fit-side-label').textContent = 'Close-up';
  _updateSwitchEyeBtn('Right');

  setTimeout(function() {
    layoutStage();
    _applyFitClassical(true);
    $('card-fit').scrollIntoView({behavior:'smooth', block:'start'});
  }, 50);
}

// ======================= FIT STAGE / ANALYZER =======================
var canvas = $('canvas-main'), ctx = canvas.getContext('2d');
var stageW = 600, stageH = 600;
var donut = { cx: 300, cy: 300, cxPupil: 300, cyPupil: 300, rIris: 180, rPupil: 60, threshHi: 230 };
var drawInfo = { dx: 0, dy: 0, dw: 600, dh: 600 };

function sizeCanvas(){
  var stage = $('stage');
  var rect = stage.getBoundingClientRect();
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  stageW = Math.round(rect.width);
  stageH = Math.round(rect.height);
  canvas.width  = stageW * dpr;
  canvas.height = stageH * dpr;
  canvas.style.width = stageW + 'px';
  canvas.style.height = stageH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function layoutStage(){
  if (!imgEl) return;
  sizeCanvas();
  var ar = imgEl.width / imgEl.height;
  var dw = stageW, dh = stageH;
  if (ar > 1) dh = stageW / ar; else dw = stageH * ar;
  drawInfo.dx = (stageW - dw) / 2;
  drawInfo.dy = (stageH - dh) / 2;
  drawInfo.dw = dw;
  drawInfo.dh = dh;
  donut.cx = stageW / 2;
  donut.cy = stageH / 2;
  donut.rIris  = Math.min(dw, dh) * 0.42;
  donut.rPupil = donut.rIris * 0.30;
  donut.analyzed = false;   // reset ghost-ring mode for new fit session
  draw();
}

// Sanity-check the current iris fit: sample the pupil zone (inner 35% of irisR).
// A real iris always has a dark pupil (lum < 70). Skin/hair/brow do not.
// Returns true if the candidate looks like a real iris, false if it looks wrong.
// Validates the current donut position by checking that the ring just outside
// the iris circle (sclera) is significantly brighter than the interior (iris body).
// This rejects dark backgrounds, skin, hair — any uniformly dark or flat region.
// A real iris always has bright sclera visible around it.
function validateIrisFit() {
  if (!imgEl || !donut.rIris) return false;
  var sx = drawInfo.dw / imgEl.width;
  var sy = drawInfo.dh / imgEl.height;
  var cx = (donut.cx - drawInfo.dx) / sx;
  var cy = (donut.cy - drawInfo.dy) / sy;
  var iR = donut.rIris / sx;
  var W  = imgEl.naturalWidth || imgEl.width;
  var H  = imgEl.naturalHeight || imgEl.height;

  var off = document.createElement('canvas');
  off.width = W; off.height = H;
  off.getContext('2d', { colorSpace: 'srgb' }).drawImage(imgEl, 0, 0, W, H);
  var d = off.getContext('2d', { colorSpace: 'srgb' }).getImageData(0, 0, W, H).data;
  function lp(x, y) {
    var px = Math.max(0, Math.min(W-1, Math.round(x)));
    var py = Math.max(0, Math.min(H-1, Math.round(y)));
    var i = (py * W + px) * 4;
    return 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
  }

  var N = 16, inS = 0, outS = 0, outN = 0;
  for (var a = 0; a < N; a++) {
    var ang = (a / N) * 2 * Math.PI;
    var cosA = Math.cos(ang), sinA = Math.sin(ang);
    inS += lp(cx + iR * 0.5 * cosA, cy + iR * 0.5 * sinA);
    var ox = cx + iR * 1.2 * cosA, oy = cy + iR * 1.2 * sinA;
    if (ox >= 0 && ox < W && oy >= 0 && oy < H) { outS += lp(ox, oy); outN++; }
  }
  if (outN < N / 2) return false;
  return (outS / outN) - (inS / N) > 15;  // sclera must be noticeably brighter
}

// After auto-fit: crop imgEl to just outside the eye corners so the stage is
// filled with the eye and adjustment is easy. Accumulates into cropRegion.
function zoomToEye(skipSanityCheck) {
  if (!imgEl || !donut.rIris) return;
  // Save pre-zoom imgEl so Auto-Fit Again can start fresh from the un-zoomed image
  preZoomState = { imgEl: imgEl, cropRegion: cropRegion ? Object.assign({}, cropRegion) : null };
  var sx = drawInfo.dw / imgEl.width;
  var sy = drawInfo.dh / imgEl.height;

  // Current donut positions in imgEl pixel space
  var iCx  = (donut.cx     - drawInfo.dx) / sx;
  var iCy  = (donut.cy     - drawInfo.dy) / sy;
  var iPCx = ((donut.cxPupil != null ? donut.cxPupil : donut.cx) - drawInfo.dx) / sx;
  var iPCy = ((donut.cyPupil != null ? donut.cyPupil : donut.cy) - drawInfo.dy) / sy;
  var iR   = donut.rIris  / sx;
  var iPR  = donut.rPupil / sx;

  // ── Corner-to-corner crop (full-face mode) ─────────────────────────────────
  // Root problem: centering on the MediaPipe iris centre fails for off-gaze
  // selfies.  The 3-D iris centre can be 30–50 px away from the 2-D visible
  // iris centre, pushing the nasal or temporal limbus outside the crop —
  // making ring placement and iris ID unreliable.
  //
  // Solution: centre the zoom on the EYE CORNER midpoint (canthus midpoint).
  // The canthi are eyelid landmarks; they never move with gaze direction.
  // jumpToEye already centred imgEl on this point, so in jump-crop coords:
  //   zCx = eyeMidX − cropRegion.x  (≈ imgEl.width/2 when no edge-clamping)
  //
  // Pad = 0.60 × eyeW each side → 20 % extra beyond each canthus.
  // This captures the entire visible eye corner-to-corner as specified.
  //
  // Close-up mode (single-eye macros) keeps the iris-centre + 2×iR approach
  // because canthus landmarks are unreliable on extreme close-ups.
  var _eye_c2c = !isCloseupMode && mpEyes && mpEyes[currentSide]
                   ? mpEyes[currentSide] : null;
  var zCx, zCy, pad;
  // Capture _fromBand BEFORE mpZoomHint is consumed below — used in post-cascade
  // floor logic to decide whether to treat iR as the authoritative limbus measurement.
  var _isFromBand = !!(mpZoomHint && mpZoomHint._fromBand);
  // _probeFloorFired: true when the irisR sanity floor in _tryCloseupFit corrected
  // a too-small sclera-pair result up to probeR.  The probe finds the inner edge of
  // the limbal ring, NOT the outer limbus, so iR slightly overestimates the limbus.
  // Applying the 1.00× band floor in this case overrides a correct cascade result
  // (which has independently found the true limbus) with an inflated iR.
  var _probeFloorFired = !!(mpZoomHint && mpZoomHint._probeFloorFired);
  if (_eye_c2c && _eye_c2c.eyeW > 20) {
    // Centre on the canthus midpoint (eyeMidX/eyeMidY), NOT the iris centre.
    // The iris centre moves with gaze; the canthi are fixed lid landmarks.
    // Pad = eyeW × 0.53 each side → eye opening fills ~95 % of frame width,
    // with both canthi just visible at the edges — matches target reference images.
    var _mpCx = _eye_c2c.eyeMidX;   // canthus midpoint — stable, gaze-independent
    var _mpCy = _eye_c2c.eyeMidY;
    zCx = _mpCx - (cropRegion ? cropRegion.x : 0);
    zCy = _mpCy - (cropRegion ? cropRegion.y : 0);
    pad = Math.round(_eye_c2c.eyeW * 0.53);  // target: eye opening fills ~95% of frame
    // Macro guard: if the cascade found an iris much larger than the C2C pad,
    // MediaPipe's canthus span is too small for this image (macro close-up).
    // Use iR×1.5 instead so the full iris fits in the zoom crop.
    if (iR > pad * 0.7) {
      console.log('[ZOOM-C2C] macro-guard: iR=' + Math.round(iR) +
                  ' > pad×0.7, using iR×1.5 pad=' + Math.round(iR * 1.5));
      pad = Math.round(iR * 1.5);
    }
    console.log('[ZOOM-C2C] canthus-centred  zCx=' + Math.round(zCx) +
                '  zCy=' + Math.round(zCy) + '  pad=' + pad + ' (eyeW×0.53)');
  } else if (mpZoomHint && mpZoomHint._fromBand) {
    // Band-detected iris centre: accurate midX/midY/irisR from horizontal strip autoFit.
    // Override iCx/iCy/iR so the post-zoom refinement cascade is anchored on the
    // true iris position (cascade run on the full portrait is unreliable for
    // isolated-eye images where the iris fills <10% of the frame).
    // Pad = irisR × 3.0 — derived from ground-truth zoom measurements (Rachel/Iliana).
    iCx  = mpZoomHint.midX - (cropRegion ? cropRegion.x : 0);
    iCy  = mpZoomHint.midY - (cropRegion ? cropRegion.y : 0);
    iR   = mpZoomHint.irisR;
    iPCx = iCx; iPCy = iCy;  // pupil seed = iris centre; findPupilCenter refines later
    zCx  = iCx;  zCy  = iCy;
    pad  = Math.round(mpZoomHint.irisR * 1.5);  // tighter: iris fills ~67% of crop (was 3.0 = 33%)
    console.log('[ZOOM-band] iris-centred zCx=' + Math.round(zCx) +
                ' zCy=' + Math.round(zCy) + ' pad=' + pad + ' (bandIrisR×1.5)');
    mpZoomHint = { _consumed: true };  // keep truthy → containment guard stays disabled
  } else if (mpZoomHint && mpZoomHint.eyeW > 20) {
    // Canthus geometry hint saved by 1-eye gate (Rachel-type single-eye close-ups).
    // The gate detected a hallucinated face and routed to close-up, but saved the
    // MP canthus coordinates so we can still frame on the real eye opening.
    zCx = mpZoomHint.midX - (cropRegion ? cropRegion.x : 0);
    zCy = mpZoomHint.midY - (cropRegion ? cropRegion.y : 0);
    pad = Math.round(mpZoomHint.eyeW * 0.53);
    console.log('[ZOOM-hint] canthus-centred zCx=' + Math.round(zCx) +
                ' zCy=' + Math.round(zCy) + ' pad=' + pad + ' (hintEyeW×0.53)');
    mpZoomHint = { _consumed: true };  // mark consumed but keep truthy so containment guard skips below
  } else {
    zCx = iCx;
    zCy = iCy;
    pad = Math.round(iR * 1.3);  // tighter: iris fills ~77% of crop (was 2.0 = 50%)
  }
  var x0  = Math.max(0, Math.round(zCx - pad));
  var y0  = Math.max(0, Math.round(zCy - pad));
  var x1  = Math.min(imgEl.width,  Math.round(zCx + pad));
  var y1  = Math.min(imgEl.height, Math.round(zCy + pad));
  // Iris containment guard: DISABLED in landmark (C2C) mode and mpZoomHint mode.
  // When eyeW landmarks are available, the pad already accounts for the full eye.
  // The cascade's iR estimate is unreliable (can be 3-5× wrong on full portrait images
  // it returns rIrisFrac≈0.42 — completely wrong) and was overriding the
  // landmark-based pad, causing the crop to balloon beyond the intended framing.
  // Guard only applies in pure cascade fallback mode (no landmark data at all).
  var _hasLandmarkZoom = (_eye_c2c && _eye_c2c.eyeW > 20) || (mpZoomHint && mpZoomHint._consumed);
  if (!_hasLandmarkZoom) {
    var _irisL = Math.round(iCx - iR * 1.15);
    var _irisR = Math.round(iCx + iR * 1.15);
    if (_irisL < x0) x0 = Math.max(0,             _irisL);
    if (_irisR > x1) x1 = Math.min(imgEl.width,   _irisR);
  }
  mpZoomHint = null;  // consumed — clear sentinel so it doesn't persist past this zoom call
  // Minimum crop guard: if the zoom crop is smaller than 100px the iris has
  // too few pixels for reliable colour sampling — skip zoom and keep the
  // current (larger) jumpToEye crop. Floor was 150px but that blocked valid
  // zooms for real iPhone photos where jumpToEye produced a ~430px crop with a
  // ~38px-radius iris (→ 116px zoom crop, well above 100px but under 150px).
  if (x1 - x0 < 100 || y1 - y0 < 100) { preZoomState = null; return; }

  var cw = x1 - x0, ch = y1 - y0;
  var off = document.createElement('canvas');
  off.width = cw; off.height = ch;
  off.getContext('2d', { colorSpace: 'srgb' }).drawImage(imgEl, x0, y0, cw, ch, 0, 0, cw, ch);

  var newImg = new Image();
  newImg.onload = function() {
    if (cropRegion) {
      cropRegion = { x: cropRegion.x + x0, y: cropRegion.y + y0, w: cw, h: ch };
    }
    imgEl = newImg;

    // ── Zoom-crop sanity: pupil-iris gradient check ──────────────────────────
    // A real iris has a dark pupil at centre with a lighter iris stroma around it.
    // If the crop landed on background (foliage, hair, skin) the radial luminance
    // gradient is absent.  Detect this and restore the pre-zoom image so the user
    // sees the full photo with the ring rather than a dark background close-up.
    var _zcCx = iCx - x0, _zcCy = iCy - y0;
    // maxLum=180 on the pupil zone excludes catch-lights (specular glare) from
    // the brightness average so a bright glare spot doesn't abort the zoom.
    var _zcPupilLum = estimateIrisBrightness(newImg, _zcCx, _zcCy, 0,        iR * 0.18, 180);
    var _zcIrisLum  = estimateIrisBrightness(newImg, _zcCx, _zcCy, iR * 0.40, iR * 0.70);
    // Fail if: (a) centre is too bright to be a pupil, OR (b) no radial gradient.
    // Threshold raised 100→140: green/hazel/light irises have a brighter central
    // zone than dark irises (pupilLum ≈ 120–135) — 100 was aborting valid zooms
    // for these eye colours.  Skin/hair/background still reads 160+ so the guard
    // still reliably blocks non-iris crops.
    // skipSanityCheck: set when _applyFitClassical already confirmed a good fit —
    // redundant to re-check and it rejects valid dark/catch-light close-ups.
    if (!skipSanityCheck && (_zcPupilLum > 140 || (_zcIrisLum - _zcPupilLum) < 8)) {
      // Crop landed on background — undo zoom and restore pre-zoom state.
      imgEl      = preZoomState.imgEl;
      cropRegion = preZoomState.cropRegion
                     ? Object.assign({}, preZoomState.cropRegion) : null;
      preZoomState = null;
      isCloseupMode = true;
      layoutStage();
      // Re-fit the ring on the restored image using the full classical cascade
      // (skipZoom=true prevents re-triggering zoomToEye and looping).
      // This gives a properly sized ring instead of the 42%-of-stage default,
      // which is too large for an already-cropped eye or macro close-up photo.
      _applyFitClassical(true, true);
      return;
    }
    // ────────────────────────────────────────────────────────────────────────

    // Positions in new imgEl space (subtract the crop origin)
    var niCx  = iCx  - x0, niCy  = iCy  - y0;
    var niPCx = iPCx - x0, niPCy = iPCy - y0;

    layoutStage();  // resets donut defaults, updates drawInfo for new imgEl

    var nsx = drawInfo.dw / imgEl.width;
    var nsy = drawInfo.dh / imgEl.height;
    // Set initial position from full-image detection (rough estimate)
    donut.cx      = drawInfo.dx + niCx  * nsx;
    donut.cy      = drawInfo.dy + niCy  * nsy;
    donut.cxPupil = drawInfo.dx + niPCx * nsx;
    donut.cyPupil = drawInfo.dy + niPCy * nsy;
    donut.rIris   = iR  * nsx;
    donut.rPupil  = iPR * nsx;

    // Refinement pass on the zoomed crop.
    // Step A: pupil blob anchors the center (most reliable — darkest region within iris).
    // Step B: horizontal limbus scan finds the iris OD at 3 and 9 o'clock (highest contrast,
    //         no eyelid occlusion). Ring contrast is kept as fallback only.
    //
    // Adaptive pupil-search seed: if the crop center (niCy) is in a dark region (lum < 40),
    // MediaPipe has placed the iris centre in the upper-lash / eyelid zone. Shift the seed
    // 35% of iR downward and tighten the search radius so the upper-lash zone falls outside
    // the search circle, forcing the centroid onto the true pupil. For well-centred eyes
    // (lum >= 40) a small 15% nudge keeps lash weight low without disturbing the result.
    // Sample 0.5·iR ABOVE niCy (upper eyelid zone) to detect lash territory.
    // Sampling at niCy itself always hits the dark pupil, so it can't distinguish
    // lash from iris. Above niCy: lashes → lum < 25; sclera/lid skin → lum > 50.
    // When that upper zone is nearly black, MediaPipe landed in the lash region and
    // we need a larger downward bias to find the true pupil.
    var niAboveLum  = estimateIrisBrightness(imgEl, niCx, niCy - iR * 0.5, 0, iR * 0.15);
    var zLashBias   = (niAboveLum < 25) ? (iR * 0.35) : (iR * 0.15);
    var zSearchR    = (niAboveLum < 25) ? (iR * 0.55) : (iR * 0.65);
    var zPupil = findPupilCenter(imgEl, niCx, niCy + zLashBias, zSearchR);
    // Lash-rejection retry: if FPC centroid landed more than 12% of iR above the
    // MediaPipe iris centre, lash pixels dominated the search. Retry with a deeper
    // seed (35% below MP centre) and a tighter radius (32%) so the upper-lash
    // cluster falls outside the circle and the true pupil dominates.
    if (zPupil && zPupil.cy < niCy - iR * 0.12) {
      var zRetry = findPupilCenter(imgEl, niCx, niCy + iR * 0.35, iR * 0.32);
      if (zRetry && zRetry.cy > zPupil.cy && Math.abs(zRetry.cx - niCx) < iR * 0.5) {
        zPupil = zRetry;
      }
    }
    if (zPupil && Math.hypot(zPupil.cx - niCx, zPupil.cy - niCy) < iR * 0.75) {
      // Iris center (donut.cx/cy) stays at the pre-fit iris position (niCx/niCy),
      // which was set by the initial donut assignment above and is the best estimate
      // of the iris geometric centre.  Only the pupil display (donut.cxPupil/cyPupil)
      // moves to the dark-region centroid from findPupilCenter.
      // These are independent: pupil centre ≠ iris centre in most real eyes.
      // Previously both were set to zPupil, which caused systematic rIris underestimation
      // when the pupil is off-axis (e.g. amber/hazel where a large dark periocular zone
      // pulls findPupilCenter below the true iris centre, misplacing the cascade origin
      // and making ODH/RIP see sclera close-in on one side → smaller radius).
      donut.cxPupil = drawInfo.dx + zPupil.cx * nsx;
      donut.cyPupil = drawInfo.dy + zPupil.cy * nsy;
      // donut.cx/cy already set to niCx/niCy·nsx from lines above — leave them there.

      // Cascade centre: niCx/niCy (iris centre) is more accurate than zPupil for the
      // OD cascade when the pupil is off-axis in the iris.  Exception: when the lash zone
      // was detected above (niAboveLum < 25), niCy itself is in the lash region and
      // zPupil is the better anchor — fall back to zPupil in that case.
      var _zCascCx = (niAboveLum < 25) ? zPupil.cx : niCx;
      var _zCascCy = (niAboveLum < 25) ? zPupil.cy : niCy;

      // Pupil radius pre-scan (needed as guard radius for secondary horizontal scan)
      var zPR0 = findPupilRadiusByRays(imgEl, zPupil.cx, zPupil.cy, iR);
      // Guard: if pupil scan hits the floor (≤5px), catch-light wiped it out.
      // Use 15% of iR so the secondary horizontal scan's maxSearchR reaches the limbus.
      if (zPR0 <= 5) zPR0 = iR * 0.15;

      // ── Iris OD cascade (three tiers) ──────────────────────────────────────────
      // All cascade calls use _zCascCx/_zCascCy (iris centre) not zPupil (pupil centre).
      // This gives a symmetric radial profile that correctly finds the limbus.
      // Primary:   RIP full-circle mean intensity profile (confidence-scored)
      // Secondary: horizontal gradient scan (3/9 o'clock + ±20/30° rays)
      // Tertiary:  ring-contrast global search; then keep MP estimate as-is
      // ───────────────────────────────────────────────────────────────────────────
      var _zRipConf = 0, _zFellBack = false;
      // Close-up macro shots have gradual iris-sclera ramps that produce
      // RIP confidence 0.08–0.13.  Use the same lowered threshold as
      // _applyFitClassical so the zoomed-image refinement pass also accepts
      // the correct radius rather than falling back to ODH/RC/SAT.
      var _zRipThresh = isCloseupMode ? 0.08 : 0.22;
      var zRIP = findIrisODByRIP(imgEl, _zCascCx, _zCascCy, iR);
      // In close-up mode the first cascade (in _applyFitClassical) already
      // found a reliable RIP radius; iR is that trusted estimate. Tighten
      // the zoom-cascade acceptance window to ±25 % of iR so that:
      //   • OOB artifacts from the cropped image (RIP finds r > 1.5×iR
      //     because most samples fall out-of-bounds) are rejected.
      //   • Near-horizontal ray contamination from eyelashes (ODH median
      //     pulled to ~0.73×iR) is also rejected.
      // Full-face: iR may be the IPD floor — a conservative lower-bound that can
      // underestimate the true iris radius by up to ~55% for close-up selfies.
      // Raise the acceptance window to 2.0×iR so the cascade can still accept the
      // correct result; the global 45%-of-stage cap remains the hard ceiling.
      // When a cascade tier is rejected the initialised donut.rIris = iR*nsx
      // (the correct pre-zoom estimate) is preserved unchanged.
      var _zDevMax = isCloseupMode ? 0.25 : 1.50;  // full-face: allow up to 2.5×iR deviation
      var _zUpperBound = isCloseupMode ? 1.4 : 2.0;  // full-face: accept up to 2.0×iR
      console.log('[CASCADE] iR=' + Math.round(iR) + ' closeup=' + isCloseupMode +
                  ' devMax=' + _zDevMax + ' upperBound=' + _zUpperBound +
                  ' ripThresh=' + _zRipThresh +
                  (zRIP ? ' RIP→r=' + Math.round(zRIP.irisR) + ' conf=' + zRIP.confidence.toFixed(3) : ' RIP=null'));
      if (zRIP && zRIP.confidence >= _zRipThresh &&
          zRIP.irisR > iR * 0.4 && zRIP.irisR < iR * _zUpperBound &&
          Math.abs(zRIP.irisR - iR) <= iR * _zDevMax) {
        // Primary succeeded — cap at 2.0× MP (close-up: 1.25×); global 45% binds first
        donut.rIris = Math.min(zRIP.irisR * nsx, iR * nsx * _zUpperBound, Math.min(stageW, stageH) * 0.45);
        _zRipConf = zRIP.confidence;
        console.log('[CASCADE] TIER-1 RIP accepted r=' + Math.round(zRIP.irisR) + ' → donut.rIris=' + Math.round(donut.rIris));
      } else {
        _zFellBack = true;
        if (zRIP) console.log('[CASCADE] RIP REJECTED: r=' + Math.round(zRIP.irisR) + ' conf=' + zRIP.confidence.toFixed(3) +
                              ' (needs conf≥' + _zRipThresh + ' r∈[' + Math.round(iR*0.4) + ',' + Math.round(iR*_zUpperBound) + '] dev≤' + Math.round(iR*_zDevMax) + ')');
        // Secondary: horizontal gradient scan; pass iR as hint so the scan
        // is capped at iR×2.0 (raised from 1.5× to handle IPD-floor underestimates).
        var zODH = findIrisODHorizontal(imgEl, _zCascCx, _zCascCy, zPR0, iR);
        console.log('[CASCADE] ODH→' + (zODH ? 'r=' + Math.round(zODH.irisR) + ' cx=' + Math.round(zODH.cxIris) : 'null'));
        if (zODH && zODH.irisR > iR * 0.4 && zODH.irisR < iR * _zUpperBound &&
            Math.abs(zODH.irisR - iR) <= iR * _zDevMax) {
          donut.rIris = Math.min(zODH.irisR * nsx, iR * nsx * _zUpperBound, Math.min(stageW, stageH) * 0.45);
          console.log('[CASCADE] TIER-2 ODH accepted r=' + Math.round(zODH.irisR) + ' → donut.rIris=' + Math.round(donut.rIris));
          // Adopt horizontal scan's x-center refinement for the iris ring
          if (Math.abs(zODH.cxIris - _zCascCx) < iR * 0.4) {
            donut.cx = drawInfo.dx + zODH.cxIris * nsx;
            // donut.cxPupil stays at zPupil position (independent of iris centre)
          }
        } else {
          if (zODH) console.log('[CASCADE] ODH REJECTED: r=' + Math.round(zODH.irisR) +
                                ' (needs r∈[' + Math.round(iR*0.4) + ',' + Math.round(iR*_zUpperBound) + '] dev≤' + Math.round(iR*_zDevMax) + ')');
          // Tertiary: ring contrast
          var zRC = findIrisByRingContrast(imgEl, _zCascCx, _zCascCy, iR);
          console.log('[CASCADE] RC→' + (zRC ? 'r=' + Math.round(zRC.r) + ' score=' + Math.round(zRC.score) : 'null'));
          if (zRC && zRC.score > 15 && zRC.r <= iR * _zUpperBound) {
            donut.rIris = Math.min(zRC.r * nsx, Math.min(stageW, stageH) * 0.45);
            console.log('[CASCADE] TIER-3 RC accepted r=' + Math.round(zRC.r) + ' → donut.rIris=' + Math.round(donut.rIris));
          } else {
            if (zRC) console.log('[CASCADE] RC REJECTED score=' + Math.round(zRC.score));
            // Tier 3.5: saturation ring — dark irises where all luminance methods fail
            var zSAT = findIrisODBySaturation(imgEl, _zCascCx, _zCascCy, iR);
            console.log('[CASCADE] SAT→' + (zSAT ? 'r=' + Math.round(zSAT.irisR) + ' conf=' + zSAT.confidence.toFixed(3) : 'null'));
            if (zSAT && zSAT.confidence >= 0.25 && zSAT.irisR > iR * 0.4 && zSAT.irisR < iR * _zUpperBound) {
              donut.rIris = Math.min(zSAT.irisR * nsx, iR * nsx * _zUpperBound, Math.min(stageW, stageH) * 0.45);
              console.log('[CASCADE] TIER-3.5 SAT accepted r=' + Math.round(zSAT.irisR) + ' → donut.rIris=' + Math.round(donut.rIris));
            } else {
              console.log('[CASCADE] ALL TIERS FAILED → keeping iR estimate donut.rIris=' + Math.round(donut.rIris));
            }
            // else: keep the MP estimate that was set before the refinement pass
          }
        }
      }
      // ── x-Centre refinement ────────────────────────────────────────────────
      // When RIP (primary cascade) found the radius, ODH never ran and the
      // iris x-centre was never corrected from the MediaPipe landmark estimate.
      // MediaPipe's iris centre can drift 15–30 % of iR away from the true
      // geometric limbus centre (especially in selfies where gaze is off-axis).
      // Run ODH purely for centre refinement: the horizontal limbus scan gives
      // the most reliable x-centroid (midpoint of 3-o'clock and 9-o'clock
      // limbus intercepts) independent of which cascade tier found the radius.
      // Also catches residual drift when ODH was secondary but its correction
      // was blocked by the 0.4×iR gate (threshold raised to 0.7×iR here).
      var _zOdhCtr = findIrisODHorizontal(imgEl, _zCascCx, _zCascCy, zPR0, donut.rIris / nsx);
      if (_zOdhCtr && _zOdhCtr.irisR > iR * 0.3 &&
          Math.abs(_zOdhCtr.cxIris - _zCascCx) < iR * 0.7) {
        console.log('[CX REFINE] x-centre shift ' +
                    Math.round(_zOdhCtr.cxIris - _zCascCx) + 'px  cascade-cx=' +
                    Math.round(_zCascCx) + ' → ' + Math.round(_zOdhCtr.cxIris));
        donut.cx = drawInfo.dx + _zOdhCtr.cxIris * nsx;
      }
      // ── Pupil-center guard ────────────────────────────────────────────────
      // Iris centre (donut.cx/cy) is set by the cascade + CX REFINE (ODH-based).
      // Pupil centre (zPupil.cx/cy) is the dark-region centroid — highly reliable.
      // If they are far apart the cascade anchored on the wrong point (e.g. CX REFINE
      // found an off-axis ODH mid-point that doesn't match the actual iris centre).
      // Threshold: >35% of iR offset = cascade centre is wrong → override with pupil.
      // >60% of iR = hard fail, log for quality advisory.
      var _xRecenterFired = false;
      var _pgIrisCxNow = (donut.cx - drawInfo.dx) / nsx;
      var _pgIrisCyNow = (donut.cy - drawInfo.dy) / nsy;
      // X-only correction: cascade + CX-REFINE drifts horizontally on off-axis gaze.
      // Y is set by MediaPipe which is reliable vertically; pupil Y sits below iris
      // geometric centre due to upper-lid coverage — don't treat that gap as an error.
      var _pgXOff = Math.abs(_pgIrisCxNow - zPupil.cx);
      var _pgYOff = Math.abs(_pgIrisCyNow - zPupil.cy);
      var _pgXPct = _pgXOff / iR;
      var _pgYPct = _pgYOff / iR;
      console.log('[PUPIL-GUARD] xOff=' + Math.round(_pgXOff) + 'px (' +
                  Math.round(_pgXPct * 100) + '% iR)  yOff=' + Math.round(_pgYOff) + 'px (' +
                  Math.round(_pgYPct * 100) + '% iR)  iris=(' +
                  Math.round(_pgIrisCxNow) + ',' + Math.round(_pgIrisCyNow) + ')' +
                  '  pupil=(' + Math.round(zPupil.cx) + ',' + Math.round(zPupil.cy) + ')' +
                  (_pgXPct > 0.35 ? '  → X-RECENTER' : '  → OK'));
      if (_pgXPct > 0.35 && !_isFromBand) {
        // Override iris X with pupil X.
        // Skipped in band mode: the BAND sclera-pair algorithm finds the bilateral
        // iris centre directly — large iris-pupil gaps in macro close-ups are a
        // physical corneal projection effect, not a cascade centre error.
        donut.cx = drawInfo.dx + zPupil.cx * nsx;
        _xRecenterFired = true;
      } else if (_pgXPct > 0.05 && zPupil.cx > _pgIrisCxNow) {
        // X-PARTIAL: small horizontal offset (5–35%) where cascade drifts left.
        // Systematic bias — CX-REFINE tends to anchor slightly nasal of true
        // iris centre.  Correct 80% of gap, capped at 20px to avoid over-shooting
        // on large-ring subjects where the X offset is relatively small.
        var _pgXShift = Math.min(_pgXOff * 0.80, 20);
        var _pgXNew = _pgIrisCxNow + _pgXShift;
        donut.cx = drawInfo.dx + _pgXNew * nsx;
        console.log('[PUPIL-GUARD] X-PARTIAL: iris-x=' + Math.round(_pgIrisCxNow) +
                    ' +' + Math.round(_pgXShift) + 'px → ' + Math.round(_pgXNew));
      }
      // Y-correction — only fires when pupil is BELOW the iris centre (never upward:
      // pupil above iris centre = findPupilCenter caught lashes, not the real pupil).
      // Two tiers:
      //   > 40% iR : hard recenter — full override with pupil y (large MediaPipe error).
      //   12–40% iR: partial shift — 80% toward pupil.  Catches close-up shots where
      //              MediaPipe places the iris centre slightly too high (e.g. iris near
      //              the top edge of the crop).  Normal upper-lid coverage is 5–10%,
      //              so 10% is a safe lower bound that avoids over-correcting healthy eyes.
      if (_pgYPct > 0.40 && zPupil.cy > _pgIrisCyNow) {
        donut.cy = drawInfo.dy + zPupil.cy * nsy;
        console.log('[PUPIL-GUARD] Y-RECENTER: iris-y=' + Math.round(_pgIrisCyNow) +
                    ' → pupil-y=' + Math.round(zPupil.cy) + ' (gap=' + Math.round(_pgYOff) + 'px)');
      } else if (_pgYPct > 0.10 && zPupil.cy > _pgIrisCyNow) {
        var _pgYNew = _pgIrisCyNow + _pgYOff * 0.80;
        donut.cy = drawInfo.dy + _pgYNew * nsy;
        console.log('[PUPIL-GUARD] Y-PARTIAL: iris-y=' + Math.round(_pgIrisCyNow) +
                    ' +' + Math.round(_pgYOff * 0.80) + 'px (80% of ' + Math.round(_pgYOff) + ') → ' + Math.round(_pgYNew));
      }
      if (_pgXPct > 0.60 || _pgYPct > 0.80) {
        console.log('[PUPIL-GUARD] HARD-FAIL x=' + Math.round(_pgXPct*100) + '% y=' + Math.round(_pgYPct*100) + '% iR — ring confidence low');
      }
      // ──────────────────────────────────────────────────────────────────────
      // Collarette guard — runs from iris centre (donut.cx/cy), not pupil centre.
      var _zIrisCx = (donut.cx - drawInfo.dx) / nsx;
      var _zIrisCy = (donut.cy - drawInfo.dy) / nsy;
      var _preCGR  = donut.rIris / nsx;
      var _zTrueR = findLimbusBySaturation(imgEl, _zIrisCx, _zIrisCy, _preCGR);
      // Threshold lowered from 1.05 to 1.01: SAT-LIMBUS expansions of ≥ 1% are meaningful
      // (e.g. Jeri: 473→482 = 1.9% was previously dropped but IS the correct limbus).
      console.log('[COLLARETTE-GUARD] pre=' + Math.round(_preCGR) + ' result=' + Math.round(_zTrueR) + ((_zTrueR > _preCGR * 1.01) ? ' → EXPANDED' : ' → no change'));
      if (_zTrueR > _preCGR * 1.01) {
        donut.rIris = Math.min(_zTrueR * nsx, Math.min(stageW, stageH) * 0.45);
      }
      var zPR = findPupilRadiusByRays(imgEl, zPupil.cx, zPupil.cy, donut.rIris / nsx);
      // Guard: if the pupil-ray scan returns its floor (≤5px), catch-light has wiped it out.
      // Estimate pupil as 22% of iris radius (typical human ratio) rather than showing a dot.
      if (zPR <= 5) zPR = (donut.rIris / nsx) * 0.18;
      // Cap pupil at 26% of iris radius — constricted selfie pupils rarely exceed this,
      // and dark irises inflate the scan result without this tighter ceiling.
      donut.rPupil = Math.max(6, Math.min(zPR * nsx, donut.rIris * 0.26));
    }
    // Close-up OD trim: RIP and ODH anchor at the outer limbal/sclera boundary,
    // overestimating the true iris edge by 5–8%. The 0.93 trim in _applyFitClassical
    // only fires for the pure autoFit fallback; after zoomToEye reruns RIP/ODH that
    // trim is gone. Apply a 6% trim here for all close-up photos so the final circle
    // sits on the iris, not on the sclera.
    // Conditional trim: only apply the 6% correction when the cascade OVERSHOT iR.
    // When cascade already undershoots (result < iR), trimming worsens placement.
    // iR is the band-scan or C2C reference radius — the most reliable limbus estimate.
    var _preTrimR = donut.rIris;
    var _cascImgR = donut.rIris / nsx;
    if (isCloseupMode && _cascImgR > iR) donut.rIris = Math.round(donut.rIris * 0.94);
    console.log('[TRIM] closeup=' + isCloseupMode + ' cascImgR=' + Math.round(_cascImgR) + ' iR=' + Math.round(iR) + ((_cascImgR > iR) ? ' (overshoot→trimmed)' : ' (undershoot→skip)') + ' result=' + Math.round(donut.rIris) + ' (img→' + Math.round(donut.rIris/nsx) + ')');
    // Floor: for band-path subjects (iR = sclera-pair measurement = true limbus),
    // use iR directly (100%) as the floor — the band scan IS the authoritative radius.
    // Exception: _probeFloorFired — iR was corrected from a bad sclera-pair to probeR,
    // but the probe finds the inner limbal ring edge, slightly overestimating the true
    // limbus.  The cascade result (RIP+SAT-LIMBUS ~466 px) is more reliable.
    // Use 0.75× floor so the cascade result is preserved without triggering the floor.
    // For all other paths, keep the conservative 90% backstop.
    // The sclera back-off below will still trim if iR overshoots into sclera.
    var _floorFrac = _isFromBand ? (_probeFloorFired ? 0.75 : 1.00) : 0.90;
    // _mainFloorFiredToIR: true when the cascade undershoots iR and the floor
    // raises it to exactly iR (normal band-path only).  Used below to skip BACKOFF-SCLERA:
    // the ring is already at the band-measured limbus; trimming further cuts into the iris.
    // Not set for probe-floor paths — the cascade result is the authoritative radius,
    // and BACKOFF-SCLERA may legitimately refine it.
    var _mainFloorFiredToIR = false;
    if (isCloseupMode && donut.rIris < iR * nsx * _floorFrac) {
      donut.rIris = Math.round(iR * nsx * _floorFrac);
      _mainFloorFiredToIR = _isFromBand && !_probeFloorFired;
      console.log('[FLOOR] applied iR×' + _floorFrac.toFixed(2) + ' floor (band=' + _isFromBand + ' probeFloor=' + _probeFloorFired + ') → donut.rIris=' + Math.round(donut.rIris) + ' (img=' + Math.round(donut.rIris/nsx) + ')');
    }
    // ── Close-up limbal ring back-off ────────────────────────────────────────
    // The 0.94 trim above corrects the typical 5–8 % limbal-sclera anchor error.
    // On macro close-ups with a wide, prominent limbal ring the trim still leaves
    // rOut in the dark limbal band (mean ring lum < 90).  Scan inward in 3 % steps
    // (max 22 % additional trim) until ring lum rises ≥ 10 points from the dark
    // minimum — i.e. back into iris-stroma territory.
    // Guard: skip if mid-iris (0.55×r) is not noticeably brighter than the edge
    // (< lbEdge + 20).  This prevents over-trimming dark-coloured irises where
    // the entire stroma is uniformly dim.
    if (isCloseupMode) {
      var _lbR   = donut.rIris / nsx;
      var _lbCx  = (donut.cx    - drawInfo.dx) / nsx;
      var _lbCy  = (donut.cy    - drawInfo.dy) / nsy;
      var _lbOff = document.createElement('canvas');
      _lbOff.width = imgEl.width; _lbOff.height = imgEl.height;
      var _lbCtx = _lbOff.getContext('2d', {colorSpace:'srgb'});
      _lbCtx.drawImage(imgEl, 0, 0);
      var _lbPx  = _lbCtx.getImageData(0, 0, imgEl.width, imgEl.height).data;
      var _lbW   = imgEl.width, _lbH = imgEl.height;
      var _lbRingLum = function(r) {
        var _s=0, _n=0;
        for (var _ai=0; _ai<64; _ai++) {
          var _ang = _ai/64*2*Math.PI;
          var _bx  = Math.round(_lbCx + Math.cos(_ang)*r);
          var _by  = Math.round(_lbCy + Math.sin(_ang)*r);
          if (_bx<0||_by<0||_bx>=_lbW||_by>=_lbH) continue;
          var _bi  = (_by*_lbW+_bx)*4;
          _s += 0.299*_lbPx[_bi]+0.587*_lbPx[_bi+1]+0.114*_lbPx[_bi+2]; _n++;
        }
        return _n ? _s/_n : 100;
      };
      var _lbEdge = _lbRingLum(_lbR);
      var _lbMid  = _lbRingLum(_lbR * 0.55);
      console.log('[BACKOFF] edgeLum=' + Math.round(_lbEdge) + ' midLum=' + Math.round(_lbMid) + ' rImg=' + Math.round(_lbR));
      if (_lbEdge < 90 && _lbMid > _lbEdge + 20) {
        // Dark limbal ring back-off: ring is in the dark limbal band — scan inward until
        // luminance rises ≥ 10 pts above the dark minimum (back into iris-stroma territory).
        var _lbMin = _lbR * 0.78;
        var _lbRstart = _lbR;
        while (_lbR > _lbMin) {
          _lbR *= 0.97;
          if (_lbRingLum(_lbR) >= _lbEdge + 10) break;
        }
        donut.rIris = Math.round(_lbR * nsx);
        console.log('[BACKOFF-DARK] trimmed ' + Math.round(_lbRstart) + '→' + Math.round(_lbR) + ' → donut.rIris=' + Math.round(donut.rIris));
      } else if (_lbEdge > 135) {
        // Sclera back-off: ring is in bright sclera territory (edgeLum > 135) — scan inward
        // until luminance drops to ≤ edgeLum−20 (the iris-sclera limbus transition).
        // SKIP if _mainFloorFiredToIR: the ring was just set to iR by the band-path floor,
        // meaning it is already at the true limbus.  The sclera back-off would falsely trim
        // into the iris because the limbal region's high luminance (bright limbal ring, e.g.
        // gray/blue irises) triggers the >135 threshold even AT the true limbus boundary.
        // Trusting the sclera-pair measurement is more reliable than the luminance scan here.
        if (_mainFloorFiredToIR) {
          console.log('[BACKOFF-SCLERA] SKIPPED — band floor just set r=iR; sclera-pair measurement is authoritative');
        } else {
          // Handles close-up subjects where RIP overshoots into the sclera and the
          // 0.94× trim alone doesn't bring the ring back to the iris edge.
          // Max trim 22% (same guard as dark back-off) to prevent over-trimming bright irises.
          var _sbMin = _lbR * 0.78;
          var _sbStart = _lbR;
          // Target: edgeLum−20, but capped at 130 — ensures very bright sclera
          // (edgeLum > 150) scans into true iris territory (lum ≤ 130) rather
          // than stopping at a luminance that is still clearly sclera.
          var _sbTarget = Math.min(_lbEdge - 20, 130);
          while (_lbR > _sbMin) {
            _lbR *= 0.97;
            if (_lbRingLum(_lbR) <= _sbTarget) break;
          }
          donut.rIris = Math.round(_lbR * nsx);
          console.log('[BACKOFF-SCLERA] edgeLum=' + Math.round(_lbEdge) + ' target≤' + Math.round(_sbTarget) + ' trimmed ' + Math.round(_sbStart) + '→' + Math.round(_lbR) + ' → donut.rIris=' + Math.round(donut.rIris));
          // Re-apply conservative floor — 90% backstop for all subjects.
          if (donut.rIris < iR * nsx * 0.90) {
            donut.rIris = Math.round(iR * nsx * 0.90);
            console.log('[FLOOR] sclera-backoff floor ×0.90 → donut.rIris=' + Math.round(donut.rIris));
          }
        }
      }
    }
    // ── ITER-REFINE: Scleral-fraction inward scan → limbus landing ───────────────
    // Direct approach: shrink r until sclera disappears from inside the ring,
    // then step outward to find the exact limbus position.
    //
    // Phase 1 SHRINK: while scleral_frac(r) > 10%, step r inward 2px.
    //   Stops when the ring no longer clips sclera.
    //   Bounded: floor = iR × 0.72 (never trim more than 28% below band measurement).
    //
    // Phase 2 FIND-LIMBUS: only fires after Phase 1 moved the ring inward.
    //   Steps r outward 2px until scleral_frac first exceeds 10%, then steps
    //   back 2px — places ring just inside the sclera boundary.
    //   Ceiling = iR × 1.55 (band) or × 1.25 (other) to reach Brad-type under-measured cases.
    //
    // Phase 3 CENTER: moves cx/cy ±2px to minimise scleral_frac at the found r.
    //   Bounded: ±25px from cascade result (fine-tune only).
    //
    // Applied whenever r changes > 2px OR centre moves > 2px.
    if (isCloseupMode && zPupil) {
      var _irOff = document.createElement('canvas');
      _irOff.width = imgEl.width; _irOff.height = imgEl.height;
      var _irCtx2 = _irOff.getContext('2d', {colorSpace:'srgb'});
      _irCtx2.drawImage(imgEl, 0, 0);
      var _irPx  = _irCtx2.getImageData(0, 0, imgEl.width, imgEl.height).data;
      var _irIW  = imgEl.width, _irIH = imgEl.height;
      // Scleral fraction: fraction of 48-point ring sample classified as scleral
      // (sat < 25 AND lum > 140).
      // lumThresh: 160 for Phase 2/Phase 3 (tight — avoids bright iris periphery);
      //            130 for Phase 1b shrink-retry (catches dimmer sclera adjacent to limbus).
      var _irSclFrac = function(cx, cy, r, lumThresh) {
        if (lumThresh === undefined) lumThresh = 160;
        var _sclN = 0, _sclT = 0;
        for (var _si = 0; _si < 48; _si++) {
          var _sa  = _si / 48 * 2 * Math.PI;
          var _spx = Math.round(cx + Math.cos(_sa) * r);
          var _spy = Math.round(cy + Math.sin(_sa) * r);
          if (_spx < 0 || _spy < 0 || _spx >= _irIW || _spy >= _irIH) continue;
          var _sbi = (_spy * _irIW + _spx) * 4;
          var _sR  = _irPx[_sbi], _sG = _irPx[_sbi+1], _sB = _irPx[_sbi+2];
          var _slum = 0.299*_sR + 0.587*_sG + 0.114*_sB;
          var _smx  = Math.max(_sR, _sG, _sB);
          var _ssat = _smx > 10 ? (_smx - Math.min(_sR, _sG, _sB)) / _smx * 255 : 0;
          if (_ssat < 25 && _slum > lumThresh) _sclN++;
          _sclT++;
        }
        return _sclT > 0 ? _sclN / _sclT : 0;
      };
      var _irCxI  = (donut.cx - drawInfo.dx) / nsx;
      var _irCyI  = (donut.cy - drawInfo.dy) / nsy;
      var _irRI   = donut.rIris / nsx;
      var _irFlr  = iR * 0.72;
      var _irCeil = _isFromBand ? iR * 1.55 : iR * 1.25;
      // When X-RECENTER fired the band-path iR is unreliable (it was measured from a
      // mis-centred position).  Override the ceiling so FIND-LIMBUS can expand freely
      // up to half the image short-edge — enough to reach the true limbus.
      if (_xRecenterFired) _irCeil = Math.min(_irIW, _irIH) * 0.50;
      // ── Option C: Adaptive scleral luminance threshold ──────────────────────────
      // Sample horizontal scleral zones (nasal + temporal at 1.4x iris radius,
      // +-15% height band) to measure this subject's actual scleral luminance.
      // Only low-saturation pixels (sat < 20) count -- filters iris / eyelid hits.
      // Upper-quartile of valid samples (less sensitive to dim nasal caruncle).
      // Falls back to legacy Hi=160 / Lo=130 if < 4 valid scleral samples found.
      var _sclAdaptSamples = [];
      var _sclSmpR = _irRI * 1.4;
      var _sclBand = _irRI * 0.15;
      for (var _sclI = 0; _sclI < 9; _sclI++) {
        var _sclYOff = (_sclI / 8 - 0.5) * _sclBand;
        var _sclYPos = Math.round(_irCyI + _sclYOff);
        var _sclSides = [Math.round(_irCxI - _sclSmpR), Math.round(_irCxI + _sclSmpR)];
        for (var _sclS = 0; _sclS < 2; _sclS++) {
          var _sclX = _sclSides[_sclS];
          if (_sclX < 0 || _sclYPos < 0 || _sclX >= _irIW || _sclYPos >= _irIH) continue;
          var _sclI2 = (_sclYPos * _irIW + _sclX) * 4;
          var _sclR2 = _irPx[_sclI2], _sclG2 = _irPx[_sclI2+1], _sclB2 = _irPx[_sclI2+2];
          var _sclMx = Math.max(_sclR2, _sclG2, _sclB2);
          var _sclSat = _sclMx > 10 ? (_sclMx - Math.min(_sclR2, _sclG2, _sclB2)) / _sclMx * 255 : 0;
          if (_sclSat < 20) _sclAdaptSamples.push(0.299*_sclR2 + 0.587*_sclG2 + 0.114*_sclB2);
        }
      }
      _sclAdaptSamples.sort(function(a,b){return a-b;});
      var _sclLumRef = _sclAdaptSamples.length >= 4
        ? _sclAdaptSamples[Math.floor(_sclAdaptSamples.length * 0.75)]
        : 160;
      // Hi (Phase 1/2/3): 88% of measured scleral lum -- just inside the boundary.
      // Lo (Phase 1b): 72% -- catches dim sclera adjacent to limbus.
      var _sclAdaptHi = Math.max(90, Math.round(_sclLumRef * 0.88));
      var _sclAdaptLo = Math.max(100, Math.round(_sclLumRef * 0.78));
      console.log('[ADAPT-SCL] n=' + _sclAdaptSamples.length + ' ref(p75)=' + Math.round(_sclLumRef) +
                  ' → Hi=' + _sclAdaptHi + ' Lo=' + _sclAdaptLo + ' (was 160/130)');

      var _irCxLo = _irCxI - 25, _irCxHi = _irCxI + 25;
      var _irCyLo = _irCyI - 25, _irCyHi = _irCyI + 25;
      var _irSCL_THRESH = 0.10;
      var _irRB  = _irRI;
      var _irCxB = _irCxI, _irCyB = _irCyI;
      var _irStartFrac = _irSclFrac(_irCxB, _irCyB, _irRB, _sclAdaptHi);

      // ── T-BAR HORIZONTAL LIMBUS SCAN (replaces 48-ray RANSAC) ─────────────
      // Root cause of prior overestimation: casting rays from the pupil (offset
      // ~5-15% of iR below iris center) makes upper-eyelid hits appear at similar
      // distances from the off-center origin as true lower-limbus hits — no filter
      // or fitting algorithm can cleanly separate them.
      //
      // Fix: cast only near-horizontal rays from CASCADE CENTER (niCx, niCy).
      // At 3 and 9 o'clock the eyelid is never in the ray path. Average left+right
      // crossing distances gives the horizontal iris radius directly (no fit needed).
      // Then scan downward for the lower limbus to correct any Y-center bias.
      var _rayUsed = false;

      // Single-ray helper: walks outward from (ox,oy) in direction (rcos,rsin).
      // Returns distance to first scleral crossing, or -1 if not found.
      // Primary: see iris (sat>25) then 3 consecutive scleral steps (sat<20, lum>Lo).
      // Gray/blue iris fallback: max luminance gradient (lum rise > 12).
      function _scanRay(ox, oy, rcos, rsin, lo, hi) {
        var lms=[],sts=[],pos=[];
        for(var rr=lo;rr<=hi;rr+=2){
          var px=Math.round(ox+rcos*rr),py=Math.round(oy+rsin*rr);
          if(px<0||py<0||px>=_irIW||py>=_irIH)break;
          var bi=(py*_irIW+px)*4;
          var R=_irPx[bi],G=_irPx[bi+1],B=_irPx[bi+2],mx=Math.max(R,G,B);
          lms.push(0.299*R+0.587*G+0.114*B);
          sts.push(mx>10?(mx-Math.min(R,G,B))/mx*255:0);
          pos.push(rr);
        }
        var had=false,run=0;
        for(var gi=0;gi<lms.length;gi++){
          if(sts[gi]>25)had=true;
          if(had&&sts[gi]<20&&lms[gi]>_sclAdaptLo){if(++run>=3)return pos[Math.max(0,gi-3)];}
          else run=0;
        }
        var bg=0,br=-1;
        for(var gi2=2;gi2<lms.length;gi2++){var g=lms[gi2]-lms[gi2-2];if(g>bg){bg=g;br=pos[gi2-1];}}
        return(bg>12)?br:-1;
      }

      // ── T-BAR from CASCADE CENTER (niCx/niCy) — all paths ───────────────────
      // niCx/niCy comes from the BAND sclera-pair scan and is reliable even when
      // PUPIL-GUARD fires X-RECENTER (BAND finds the bilateral sclera boundary,
      // not the pupil).  X-BAR (from pupil) was replaced because the inner-canthus
      // tissue terminates left-side rays far too early, making the radius wrong.
      //
      // X-correction: T-bar L/R asymmetry detects any residual niCx error:
      //   iris_cx = niCx + (rightAvg − leftAvg) / 2
      // Only applied when X-RECENTER fired (normal-path niCx is already accurate).
      //
      // OOB fallback: reset ITER-REFINE anchor to niCx so its ±25px bound reaches
      // the true iris centre (not the pupil position set by PUPIL-GUARD).
      var _tbLo = iR * 0.50;
      var _tbHi = Math.min(_irCeil, _xRecenterFired ? iR * 1.55 : iR * 1.35);
      var _tbRAs=[0,10,20], _tbLAs=[180,170,160];
      var _tbRRs=[], _tbLRs=[];
      for(var _tbi=0;_tbi<_tbRAs.length;_tbi++){
        var _tbRad=_tbRAs[_tbi]*Math.PI/180;
        var _r=_scanRay(niCx,niCy,Math.cos(_tbRad),Math.sin(_tbRad),_tbLo,_tbHi);
        if(_r>0)_tbRRs.push(_r);
      }
      for(var _tbi2=0;_tbi2<_tbLAs.length;_tbi2++){
        var _tbRad2=_tbLAs[_tbi2]*Math.PI/180;
        var _l=_scanRay(niCx,niCy,Math.cos(_tbRad2),Math.sin(_tbRad2),_tbLo,_tbHi);
        if(_l>0)_tbLRs.push(_l);
      }
      var _tbRavg=_tbRRs.length?_tbRRs.reduce(function(a,b){return a+b;})/_tbRRs.length:-1;
      var _tbLavg=_tbLRs.length?_tbLRs.reduce(function(a,b){return a+b;})/_tbLRs.length:-1;
      var _tbRadius=(_tbRavg>0&&_tbLavg>0)?(_tbRavg+_tbLavg)/2:
                    (_tbRavg>0)?_tbRavg:(_tbLavg>0)?_tbLavg:-1;
      console.log('[T-BAR] R=['+_tbRRs.map(Math.round).join(',')+'] avg='+Math.round(_tbRavg)+
                  '  L=['+_tbLRs.map(Math.round).join(',')+'] avg='+Math.round(_tbLavg)+
                  '  radius='+Math.round(_tbRadius));

      // Band mode: always enter applied block — use BAND iR/cy regardless of T-bar scan.
      // Non-band: T-bar radius must pass the OOB guard.
      if(_isFromBand || (_tbRadius>=_irFlr&&_tbRadius<=_irCeil*1.15)){
        // Lower-limbus Y correction: scan at 80deg/90deg/100deg (all go downward,
        // sin>0). true_cy = (niCy + downR) - horizontalR. Skip if downR is outside
        // 80-120% of hR (protects against lower-eyelid occlusion or missing sclera).
        var _tbDAs=[80,90,100], _tbDRs=[];
        for(var _tdi=0;_tdi<_tbDAs.length;_tdi++){
          var _tdRad=_tbDAs[_tdi]*Math.PI/180;
          var _dR=_scanRay(niCx,niCy,Math.cos(_tdRad),Math.sin(_tdRad),_tbLo,_tbHi);
          if(_dR>0)_tbDRs.push(_dR);
        }
        var _tbDownR=-1;
        if(_tbDRs.length){
          _tbDRs.sort(function(a,b){return a-b;});
          _tbDownR=_tbDRs[Math.floor(_tbDRs.length/2)];
        }
        console.log('[T-BAR] downRs=['+_tbDRs.map(Math.round).join(',')+
                    '] median='+Math.round(_tbDownR));

        // Y correction:
        // Band mode: use PUPIL-GUARD's cy only when the BAND↔pupil gap is large
        // (> 30% of iR). A large gap signals BAND got the Y centre wrong (found
        // scleral-brightness pair far from the iris centre, not the limbus). In that
        // case PUPIL-GUARD's pupil centre is the more reliable vertical anchor.
        // Small gaps (≤ 30% of iR): BAND was already near the iris centre. Using
        // the pupil centre would over-correct since the pupil sits slightly inferior
        // within the iris — keep BAND's niCy instead.
        // Non-band: use T-bar downward scan when downR is within ±20% of T-bar radius.
        var _tbNewCy = niCy;
        if (_isFromBand) {
          var _yBandGap = Math.abs(_irCyI - niCy);
          var _yBandGapFrac = _yBandGap / iR;
          if (_yBandGapFrac > 0.30) {
            // Large gap: BAND Y is unreliable — use PUPIL-GUARD cy.
            _tbNewCy = _irCyI;
            console.log('[T-BAR] Y-BAND: gap='+_yBandGapFrac.toFixed(2)+'×iR (>0.30) → PUPIL-GUARD cy='+Math.round(_irCyI));
          } else {
            // Small gap: BAND cy is reliable — keep niCy.
            _tbNewCy = niCy;
            console.log('[T-BAR] Y-BAND: gap='+_yBandGapFrac.toFixed(2)+'×iR (≤0.30) → BAND cy='+Math.round(niCy));
          }
        } else {
          if(_tbDownR>0&&_tbDownR>=_tbRadius*0.80&&_tbDownR<=_tbRadius*1.20){
            _tbNewCy=niCy+_tbDownR-_tbRadius;
            console.log('[T-BAR] Y-CORRECT: niCy='+Math.round(niCy)+
                        ' downR='+Math.round(_tbDownR)+' ref='+Math.round(_tbRadius)+
                        ' newCy='+Math.round(_tbNewCy)+
                        ' (shift='+Math.round(_tbNewCy-niCy)+'px)');
          }
        }
        // X-correction: T-bar asymmetry corrects any niCx error.
        // Formula: iris_cx = niCx + (rightAvg − leftAvg) / 2
        // Applied when X-RECENTER fired (pupil used as centre, niCx is off).
        // Also applied when _probeFloorFired: sclera-pair gave a false inner-
        // corner hit (irisR=199), meaning its CENTRE is also unreliable.
        // The T-BAR L/R asymmetry gives the true iris geometric centre directly.
        var _tbCx = niCx;
        if((_xRecenterFired || _probeFloorFired) && _tbRavg>0 && _tbLavg>0){
          var _xCorr = (_tbRavg - _tbLavg) / 2;
          _tbCx = niCx + Math.max(-iR*0.30, Math.min(iR*0.30, _xCorr));
          if(Math.abs(_xCorr)>2){
            console.log('[T-BAR] X-CORRECT: niCx='+Math.round(niCx)+' R='+Math.round(_tbRavg)+
                        ' L='+Math.round(_tbLavg)+' xCorr='+Math.round(_xCorr)+
                        ' → cx='+Math.round(_tbCx)+((_probeFloorFired)?' (probeFloor)':''));
          }
        }
        // Centre is always corrected (T-bar gives better centre than CASCADE).
        donut.cx=drawInfo.dx+_tbCx*nsx;
        donut.cy=drawInfo.dy+_tbNewCy*nsy;
        if (!_isFromBand) {
          // Non-band: also apply T-bar radius and mark done (ITER-REFINE skipped).
          donut.rIris=Math.round(_tbRadius*nsx);
          _rayUsed=true;
          console.log('[T-BAR] APPLIED: rIris='+donut.rIris+
                      ' cx='+Math.round(donut.cx)+' cy='+Math.round(donut.cy));
        } else {
          // Band mode: apply centre only — ITER-REFINE will optimise the radius.
          // BAND's iR (set via FLOOR at iR×1.00) is the ITER-REFINE starting point.
          // The FLOOR at iR×0.72 approximates the true limbus after BAND's outer-sclera bias.
          // ITER-REFINE Phase 1 (SHRINK) brings the ring from BAND's overestimate down
          // toward that floor, landing close to the true limbus.
          // Update ITER-REFINE anchors to the T-bar-corrected centre.
          _irCxI=_tbCx; _irCyI=_tbNewCy;
          _irCxB=_tbCx; _irCyB=_tbNewCy;
          _irCxLo=_tbCx-25; _irCxHi=_tbCx+25;
          _irCyLo=_tbNewCy-25; _irCyHi=_tbNewCy+25;
          // _rayUsed stays false → ITER-REFINE runs from corrected centre.
          // ProbeFloor: the cascade radius (466) was measured from the wrong centre
          // (1453). From the corrected centre (1392), 466 is well INSIDE the true
          // limbus (525). ITER-REFINE Phase 2 will expand from 466 to ~525.
          // BAND-FLOOR-RESCUE is gated off for probeFloorFired (see below).
          console.log('[T-BAR] BAND-CENTRE: cx='+Math.round(donut.cx)+
                      ' cy='+Math.round(donut.cy)+
                      ' rStart='+Math.round(donut.rIris/nsx)+
                      ' → ITER-REFINE will optimise radius');
        }
      } else {
        console.log('[T-BAR] radius='+Math.round(_tbRadius)+' OOB ['+
                    Math.round(_irFlr)+','+Math.round(_irCeil*1.15)+
                    '] fallback to ITER-REFINE');
        // For X-RECENTER: PUPIL-GUARD placed donut.cx at the pupil, so _irCxI is
        // the pupil centre (e.g. 242). ITER-REFINE's ±25px bound can never reach the
        // true iris centre (e.g. 204). Reset anchor to niCx so ITER-REFINE can fine-tune
        // from the correct starting position.
        if(_xRecenterFired){
          _irCxB = niCx; _irCxLo = niCx-25; _irCxHi = niCx+25;
          console.log('[T-BAR] OOB: ITER-REFINE anchor reset to niCx='+Math.round(niCx));
        }
      }

      if (!_rayUsed) {
      // Phase 1: SHRINK — step inward while scleral fraction exceeds threshold
      var _irP1n = 0;
      while (_irRB > _irFlr && _irSclFrac(_irCxB, _irCyB, _irRB, _sclAdaptHi) > _irSCL_THRESH && _irP1n < 50) {
        _irRB -= 2; _irP1n++;
      }
      // Phase 3 (first pass): CENTER — correct centre BEFORE Phase 2 so that
      // FIND-LIMBUS uses the best-aligned cx/cy.
      var _irCurrFrac = _irSclFrac(_irCxB, _irCyB, _irRB, _sclAdaptHi);
      var _irDxArr = [2, -2, 0, 0], _irDyArr = [0, 0, 2, -2];
      for (var _irC = 0; _irC < 20; _irC++) {
        var _irCMoved = false;
        for (var _irCI = 0; _irCI < 4; _irCI++) {
          var _irCx3 = _irCxB + _irDxArr[_irCI], _irCy3 = _irCyB + _irDyArr[_irCI];
          if (_irCx3 < _irCxLo || _irCx3 > _irCxHi || _irCy3 < _irCyLo || _irCy3 > _irCyHi) continue;
          var _irF3 = _irSclFrac(_irCx3, _irCy3, _irRB, _sclAdaptHi);
          if (_irF3 < _irCurrFrac) { _irCurrFrac = _irF3; _irCxB = _irCx3; _irCyB = _irCy3; _irCMoved = true; break; }
        }
        if (!_irCMoved) break;
      }
      // Phase 1b: SHRINK RETRY — fires when Phase 1 moved < 3 steps.
      // Uses adaptive Lo threshold to catch dim sclera adjacent to limbus.
      // Phase 2 does NOT run after Phase 1b fires.
      //
      // Band-mode extra: Phase 1 uses Hi threshold and can stop well above the floor
      // because eyelid shadow suppresses scleral detection near the limbus.
      // BAND always overestimates iR (finds outer-sclera brightness peaks, not limbus).
      // If Phase 1 stopped > 5% above the floor (iR×0.72), fire Phase 1b with Lo
      // threshold so the ring can continue shrinking toward the true limbus.
      // Exception (_probeFloorFired): the starting radius IS the cascade's limbus
      // estimate (not a sclera-pair overestimate) — P1b would over-shrink past it.
      var _irBandNeedsP1b = _isFromBand && !_probeFloorFired && _irRB > _irFlr * 1.05;
      var _irP1bFired = false;
      // _probeFloorFired: cascade result is already at the true limbus (not a
      // sclera-pair overestimate). Suppress P1b entirely — it would shrink past
      // the correct limbus using the Lo threshold.  Phase 2 FIND-LIMBUS runs
      // instead, stepping outward to confirm the exact limbus position.
      if (!_probeFloorFired && ((_irP1n < 3 && !_xRecenterFired) || _irBandNeedsP1b)) {
        var _irP1bN = 0;
        while (_irRB > _irFlr && _irSclFrac(_irCxB, _irCyB, _irRB, _sclAdaptLo) > _irSCL_THRESH && _irP1bN < 50) {
          _irRB -= 2; _irP1bN++;
        }
        if (_irP1bN > 0) {
          _irP1bFired = true;
          console.log('[ITER-REFINE] P1b (Lo=' + _sclAdaptLo + '): shrunk ' + _irP1bN + ' steps → r=' + Math.round(_irRB) +
                      ' sclLo=' + _irSclFrac(_irCxB, _irCyB, _irRB, _sclAdaptLo).toFixed(3));
        }
      }
      // Phase 2: FIND-LIMBUS — step outward until sclera reappears, then step back.
      // Also fires when X-RECENTER corrected a severely mis-centred cascade.
      // Also fires when _probeFloorFired: the corrected centre (1392) is inside the iris
      // at rStart=466, so Phase 1 took 0 steps. Phase 2 must expand from 466 → ~525.
      // Does NOT fire after Phase 1b.
      if ((_irP1n > 0 || _probeFloorFired || (_xRecenterFired && _irCurrFrac < _irSCL_THRESH)) && !_irP1bFired) {
        var _irRBefore2 = _irRB;
        var _irP2n = 0;
        while (_irRB < _irCeil && _irSclFrac(_irCxB, _irCyB, _irRB, _sclAdaptHi) < _irSCL_THRESH && _irP2n < 60) {
          _irRB += 2; _irP2n++;
        }
        if (_irSclFrac(_irCxB, _irCyB, _irRB, _sclAdaptHi) > _irSCL_THRESH) {
          _irRB = Math.max(_irFlr, _irRB - 2);
        }
        if (_irP2n > 0) {
          console.log('[ITER-REFINE] P2 FIND-LIMBUS: ' + Math.round(_irRBefore2) + '→' + Math.round(_irRB) +
                      ' (' + _irP2n + ' steps)' + (_probeFloorFired ? ' [probeFloor]' : ''));
        }
        // NOTE: T-BAR-R radius override was considered but reverted.
        // When only 1 of 3 L-side rays succeeds (L=[586], single measurement),
        // the T-BAR radius is unreliable — it over-extends into temporal sclera.
        // Phase 2 result (478px from inferior sclera detection) is the best
        // circular fit for this anisotropic iris. User can fine-tune manually;
        // the Ring Correction Memory will save and re-apply the correction.
      }
      // Band-mode floor rescue: if all phases still leave the ring ≥ 20% above the
      // floor (iR×0.72), the adaptive scleral thresholds were calibrated to the bright
      // outer sclera and couldn't detect the dimmer periocular sclera near the limbus.
      // The floor itself IS the best limbus estimate for BAND's outer-sclera overestimation
      // (BAND radius ≈ true_limbus × 1.40, floor = iR×0.72 ≈ iR/1.40 ≈ true limbus).
      //
      // Guard: rescue fires when Phase 1 moved ≥ 5 steps OR when the starting
      // scleral fraction was 0 AND Phase 1b also moved ≥ 5 steps.
      // Phase 1 moving ≥ 5 steps: BAND clearly overestimated and ITER-REFINE shrank
      //   but got stuck (periocular sclera dimmer than the outer-sclera calibration).
      // startFrac = 0 AND P1bN ≥ 5: adaptive threshold is completely blind and P1b
      //   had to shrink significantly — BAND overestimated, rescue is appropriate.
      // Exception (Rachel-type): startFrac=0 BUT P1bN ≥ 1 means Lo threshold found
      //   sclera nearby and P1b moved toward it — the limbus is close. Leave alone.
      // When P1bN === 0: Lo threshold is ALSO completely blind far from the limbus —
      //   BAND dramatically overestimated AND thresholds can't see sclera at all.
      //   The floor (iR×0.72) is the best available limbus estimate — rescue it.
      // BAND-FLOOR-RESCUE is suppressed when _probeFloorFired: the T-BAR X-correction
      // has already placed the ring at the true iris geometric centre, and the starting
      // radius is the cascade value (466) from that corrected centre — which is well
      // inside the true limbus (525). ITER-REFINE will expand to the limbus from there.
      // Rescue would incorrectly force it down to the 72% floor (380px).
      if (_isFromBand && !_probeFloorFired && _irRB > _irFlr * 1.20 &&
          (_irP1n >= 5 || (_irStartFrac === 0 && _irP1bN === 0))) {
        console.log('[ITER-REFINE] BAND-FLOOR-RESCUE: r=' + Math.round(_irRB) +
                    ' > floor×1.20=' + Math.round(_irFlr * 1.20) +
                    ' → forcing r→floor=' + Math.round(_irFlr));
        _irRB = _irFlr;
      }
      var _irRChg = Math.abs(_irRB - _irRI);
      var _irCChg = Math.sqrt(Math.pow(_irCxB-_irCxI,2) + Math.pow(_irCyB-_irCyI,2));
      var _irFinalFrac = _irSclFrac(_irCxB, _irCyB, _irRB, _sclAdaptHi);
      console.log('[ITER-REFINE] scl: ' + _irStartFrac.toFixed(3) + '→' + _irFinalFrac.toFixed(3) +
                  '  p1=' + _irP1n + 'steps  r: ' + Math.round(_irRI) + '→' + Math.round(_irRB) +
                  '  cx: ' + Math.round(_irCxI) + '→' + Math.round(_irCxB) +
                  '  cy: ' + Math.round(_irCyI) + '→' + Math.round(_irCyB));
      if (_irRChg > 2 || _irCChg > 2) {
        donut.rIris = Math.round(_irRB * nsx);
        donut.cx    = drawInfo.dx + _irCxB * nsx;
        donut.cy    = drawInfo.dy + _irCyB * nsy;
        console.log('[ITER-REFINE] APPLIED: rIris=' + donut.rIris + ' (img=' + Math.round(_irRB) + ')  cx=' + Math.round(donut.cx) + '  cy=' + Math.round(donut.cy));
      } else {
        console.log('[ITER-REFINE] no significant change — cascade result kept');
      }
      } // end if (!_rayUsed)

      // ── BAND-mode pupil-anchor iris centre correction (PCC) ──────────────────
      // After ITER-REFINE, if the iris ring centre is too far from the
      // reliably-detected pupil centre, move the iris centre toward the pupil.
      // Only runs in BAND/close-up mode where zPupil is accurate.
      //
      // NOT run when _probeFloorFired: the T-BAR X-correction already computed
      // the true iris geometric centre from the L/R asymmetry, and promoted the
      // T-BAR symmetric radius as the ITER-REFINE start.  PCC would incorrectly
      // move the correctly-placed ring centre to the pupil anchor.
      //
      // Normal BAND (sclera-pair centre reliable): threshold=20%, leave 10%
      // residual, then expand the ring to sclera from the corrected centre.
      if (_isFromBand && zPupil && !_probeFloorFired) {
        var _pccIrX    = (donut.cx - drawInfo.dx) / nsx;
        var _pccIrY    = (donut.cy - drawInfo.dy) / nsy;
        var _pccDx     = _pccIrX - zPupil.cx;
        var _pccDy     = _pccIrY - zPupil.cy;
        var _pccDist   = Math.sqrt(_pccDx*_pccDx + _pccDy*_pccDy);
        var _pccR      = donut.rIris / nsx;
        var _pccOffPct = _pccR > 0 ? _pccDist / _pccR : 0;
        // Probe-floor: sclera-pair centre is unreliable — correct aggressively,
        // but keep the cascade radius (it is reliable from the old centre and
        // approximates the true limbus from the corrected pupil-anchor centre too).
        var _pccThresh   = _probeFloorFired ? 0.05 : 0.20;
        var _pccResidual = _probeFloorFired ? 0.00 : 0.10;
        var _pccFracCap  = _probeFloorFired ? 1.00 : 0.80;
        console.log('[PCC] iris-pupil: dx=' + Math.round(_pccDx) + ' dy=' + Math.round(_pccDy) +
                    ' dist=' + Math.round(_pccDist) + ' (' + Math.round(_pccOffPct * 100) +
                    '% of rIris=' + Math.round(_pccR) + ') thresh=' + Math.round(_pccThresh * 100) +
                    '% probeFloor=' + _probeFloorFired);
        if (_pccOffPct > _pccThresh && _pccDist > 0) {
          // Shift iris centre toward (or all the way to) the pupil.
          var _pccFrac = _pccResidual > 0
            ? Math.min(1 - _pccResidual / _pccOffPct, _pccFracCap)
            : _pccFracCap;
          var _pccNx = _pccIrX - _pccDx * _pccFrac;
          var _pccNy = _pccIrY - _pccDy * _pccFrac;
          donut.cx = drawInfo.dx + _pccNx * nsx;
          donut.cy = drawInfo.dy + _pccNy * nsy;
          console.log('[PCC] APPLIED frac=' + _pccFrac.toFixed(2) +
                      ' → new iris cx=' + Math.round(donut.cx) + ' cy=' + Math.round(donut.cy) +
                      ' (img: ' + Math.round(_pccNx) + ',' + Math.round(_pccNy) + ')');
          // For normal BAND paths: expand ring from corrected centre until sclera.
          // For probeFloorFired: keep cascade radius — expand is unreliable from
          // the pupil anchor (limbus is anisotropic relative to the pupil centre).
          if (!_probeFloorFired) {
            var _pccRB   = _pccR;
            var _pccCeil = iR * 1.55;
            var _pccSt   = 0;
            while (_pccRB < _pccCeil &&
                   _irSclFrac(_pccNx, _pccNy, _pccRB, _sclAdaptHi) < _irSCL_THRESH &&
                   _pccSt < 60) {
              _pccRB += 2; _pccSt++;
            }
            if (_irSclFrac(_pccNx, _pccNy, _pccRB, _sclAdaptHi) > _irSCL_THRESH) _pccRB -= 2;
            if (_pccRB > _pccR + 2) {
              donut.rIris = Math.round(_pccRB * nsx);
              console.log('[PCC] EXPANDED: rIris ' + Math.round(_pccR) + '→' + Math.round(_pccRB) +
                          ' from corrected centre');
            }
          } else {
            console.log('[PCC] probeFloor: keeping cascade rIris=' + Math.round(_pccR) +
                        ' (expand skipped — anisotropic from pupil anchor)');
          }
        }
      }
    }
    // ── Visible-iris inward limbus scan (centre correction) ───────────────────
    // Quality gate: if > 15 % of the ring boundary samples are scleral
    // (sat < 25), the cascade centre is off — typically a gaze-shifted selfie
    // where the visible 2-D iris centre ≠ MediaPipe's 3-D anatomical centre.
    //
    // fitVisibleIrisHoriz now scans INWARD from the crop edges (sclera side)
    // until saturation rises — the sclera→iris transition = true limbus.
    // This avoids dark-fibre false stops that plagued the outward scan.
    // Uses a ±20 px vertical band to smooth individual radial fibre crossings.
    //
    // Correction: centre only.  The cascade radius (from RIP/ODH) is kept;
    // only cx is corrected so the ring is centred on the visible iris midpoint.
    // Only runs in full-face mode (close-up has its own cascade path).
    if (!isCloseupMode) {
      var _visCx  = (donut.cx  - drawInfo.dx) / nsx;
      var _visCy  = (donut.cy  - drawInfo.dy) / nsy;
      var _visR   = donut.rIris / nsx;
      var _visFrac = typeof ringBoundarySatFraction === 'function'
                     ? ringBoundarySatFraction(imgEl, _visCx, _visCy, _visR) : 0;
      // Edge guard: if the iris centre is within 0.5×rIris of either crop edge,
      // the boundary sample on that side lands in sclera by definition — the iris
      // is clipped.  Skip VIS-FIT here; the longest-run scan would find a tiny
      // spurious run and return a catastrophically wrong cx/rIris.
      var _visCropW = imgEl.naturalWidth  || imgEl.width;
      var _visCropH = imgEl.naturalHeight || imgEl.height;
      var _visEdgeClear = Math.min(_visCx, _visCropW - _visCx, _visCy, _visCropH - _visCy);
      var _visEdgeGuard = _visEdgeClear < _visR * 0.5;
      console.log('[VIS-FIT] scleral=' + Math.round(_visFrac * 100) + '%' +
                  '  edgeClear=' + Math.round(_visEdgeClear) + 'px' +
                  '  rIris=' + Math.round(_visR) + 'px' +
                  (_visEdgeGuard ? '  → SKIPPED (iris at crop edge)' :
                   _visFrac <= 0.15 ? '  → OK (below threshold)' : '  → FIRING'));
      if (!_visEdgeGuard && _visFrac > 0.15) {
        var _zPupilR_crop = donut.rPupil / nsx;
        var _visFit = typeof fitVisibleIrisHoriz === 'function'
                      ? fitVisibleIrisHoriz(imgEl, _visCx, _visCy, _visR, _zPupilR_crop) : null;
        if (_visFit) {
          // Sanity check: if one side's limbus measurement is >2.5× the other,
          // VIS-FIT likely hit the collarette or another artifact instead of
          // true sclera. Reject the correction and keep the SAT-LIMBUS result.
          var _vL = _visFit.r_left, _vR = _visFit.r_right;
          var _visSideRatio = (_vL > _vR) ? (_vL / Math.max(_vR, 1))
                                           : (_vR / Math.max(_vL, 1));
          if (_visSideRatio > 2.5) {
            console.log('[VIS-FIT] REJECTED — side ratio ' + _visSideRatio.toFixed(1) +
                        ':1 (false stop; L=' + _vL + ' R=' + _vR + ')');
          } else {
            // Apply both cx and rIris from the pixel measurement.
            // The longest-run scan finds the true visible iris span at the midline;
            // both the centre and the radius can differ from the cascade estimate
            // when the eye is looking off-axis (cascade centre drifts with gaze).
            donut.cx    = drawInfo.dx + _visFit.cx * nsx;
            donut.rIris = Math.min(_visFit.rIris * nsx, Math.min(stageW, stageH) * 0.45);
            console.log('[VIS-FIT] cx: ' + Math.round(_visCx) + '→' + _visFit.cx +
                        ' (Δ=' + (_visFit.cx - Math.round(_visCx)) + 'px)' +
                        '  rIris: ' + Math.round(_visR) + '→' + _visFit.rIris +
                        '  limbus_L=' + _vL + ' limbus_R=' + _vR);
          }
        } else {
          console.log('[VIS-FIT] longest-run scan returned null');
        }
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    draw();

    // ── Placement check + confidence-aware advisory ─────────────────────────
    // Advisory-only: never blocks the user. Low RIP confidence or gross-error
    // placement check both trigger the amber hint pointing to touch-drag adjust.
    var hint = $('autofit-hint');
    var cx_chk    = (donut.cx     - drawInfo.dx) / nsx;
    var cy_chk    = (donut.cy     - drawInfo.dy) / nsy;
    var rIris_chk = donut.rIris / nsx;
    var placement = checkIrisPlacement(imgEl, cx_chk, cy_chk, rIris_chk);
    var retakeBtn2 = $('btn-quality-retake');
    if (hint) {
      // placement.ok is the ground-truth quality signal: it confirms sclera
      // contrast is visible just outside the circle at 3/9 o'clock. When it
      // passes, the circle is correctly fitted regardless of which OD algorithm
      // fired. Only show an advisory when placement actually fails.
      var needsAdvisory = !placement.ok;
      // Glasses detection: if the zoom crop covered less than 15% of the pre-zoom image
      // width, detection was confused by glasses frames (tiny circle got upscaled).
      var preW = preZoomState && preZoomState.imgEl ? preZoomState.imgEl.width : imgEl.width;
      var glassesSmall  = (imgEl.width / preW) < 0.15;
      if (glassesSmall) {
        // Tiny zoom crop = glasses confused detection.
        // Undo the zoom, restore the full-face image, and drop to manual placement
        // so the user sees the full photo with a usable circle to drag — not a blurry
        // blown-up nose bridge.
        if (preZoomState && preZoomState.imgEl) {
          imgEl      = preZoomState.imgEl;
          cropRegion = preZoomState.cropRegion
                         ? Object.assign({}, preZoomState.cropRegion) : null;
          layoutStage();
        }
        donut.cx = stageW / 2; donut.cy = stageH / 2;
        donut.cxPupil = stageW / 2; donut.cyPupil = stageH / 2;
        donut.rIris  = Math.round(Math.min(stageW, stageH) * 0.22);
        donut.rPupil = Math.round(donut.rIris * 0.22);
        draw();
        hint.textContent = 'Wearing glasses? Remove them for best results, or drag the ring onto your iris.';
        hint.style.color = '#f5a623';
        if (retakeBtn2) retakeBtn2.style.display = '';
      } else if (needsAdvisory) {
        // Differentiate by how far we fell back: total fallback vs partial
        var isLowConf = _zFellBack && _zRipConf < 0.15;
        hint.textContent = isLowConf
          ? 'Low confidence — try a clearer photo, or drag the ring to fit manually and tap Analyze.'
          : 'Uncertain fit — drag the ring to adjust if needed, then tap Analyze.';
        hint.style.color = '#f5a623';
        if (retakeBtn2) retakeBtn2.style.display = '';
      } else {
        hint.textContent = 'Auto-fit complete. Drag to adjust, then tap "Analyze Iris".';
        hint.style.color = '';
        if (retakeBtn2) retakeBtn2.style.display = 'none';
      }
    }
    // Ring Correction Memory: if this image was previously placed manually,
    // override the auto-fit result with the saved correction — but only if:
    //  (a) center drift < 40 % of irisR  (old pre-zoom positions land far away)
    //  (b) stored radius within 40–160 % of current auto-fit radius (catches
    //      stale tiny/huge rings even when the center happens to be nearby)
    var _storedRing = _loadedFile ? _ringStore.get(_loadedFile) : null;
    if (_storedRing) {
      var _sRestoredCx = drawInfo.dx + _storedRing.irisCxFrac * drawInfo.dw;
      var _sRestoredCy = drawInfo.dy + _storedRing.irisCyFrac * drawInfo.dh;
      var _sRestoredR  = _storedRing.irisRFrac * drawInfo.dw;
      var _sDrift = Math.sqrt(
        Math.pow(_sRestoredCx - donut.cx, 2) + Math.pow(_sRestoredCy - donut.cy, 2));
      var _sRatio = _sRestoredR / (donut.rIris || 1);
      var _sDriftOk = _sDrift < donut.rIris * 0.4;          // tightened: 0.5 → 0.4
      var _sRadiusOk = _sRatio >= 0.6 && _sRatio <= 1.6;    // radius must be plausible
      console.log('[RING-STORE] drift=' + Math.round(_sDrift) + ' rIris=' + Math.round(donut.rIris) +
                  ' storedR=' + Math.round(_sRestoredR) + ' ratio=' + _sRatio.toFixed(2) +
                  ' driftOk=' + _sDriftOk + ' radOk=' + _sRadiusOk);
      if (_sDriftOk && _sRadiusOk && _applyStoredRing(_storedRing)) {
        draw();
        if (hint) {
          hint.textContent = 'Restored your saved placement. Adjust if needed, then tap "Analyze Iris".';
          hint.style.color = '#6cc4ff';
        }
        console.log('[RING-STORE] restored:', _loadedFile ? _loadedFile.name : '?');
      } else {
        console.log('[RING-STORE] skipped stale placement (drift=' + Math.round(_sDrift) + ' ratio=' + _sRatio.toFixed(2) + ')');
      }
    }
  };
  newImg.src = off.toDataURL();
}

function draw(){
  if (!imgEl) return;
  var cxP = donut.cxPupil != null ? donut.cxPupil : donut.cx;
  var cyP = donut.cyPupil != null ? donut.cyPupil : donut.cy;

  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, stageW, stageH);
  ctx.drawImage(imgEl, drawInfo.dx, drawInfo.dy, drawInfo.dw, drawInfo.dh);

  if (donut.analyzed) {
    // ── Post-analysis: clean view — thin ghost rings only, no overlay or handles
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(108,196,255,0.30)';
    ctx.beginPath(); ctx.arc(donut.cx, donut.cy, donut.rIris, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,214,108,0.30)';
    ctx.beginPath(); ctx.arc(cxP, cyP, donut.rPupil, 0, Math.PI*2); ctx.stroke();
    return;
  }

  // Dark overlay cut out by iris
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.rect(0, 0, stageW, stageH);
  ctx.arc(donut.cx, donut.cy, donut.rIris, 0, Math.PI*2, true);
  ctx.fill('evenodd');
  ctx.restore();

  // Pupil fill
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath(); ctx.arc(cxP, cyP, donut.rPupil, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  var irisActive  = fitActiveCircle === 'iris';
  var irisColor   = irisActive  ? '#6cc4ff' : 'rgba(108,196,255,0.35)';
  var pupilColor  = !irisActive ? '#ffd66c' : 'rgba(255,214,108,0.35)';
  var irisLW      = irisActive  ? 2 : 1;
  var pupilLW     = !irisActive ? 2 : 1;

  // Iris ring
  ctx.lineWidth = irisLW; ctx.strokeStyle = irisColor;
  ctx.beginPath(); ctx.arc(donut.cx, donut.cy, donut.rIris, 0, Math.PI*2); ctx.stroke();

  // Pupil ring
  ctx.lineWidth = pupilLW; ctx.strokeStyle = pupilColor;
  ctx.beginPath(); ctx.arc(cxP, cyP, donut.rPupil, 0, Math.PI*2); ctx.stroke();

  // Active circle: crosshair at center + 4 edge handles
  var acx = irisActive ? donut.cx    : cxP;
  var acy = irisActive ? donut.cy    : cyP;
  var ar  = irisActive ? donut.rIris : donut.rPupil;
  var ac  = irisActive ? '#6cc4ff'   : '#ffd66c';
  ctx.strokeStyle = ac; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(acx - 7, acy); ctx.lineTo(acx + 7, acy);
  ctx.moveTo(acx, acy - 7); ctx.lineTo(acx, acy + 7);
  ctx.stroke();
  [[acx+ar,acy],[acx-ar,acy],[acx,acy-ar],[acx,acy+ar]].forEach(function(h){
    ctx.beginPath(); ctx.arc(h[0], h[1], 5, 0, Math.PI*2);
    ctx.fillStyle = ac; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
  });
}

// ── Direct-drag circle editing (annotate-style) ───────────────────────────────
// Inside circle  → move   |   On edge (±EDGE_TOL px) → resize   |   Outside → draw fresh
var fitActiveCircle = 'iris';
var fitDrag = null;
var EDGE_TOL = 18;   // display pixels

function selectFitCircle(which) {
  fitActiveCircle = which;
  var ti = $('tab-iris'), tp = $('tab-pupil');
  if (ti) { ti.className = 'circ-tab iris'  + (which === 'iris'  ? ' active' : ''); }
  if (tp) { tp.className = 'circ-tab pupil' + (which === 'pupil' ? ' active' : ''); }
  draw();
}

function fitCanvasPt(clientX, clientY) {
  var rect = canvas.getBoundingClientRect();
  // Scale from CSS pixels to logical stage pixels (NOT canvas buffer pixels).
  // canvas.width = stageW * dpr, so using canvas.width/rect.width would
  // double-count dpr and shift every touch by ~dpr× away from origin.
  var sx = stageW / rect.width;
  var sy = stageH / rect.height;
  return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
}

function fitActiveCx()  { return fitActiveCircle === 'iris' ? donut.cx     : (donut.cxPupil != null ? donut.cxPupil : donut.cx); }
function fitActiveCy()  { return fitActiveCircle === 'iris' ? donut.cy     : (donut.cyPupil != null ? donut.cyPupil : donut.cy); }
function fitActiveR()   { return fitActiveCircle === 'iris' ? donut.rIris  : donut.rPupil; }
function fitSetCenter(x, y) {
  if (fitActiveCircle === 'iris') { donut.cx = x; donut.cy = y; }
  else { donut.cxPupil = x; donut.cyPupil = y; }
}
function fitSetRadius(r) {
  if (fitActiveCircle === 'iris') {
    donut.rIris = Math.max(10, r);
    if (donut.rPupil >= donut.rIris) donut.rPupil = Math.round(donut.rIris * 0.4);
  } else {
    donut.rPupil = Math.max(4, Math.min(r, donut.rIris * 0.9));
  }
}

function fitOnDown(clientX, clientY) {
  if (!imgLoaded) return false;
  var p   = fitCanvasPt(clientX, clientY);
  var cx  = fitActiveCx(), cy = fitActiveCy(), r = fitActiveR();
  var et  = EDGE_TOL;
  var d   = Math.hypot(p.x - cx, p.y - cy);
  if (r > 0 && Math.abs(d - r) <= et) {
    fitDrag = { type: 'resize', startCx: cx, startCy: cy };
  } else if (r > 0 && d < r - et) {
    fitDrag = { type: 'move', startMx: p.x, startMy: p.y, startCx: cx, startCy: cy };
  } else {
    fitSetCenter(p.x, p.y); fitSetRadius(2);
    fitDrag = { type: 'draw', startCx: p.x, startCy: p.y };
  }
  draw();
  return true;
}

function fitOnMove(clientX, clientY) {
  if (!fitDrag) return;
  var p = fitCanvasPt(clientX, clientY);
  if (fitDrag.type === 'move') {
    fitSetCenter(fitDrag.startCx + (p.x - fitDrag.startMx),
                 fitDrag.startCy + (p.y - fitDrag.startMy));
  } else {
    fitSetRadius(Math.max(2, Math.hypot(p.x - fitDrag.startCx, p.y - fitDrag.startCy)));
  }
  draw();
}

canvas.addEventListener('mousedown', function(ev) {
  if (ev.button !== 0) return;
  if (fitOnDown(ev.clientX, ev.clientY)) ev.preventDefault();
});
canvas.addEventListener('mousemove', function(ev) {
  if (!imgLoaded) return;
  fitOnMove(ev.clientX, ev.clientY);
  // cursor feedback
  var p  = fitCanvasPt(ev.clientX, ev.clientY);
  var cx = fitActiveCx(), cy = fitActiveCy(), r = fitActiveR();
  var et = EDGE_TOL;
  var d  = Math.hypot(p.x - cx, p.y - cy);
  canvas.style.cursor = fitDrag ? '' :
    (r > 0 && Math.abs(d - r) <= et) ? 'ew-resize' :
    (r > 0 && d < r - et)            ? 'move'       : 'crosshair';
});
canvas.addEventListener('mouseup',    function() { fitDrag = null; });
canvas.addEventListener('mouseleave', function() { fitDrag = null; });

var pinchStart    = null;  // two-finger pinch state
var fitDragPending = null;  // {clientX0, clientY0, canvasX, canvasY, committed}
var FIT_COMMIT_PX = 8;      // pixels of movement before locking into drag mode

// Touch model:
//   1 finger  — tap: snap center on touchend | drag: follow after FIT_COMMIT_PX threshold
//   2 fingers — pinch to resize + track midpoint; claims gesture immediately
//
// Scroll safety: single-finger touchstart does NOT call preventDefault.
// We only claim the gesture (and call preventDefault) in touchmove once the
// finger has moved enough AND is not moving primarily vertically (which would
// indicate a page scroll intent).  iOS fires touchcancel when it claims a
// scroll — we clean up without snapping.

canvas.addEventListener('touchstart', function(ev) {
  if (!imgLoaded) return;
  if (ev.touches.length === 2) {
    // Two-finger pinch — claim immediately so pinch never scrolls
    ev.preventDefault();
    fitDragPending = null; fitDrag = null;
    var dx2 = ev.touches[1].clientX - ev.touches[0].clientX;
    var dy2 = ev.touches[1].clientY - ev.touches[0].clientY;
    var mx  = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
    var my  = (ev.touches[0].clientY + ev.touches[1].clientY) / 2;
    var mid = fitCanvasPt(mx, my);
    fitSetCenter(mid.x, mid.y);
    pinchStart = { dist: Math.hypot(dx2, dy2), r: fitActiveR() };
    draw();
  } else if (ev.touches.length === 1) {
    // Single finger — record start position but do NOT move circle yet.
    // We wait for touchmove threshold to confirm this isn't a scroll.
    pinchStart = null; fitDrag = null;
    var p = fitCanvasPt(ev.touches[0].clientX, ev.touches[0].clientY);
    fitDragPending = {
      clientX0: ev.touches[0].clientX, clientY0: ev.touches[0].clientY,
      canvasX: p.x, canvasY: p.y, committed: false
    };
  }
}, {passive: false});

canvas.addEventListener('touchmove', function(ev) {
  if (!imgLoaded) return;
  if (ev.touches.length === 2 && pinchStart) {
    ev.preventDefault();
    var dx2 = ev.touches[1].clientX - ev.touches[0].clientX;
    var dy2 = ev.touches[1].clientY - ev.touches[0].clientY;
    var mx  = (ev.touches[0].clientX + ev.touches[1].clientX) / 2;
    var my  = (ev.touches[0].clientY + ev.touches[1].clientY) / 2;
    var mid = fitCanvasPt(mx, my);
    fitSetCenter(mid.x, mid.y);
    fitSetRadius(pinchStart.r * (Math.hypot(dx2, dy2) / pinchStart.dist));
    draw();
  } else if (ev.touches.length === 1 && fitDragPending) {
    var mdx = ev.touches[0].clientX - fitDragPending.clientX0;
    var mdy = ev.touches[0].clientY - fitDragPending.clientY0;
    var dist = Math.sqrt(mdx * mdx + mdy * mdy);
    if (!fitDragPending.committed) {
      if (dist < FIT_COMMIT_PX) return;             // not enough movement yet
      // Primarily vertical movement → likely a page scroll; bail out cleanly
      if (Math.abs(mdy) > Math.abs(mdx) * 1.8) { fitDragPending = null; return; }
      // Commit to canvas drag
      fitDragPending.committed = true;
      fitDrag = { type: 'move' };
    }
    ev.preventDefault();  // prevent scroll now that we've confirmed a canvas drag
    var p = fitCanvasPt(ev.touches[0].clientX, ev.touches[0].clientY);
    fitSetCenter(p.x, p.y);
    draw();
  }
}, {passive: false});

canvas.addEventListener('touchend', function(ev) {
  if (ev.touches.length < 2) pinchStart = null;
  if (ev.touches.length === 0) {
    // Quick tap (never committed to drag) → snap center to tap position
    if (fitDragPending && !fitDragPending.committed) {
      fitSetCenter(fitDragPending.canvasX, fitDragPending.canvasY);
      draw();
    }
    fitDrag = null; fitDragPending = null;
  }
});

// iOS fires touchcancel when it claims a scroll gesture — discard without snapping
canvas.addEventListener('touchcancel', function() {
  pinchStart = null; fitDrag = null; fitDragPending = null;
});

$('r-thresh').addEventListener('input', function(e){ donut.threshHi = +e.target.value; });
$('btn-reset').addEventListener('click', function(){ if (preZoomState) { imgEl = preZoomState.imgEl; cropRegion = preZoomState.cropRegion; preZoomState = null; } layoutStage(); var st=$('autofit-status'); if (st) st.textContent=' '; });
$('btn-autofit').addEventListener('click', function(){ applyAutoFit(); });
$('btn-fit-back').addEventListener('click', function(){
  $('card-fit').style.display = 'none';
  showLocate();
});

window.addEventListener('resize', function(){
  if (!imgLoaded) return;
  // Preserve the user's (or auto-fit's) circle positions across the resize —
  // iOS fires 'resize' whenever the browser chrome shows/hides (scroll, keyboard,
  // safe-area change). layoutStage() resets donut to defaults, so we save and
  // restore to prevent the circles from jumping after Analyze Iris or manual adjust.
  var saved = { cx: donut.cx, cy: donut.cy, rIris: donut.rIris, rPupil: donut.rPupil,
                cxPupil: donut.cxPupil, cyPupil: donut.cyPupil };
  layoutStage();
  donut.cx = saved.cx; donut.cy = saved.cy;
  donut.rIris = saved.rIris; donut.rPupil = saved.rPupil;
  donut.cxPupil = saved.cxPupil; donut.cyPupil = saved.cyPupil;
  draw();
});

$('btn-analyze').addEventListener('click', function(){
  if (captureMode === 'portrait') {
    savePortraitForCurrentResult();
  } else {
    // Save the ring placement before running analysis so it persists for next load
    if (_loadedFile) {
      var _coords = _donutToImgCoords();
      if (_coords) {
        _ringStore.set(_loadedFile, _coords);
        console.log('[RING-STORE] saved:', _loadedFile.name);
      }
    }
    donut.analyzed = true;
    draw();          // redraw immediately with thin rings before analysis runs
    analyze();
  }
});

// Portrait mode: snapshot the current image + iris fit and attach it to the
// existing analysis result. Bypasses analyze() entirely — we already have
// the analysis data; this is just a prettier visual for the share card.
function savePortraitForCurrentResult(){
  var side = currentSide || (eyeResults['Right'] ? 'Right' : 'Left');
  var existing = eyeResults[side];
  if (!existing) {
    showError('Analyze your eye first, then come back to add a beauty shot.');
    return;
  }
  existing.portraitImage = {
    src: imgEl ? (imgEl.src || (imgEl.toDataURL && imgEl.toDataURL())) : null,
    naturalW: imgEl ? imgEl.naturalWidth : 0,
    naturalH: imgEl ? imgEl.naturalHeight : 0,
    iris: {
      cx: donut.cx, cy: donut.cy,
      rPupil: donut.rPupil, rIris: donut.rIris,
      drawInfo: { dx: drawInfo.dx, dy: drawInfo.dy,
                  dw: drawInfo.dw, dh: drawInfo.dh }
    }
  };
  // Reset mode and return to result card
  captureMode = 'analysis';
  $('btn-analyze').textContent = 'Analyze Iris';
  $('card-fit').style.display = 'none';
  $('card-locate').style.display = 'none';
  $('card-result').style.display = 'block';
  // Re-render in case the result UI shows a portrait indicator
  renderResult(existing);
  window.__lastResult = existing;
  setTimeout(function(){ $('card-result').scrollIntoView({behavior:'smooth', block:'start'}); }, 60);
}

// Wire the Share button + modal
$('btn-share').addEventListener('click', function(){
  if (!window.__lastResult) return;
  generateShareCard(window.__lastResult).then(function(out){
    var url = URL.createObjectURL(out.blob);
    $('share-preview').src = url;
    $('share-modal').classList.add('show');
    $('share-download').onclick = function(){
      // iOS Safari: toDataURL works reliably; blob URL download is blocked
      try {
        var dataUrl = out.canvas.toDataURL('image/png');
        var a = document.createElement('a');
        a.href = dataUrl;
        var name = (window.__lastResult.side || 'eye').toLowerCase() + '-eyed-card.png';
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch(e) {
        // Last resort: open in new tab so user can long-press save
        var w = window.open();
        if (w) {
          var dataUrl2 = out.canvas.toDataURL('image/png');
          w.document.write('<img src="' + dataUrl2 + '" style="max-width:100%;display:block">');
          w.document.write('<p style="font-family:sans-serif;padding:12px;color:#666">Long-press the image and choose Save to Photos</p>');
        }
      }
    };
  });
});
$('share-close').addEventListener('click', function(){
  $('share-modal').classList.remove('show');
});

// Quality advisory buttons
$('btn-qa-retake').addEventListener('click', function(){
  $('quality-advisory').style.display = 'none';
  $('card-result').style.display = 'none';
  $('card-fit').style.display = 'none';
  $('card-locate').style.display = 'none';
  $('card-capture').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('btn-qa-dismiss').addEventListener('click', function(){
  $('quality-advisory').style.display = 'none';
});

// View toggle wiring (Card vs Story)
(function(){
  var btnCard = $('view-card'), btnStory = $('view-story');
  var cardC = $('view-card-content'), storyC = $('view-story-content');
  function show(view){
    var isCard = view === 'card';
    btnCard.classList.toggle('active', isCard);
    btnStory.classList.toggle('active', !isCard);
    cardC.style.display = isCard ? 'block' : 'none';
    storyC.style.display = isCard ? 'none' : 'block';
  }
  if (btnCard && btnStory) {
    btnCard.addEventListener('click', function(){ show('card'); });
    btnStory.addEventListener('click', function(){ show('story'); });
  }
})();

$('btn-switch-eye').addEventListener('click', function(){
  if (!mpEyes) return;
  var other = currentSide === 'Right' ? 'Left' : 'Right';
  jumpToEye(other);
});

$('btn-other-eye').addEventListener('click', function(){
  $('card-fit').style.display = 'none';
  var other = currentSide === 'Right' ? 'Left' : 'Right';
  if (mpEyes) { jumpToEye(other); } else { showLocate(); }
});

// Both Eyes Card — jump to Post Maker with both-eyes template pre-selected
$('btn-both-eyes-card').addEventListener('click', function(){
  // Set the Post Maker template to both-eyes
  pmActiveTemplate = 'both-eyes';
  // Switch to the Post tab (mirrors the tab-btn click logic)
  var allTabs = document.querySelectorAll('.tab-btn');
  for (var i = 0; i < allTabs.length; i++) allTabs[i].classList.remove('active');
  var postBtn = document.querySelector('.tab-btn[data-tab="post"]');
  if (postBtn) postBtn.classList.add('active');
  ['capture','post','about'].forEach(function(n){
    var el = $('tab-' + n);
    if (el) el.classList.toggle('hidden', n !== 'post');
  });
  drawPostStage();
  var postTab = $('tab-post');
  if (postTab) setTimeout(function(){ postTab.scrollIntoView({behavior:'smooth', block:'start'}); }, 60);
});

// Beauty-shot button — start a portrait capture for the existing result
$('btn-portrait').addEventListener('click', function(){
  captureMode = 'portrait';
  $('btn-analyze').textContent = 'Save Beauty Shot';
  // Keep eyeResults intact, reset working image so user can upload a new one
  originalImgEl = null; imgEl = null; imgLoaded = false; isCloseupMode = false;
  $('card-result').style.display = 'none';
  $('card-fit').style.display = 'none';
  $('card-locate').style.display = 'none';
  // Click the upload button to immediately reopen file picker — feels native
  // (saves a tap vs. scrolling back up to the upload card)
  $('card-capture').scrollIntoView({behavior: 'smooth', block: 'start'});
  setTimeout(function(){ $('btn-upload').click(); }, 200);
});

// Quality-gate retake — soft reset: return to capture card without clearing existing eye results
$('btn-quality-retake').addEventListener('click', function(){
  originalImgEl = null; imgEl = null; imgLoaded = false; isCloseupMode = false;
  preZoomState  = null;
  $('btn-quality-retake').style.display = 'none';
  $('card-fit').style.display    = 'none';
  $('card-locate').style.display = 'none';
  $('card-capture').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

$('btn-again').addEventListener('click', function(){
  eyeResults = {};
  currentSide = null;
  captureMode = 'analysis';
  mpEyes = null; isCloseupMode = false; window.currentEyeShape = null;
  $('btn-analyze').textContent = 'Analyze Iris';
  originalImgEl = null; imgEl = null; imgLoaded = false;
  _sessionId = null; _sessionFaceUploaded = false;
  $('card-result').style.display = 'none';
  $('card-fit').style.display = 'none';
  $('card-locate').style.display = 'none';
  window.scrollTo({top: 0, behavior: 'smooth'});
});

// Post export — save canvas directly (all text/graphics are baked in)
$('btn-export-post').addEventListener('click', function(){
  var c = $('post-canvas');
  if (!c) return;
  try {
    var a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = 'eyeD-iris-post.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  } catch (e) {
    var w = window.open();
    if (w) w.document.write('<img src="' + c.toDataURL('image/png') + '" style="max-width:100%;background:#000">');
    else showError('Save blocked — long-press the card image to save to your photos.');
  }
});

// Copy to clipboard (Web Share API on mobile, clipboard image on desktop)
$('btn-copy-post').addEventListener('click', function(){
  var c = $('post-canvas');
  if (!c) return;
  if (navigator.share && c.toBlob) {
    c.toBlob(function(blob){
      var file = new File([blob], 'eyeD-post.png', { type: 'image/png' });
      navigator.share({ files: [file], title: 'My Eye Color', text: 'What color are YOUR eyes? #eyeD' })
        .catch(function(){});
    }, 'image/png');
  } else if (navigator.clipboard && navigator.clipboard.write && c.toBlob) {
    c.toBlob(function(blob){
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        .then(function(){ showSaveToast('Copied to clipboard!', true); })
        .catch(function(){ showSaveToast('Copy failed — use Save Image instead.', false); });
    }, 'image/png');
  } else {
    showSaveToast('Use Save Image on this device.', false);
  }
});

// ======================= SUPABASE =======================
var SUPABASE_URL = 'https://mmotthgsydxgviabnycv.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tb3R0aGdzeWR4Z3ZpYWJueWN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTM2MjcsImV4cCI6MjA5MzU4OTYyN30.hUgH6_0eJ-s4FbtSD3_EuyH-5sYLWIUQK4fdDAP0yMU';
var _sessionId = null;           // shared ID across all photos in one session
var _sessionFaceUploaded = false; // only upload face photo once per session

// ---- Persistent device ID ----
// Generated once on first visit and stored in localStorage so all sessions
// from the same browser/device share a common identifier in Supabase.
// Also captures user-agent and screen dimensions once for device fingerprinting.
function _getOrCreateDeviceId() {
  try {
    var key = 'eyeid_device_id';
    var id = localStorage.getItem(key);
    if (!id) {
      // crypto.randomUUID is available on all modern iOS/Android browsers
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });
      localStorage.setItem(key, id);
    }
    return id;
  } catch(e) { return null; }  // private browsing blocks localStorage — degrade gracefully
}
var _deviceId = _getOrCreateDeviceId();

function showSaveToast(msg, success) {
  var t = document.getElementById('save-toast');
  if (!t) return;
  t.textContent = msg;
  t.style.borderColor = success ? '#4caf50' : '#ff5577';
  t.style.color = success ? '#4caf50' : '#ff5577';
  t.style.opacity = '1';
  setTimeout(function() { t.style.opacity = '0'; }, 3000);
}

function uploadToSupabase(result) {
  try {
    showSaveToast('Saving…', true);
    function safeNum(v) { var n = parseFloat(v); return isFinite(n) ? n : null; }
    function safeInt(v) { var n = parseInt(v, 10); return isFinite(n) ? n : null; }
    if (!_sessionId) _sessionId = String(Date.now());
    var side = (result.side || 'right').toLowerCase();
    var irisFileName = _sessionId + '-iris-' + side + '.jpg';
    var faceFileName = _sessionId + '-face.jpg';
    var irisPos = result.analysisImage && result.analysisImage.iris
      ? JSON.stringify(result.analysisImage.iris) : null;
    var record = {
      created_at: new Date().toISOString(),
      eye_side: result.side || null,
      color_name: result.overall ? result.overall.name : null,
      color_category: result.overall ? result.overall.cat : null,
      heterochromia: result.hetero || null,
      limbal_ring: result.limbal || null,
      brightness: safeNum(result.brightness),
      saturation: safeNum(result.saturation),
      rarity_score: safeNum(result.rarityScore),
      vibe: result.vibe || null,
      hex_color: result.fingerprint ? result.fingerprint.hex : null,
      sectoral_color: result.sectoral ? result.sectoral.color : null,
      freckle_count: safeInt(result.freckles ? result.freckles.length : 0),
      rayid_type: result.rayid ? result.rayid.label : null,
      iris_position: irisPos,
      photo_path: irisFileName,
      face_photo_path: faceFileName,
      // ── Source tracking ──────────────────────────────────────────────────────
      device_id:     _deviceId || null,
      user_agent:    navigator.userAgent || null,
      screen_width:  window.screen ? window.screen.width  : null,
      screen_height: window.screen ? window.screen.height : null
    };
    fetch(SUPABASE_URL + '/rest/v1/analyses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(record)
    }).then(function(res) {
      if (!res.ok) {
        return res.text().then(function(body) {
          showSaveToast(res.status + ': ' + body.slice(0, 80), false);
        });
      }
      showSaveToast('Saved ✓', true);
      function uploadFile(fileName, src) {
        return fetch(src)
          .then(function(r) { return r.blob(); })
          .then(function(blob) {
            return fetch(SUPABASE_URL + '/storage/v1/object/iris-photos/' + fileName, {
              method: 'POST',
              headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': 'Bearer ' + SUPABASE_KEY,
                'Content-Type': 'image/jpeg'
              },
              body: blob
            });
          });
      }
      // Parse response to get the generated row ID, then save a local thumbnail
      // so the gallery can show iris photos without needing public bucket access.
      res.json().then(function(rows) {
        var id = rows && rows[0] && rows[0].id;
        var irisSrc = result.analysisImage && result.analysisImage.src;
        if (id && irisSrc) {
          var img = new Image();
          img.onload = function() {
            try {
              var size = 80, off = document.createElement('canvas');
              off.width = off.height = size;
              var c = off.getContext('2d');
              c.beginPath(); c.arc(size/2, size/2, size/2, 0, Math.PI*2); c.clip();
              c.drawImage(img, 0, 0, size, size);
              localStorage.setItem('aeyed_thumb_' + id, off.toDataURL('image/jpeg', 0.7));
            } catch(e) {}
          };
          img.src = irisSrc;
        }
        // Upload iris crop for this eye
        if (irisSrc) {
          uploadFile(irisFileName, irisSrc)
            .then(function(r){ console.log('[PHOTO] iris upload', r.status, irisFileName); })
            .catch(function(e){ console.warn('[PHOTO] iris upload failed', e); });
        }
        // Upload full-face photo once per session
        if (!_sessionFaceUploaded && originalImgEl && originalImgEl.src) {
          _sessionFaceUploaded = true;
          uploadFile(faceFileName, originalImgEl.src)
            .then(function(r){ console.log('[PHOTO] face upload', r.status, faceFileName); })
            .catch(function(e){ console.warn('[PHOTO] face upload failed', e); });
        }
      }).catch(function() {});
    }).catch(function(e) {
      showSaveToast('Save failed: ' + String(e).slice(0, 60), false);
    });
  } catch(e) {
    showSaveToast('Save error', false);
  }
}

// Everything attached — flip banner to green
markRunning();
