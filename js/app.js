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
      ['capture','post','about'].forEach(function(n){
        var el = $('tab-'+n);
        if (el) el.classList.toggle('hidden', n !== t);
      });
      if (t === 'post') drawPostStage();
    });
  })(tabs[i]);
}

// ======================= FILE LOADING =======================
var fileInput = $('file-input');

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
  var reader = new FileReader();
  reader.onload = function(){ loadOriginalFromUrl(reader.result); };
  reader.onerror = function(){ showError('Could not read file.'); };
  reader.readAsDataURL(f);
});

// Synthetic "face" with two tinted irises so the locate flow can be demoed without a camera
function drawSyntheticFace(){
  var c = document.createElement('canvas'); c.width = 900; c.height = 600;
  var ctx = c.getContext('2d');
  // background
  var bg = ctx.createLinearGradient(0,0,0,600);
  bg.addColorStop(0,'#d6c0a8'); bg.addColorStop(1,'#b89a7c');
  ctx.fillStyle = bg; ctx.fillRect(0,0,900,600);
  // face silhouette
  ctx.fillStyle = '#e8cdb3';
  ctx.beginPath(); ctx.ellipse(450, 320, 270, 310, 0, 0, Math.PI*2); ctx.fill();
  // eyes: left (person's right in image = viewer's left) and right
  drawSynthEye(ctx, 355, 290, true);
  drawSynthEye(ctx, 545, 290, false);
  // nose
  ctx.strokeStyle = '#b58f70'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(450,310); ctx.quadraticCurveTo(440,380,450,420); ctx.stroke();
  // mouth
  ctx.strokeStyle = '#8a4e3a'; ctx.lineWidth = 5; ctx.beginPath();
  ctx.moveTo(400,470); ctx.quadraticCurveTo(450,495,500,470); ctx.stroke();
  loadOriginalFromUrl(c.toDataURL());
}
function drawSynthEye(ctx, cx, cy, hetero){
  // sclera
  ctx.fillStyle = '#fafafa';
  ctx.beginPath(); ctx.ellipse(cx, cy, 60, 32, 0, 0, Math.PI*2); ctx.fill();
  // iris gradient (blue for both; add pupillary amber on the "hetero" side)
  var grad = ctx.createRadialGradient(cx,cy,6, cx,cy,30);
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
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx,cy,30,0,Math.PI*2); ctx.fill();
  // texture
  for (var k=0;k<160;k++){
    var a = Math.random()*Math.PI*2;
    var r1 = 8 + Math.random()*18, r2 = r1+2+Math.random()*3;
    ctx.strokeStyle = 'rgba(255,255,255,'+(0.04+Math.random()*0.08)+')';
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*r1, cy+Math.sin(a)*r1);
    ctx.lineTo(cx+Math.cos(a)*r2, cy+Math.sin(a)*r2);
    ctx.stroke();
  }
  // pupil
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx,cy,7,0,Math.PI*2); ctx.fill();
  // catch-light
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath(); ctx.arc(cx-4, cy-4, 2.5, 0, Math.PI*2); ctx.fill();
  // lashes / lid hints
  ctx.strokeStyle = '#3a2717'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx-62, cy-4); ctx.quadraticCurveTo(cx, cy-38, cx+62, cy-4); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx-60, cy+4); ctx.quadraticCurveTo(cx, cy+32, cx+60, cy+4); ctx.stroke();
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
    mpEyes = null;
    preZoomState = null;  // clear any leftover zoom state from previous image

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

      // ── Sanity-check iris landmark positions ────────────────────────────────
      // MediaPipe can misplace iris landmarks on angled/unusual photos.
      // Guard 1: Neither iris should be in the lower 40 % of the image
      //          (that's cheek/mouth territory for any normal face photo).
      // Guard 2: The two irises must be horizontally separated by at least
      //          6 % of image width — if they coincide something is very wrong.
      var ry = L[rightCI].y, ly = L[leftCI].y;
      var ipdFrac = Math.abs(L[468].x - L[473].x);
      var badPlacement = (ry > 0.60 || ly > 0.60);
      var badIPD       = (ipdFrac < 0.06);
      if (badPlacement || badIPD) {
        console.warn('MP iris landmark sanity fail — ry=' + ry.toFixed(3) +
                     ' ly=' + ly.toFixed(3) + ' ipdFrac=' + ipdFrac.toFixed(3) +
                     ' — falling back to manual locate');
        $('card-fit').style.display = 'none';
        showLocate();
        return;
      }

      mpEyes = {
        Right: { ci: rightCI, cx: L[rightCI].x * imgW, cy: L[rightCI].y * imgH },
        Left:  { ci: leftCI,  cx: L[leftCI].x  * imgW, cy: L[leftCI].y  * imgH }
      };
      var startSide = eyeResults['Right'] ? 'Left' : 'Right';
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
  var longer = Math.max(imgW, imgH);
  var cropR = longer * (cropPct / 100) / 2;
  var cx0 = Math.max(0, Math.round(eye.cx - cropR));
  var cy0 = Math.max(0, Math.round(eye.cy - cropR));
  var cx1 = Math.min(imgW, Math.round(eye.cx + cropR));
  var cy1 = Math.min(imgH, Math.round(eye.cy + cropR));
  var cw = cx1 - cx0, ch = cy1 - cy0;
  if (cw < 40 || ch < 40) { showLocate(); return; }

  currentSide = side;
  cropRegion  = { x: cx0, y: cy0, w: cw, h: ch };

  var off = document.createElement('canvas');
  off.width = cw; off.height = ch;
  off.getContext('2d').drawImage(originalImgEl, cx0, cy0, cw, ch, 0, 0, cw, ch);
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
  var octx = off.getContext('2d');
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
      if (rip1 && rip1.confidence >= 0.35 && rip1.irisR > ir * 0.4 && rip1.irisR < ir * 3.5) {
        cxIris_img = cx_img;
        cyIris_img = cy_img;
        irisR_img  = rip1.irisR;
        radSrc = 'RIP' + Math.round(rip1.confidence * 10);
      } else {
        // Secondary: horizontal gradient scan
        var odh = findIrisODHorizontal(imgEl, cxPupil_img, cyPupil_img, pupilR_pre);
        if (odh && odh.irisR > ir * 0.4 && odh.irisR < ir * 3.5) {
          cxIris_img = cx_img;
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
        zoomToEye();
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

function _applyFitClassical(closeup){
  if (!imgEl) return false;
  var hint = $('autofit-hint');
  var st   = $('autofit-status');
  try {
    var fit = autoFit(imgEl, !!closeup);
    var scaleX = drawInfo.dw / imgEl.width;
    var scaleY = drawInfo.dh / imgEl.height;

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
    if (closeup && fit.ok && cuIrisR > 8) {
      // Primary: Radial Intensity Profile (full-circle mean, confidence-scored)
      var cuRip = findIrisODByRIP(imgEl, cxPupil_cu, cyPupil_cu, cuIrisR);
      if (cuRip && cuRip.confidence >= 0.35 &&
          cuRip.irisR > cuIrisR * 0.50 && cuRip.irisR < cuIrisR * 1.60) {
        cuIrisR = cuRip.irisR;
        cuRadSrc = 'RIP' + Math.round(cuRip.confidence * 10);
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

    donut.cx     = drawInfo.dx + cuIrisCx   * scaleX;
    donut.cy     = drawInfo.dy + cuIrisCy   * scaleY;
    donut.cxPupil = drawInfo.dx + cxPupil_cu * scaleX;
    donut.cyPupil = drawInfo.dy + cyPupil_cu * scaleY;
    var rpx  = fit.rPupilFrac * imgEl.width * scaleX;
    var ripx = cuIrisR * scaleX;
    ripx = Math.max(rpx*1.3, Math.min(ripx, Math.min(stageW,stageH)*0.48));
    rpx  = Math.max(6, Math.min(rpx, ripx*0.45));
    donut.rIris  = ripx;
    donut.rPupil = rpx;
    draw();
    if (validateIrisFit()) {
      if (hint) { hint.textContent = 'Auto-fit complete. Drag to adjust, then tap "Analyze Iris".'; hint.style.color = ''; }
      if (st)   st.textContent = (closeup ? 'Close-up ' + cuRadSrc : 'Classical') + ': ' + (fit.ok ? 'snapped' : 'estimated');
      zoomToEye();
    } else {
      // Both MP and classical failed — center a default circle so manual adjustment starts from the middle
      donut.cx = stageW / 2; donut.cy = stageH / 2;
      donut.cxPupil = stageW / 2; donut.cyPupil = stageH / 2;
      donut.rIris  = Math.round(Math.min(stageW, stageH) * 0.28);
      donut.rPupil = Math.round(donut.rIris * 0.22);
      draw();
      if (hint) { hint.textContent = 'Iris not detected — a clearer photo will give better results. Retake or drag the circle manually.'; hint.style.color = '#fa0'; }
      if (st)   st.textContent = 'low confidence';
      var rb = $('btn-quality-retake');
      if (rb) rb.style.display = '';
    }
    return fit.ok;
  } catch(e) {
    if (st) st.textContent = 'Auto-fit error: ' + (e.message || e);
    return false;
  }
}

// Close-up iris model: used when no face is detected.
// Runs autoFit with center-bias disabled directly on the original image,
// then proceeds to the fit stage without requiring a manual locate tap.
function _tryCloseupFit() {
  if (!originalImgEl) { showLocate(); return; }
  try {
    var probe = autoFit(originalImgEl, true);
    // Require a real iris: limbus must be detected and span at least 8% of image width.
    if (!probe.ok || probe.rIrisFrac < 0.08) { showLocate(); return; }
  } catch(e) { showLocate(); return; }

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
  off.getContext('2d').drawImage(imgEl, 0, 0, W, H);
  var d = off.getContext('2d').getImageData(0, 0, W, H).data;
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
function zoomToEye() {
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

  // Pad 1.5× irisR in each direction — tight crop showing just the eye
  var pad = Math.round(iR * 1.5);
  var x0  = Math.max(0, Math.round(iCx - pad));
  var y0  = Math.max(0, Math.round(iCy - pad));
  var x1  = Math.min(imgEl.width,  Math.round(iCx + pad));
  var y1  = Math.min(imgEl.height, Math.round(iCy + pad));
  if (x1 - x0 < 40 || y1 - y0 < 40) return;

  var cw = x1 - x0, ch = y1 - y0;
  var off = document.createElement('canvas');
  off.width = cw; off.height = ch;
  off.getContext('2d').drawImage(imgEl, x0, y0, cw, ch, 0, 0, cw, ch);

  var newImg = new Image();
  newImg.onload = function() {
    if (cropRegion) {
      cropRegion = { x: cropRegion.x + x0, y: cropRegion.y + y0, w: cw, h: ch };
    }
    imgEl = newImg;

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
      donut.cx      = drawInfo.dx + zPupil.cx * nsx;
      donut.cy      = drawInfo.dy + zPupil.cy * nsy;
      donut.cxPupil = donut.cx;
      donut.cyPupil = donut.cy;

      // Pupil radius pre-scan (needed as guard radius for secondary horizontal scan)
      var zPR0 = findPupilRadiusByRays(imgEl, zPupil.cx, zPupil.cy, iR);
      // Guard: if pupil scan hits the floor (≤5px), catch-light wiped it out.
      // Use 15% of iR so the secondary horizontal scan's maxSearchR reaches the limbus.
      if (zPR0 <= 5) zPR0 = iR * 0.15;

      // ── Iris OD cascade (three tiers) ──────────────────────────────────────────
      // Primary:   RIP full-circle mean intensity profile (confidence-scored)
      // Secondary: horizontal gradient scan (3/9 o'clock + ±20/30° rays)
      // Tertiary:  ring-contrast global search; then keep MP estimate as-is
      // ───────────────────────────────────────────────────────────────────────────
      var _zRipConf = 0, _zFellBack = false;
      var zRIP = findIrisODByRIP(imgEl, zPupil.cx, zPupil.cy, iR);
      if (zRIP && zRIP.confidence >= 0.35 && zRIP.irisR > iR * 0.4 && zRIP.irisR < iR * 1.4) {
        // Primary succeeded — hard-cap at 1.25× MP to block eyelid overshoot
        donut.rIris = Math.min(zRIP.irisR * nsx, iR * nsx * 1.25, Math.min(stageW, stageH) * 0.45);
        _zRipConf = zRIP.confidence;
      } else {
        _zFellBack = true;
        // Secondary: horizontal gradient scan
        var zODH = findIrisODHorizontal(imgEl, zPupil.cx, zPupil.cy, zPR0);
        if (zODH && zODH.irisR > iR * 0.4 && zODH.irisR < iR * 1.4) {
          donut.rIris = Math.min(zODH.irisR * nsx, iR * nsx * 1.25, Math.min(stageW, stageH) * 0.45);
          // Adopt horizontal scan's x-center refinement if it didn't drift
          if (Math.abs(zODH.cxIris - zPupil.cx) < iR * 0.4) {
            donut.cx      = drawInfo.dx + zODH.cxIris * nsx;
            donut.cxPupil = donut.cx;
          }
        } else {
          // Tertiary: ring contrast
          var zRC = findIrisByRingContrast(imgEl, zPupil.cx, zPupil.cy, iR);
          if (zRC && zRC.score > 15 && zRC.r <= iR * 1.4) {
            donut.rIris = Math.min(zRC.r * nsx, Math.min(stageW, stageH) * 0.45);
          } else {
            // Tier 3.5: saturation ring — dark irises where all luminance methods fail
            var zSAT = findIrisODBySaturation(imgEl, zPupil.cx, zPupil.cy, iR);
            if (zSAT && zSAT.confidence >= 0.25 && zSAT.irisR > iR * 0.4 && zSAT.irisR < iR * 1.5) {
              donut.rIris = Math.min(zSAT.irisR * nsx, iR * nsx * 1.25, Math.min(stageW, stageH) * 0.45);
            }
            // else: keep the MP estimate that was set before the refinement pass
          }
        }
      }
      var zPR = findPupilRadiusByRays(imgEl, zPupil.cx, zPupil.cy, donut.rIris / nsx);
      // Guard: if the pupil-ray scan returns its floor (≤5px), catch-light has wiped it out.
      // Estimate pupil as 22% of iris radius (typical human ratio) rather than showing a dot.
      if (zPR <= 5) zPR = (donut.rIris / nsx) * 0.18;
      // Cap pupil at 26% of iris radius — constricted selfie pupils rarely exceed this,
      // and dark irises inflate the scan result without this tighter ceiling.
      donut.rPupil = Math.max(6, Math.min(zPR * nsx, donut.rIris * 0.26));
    }
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
      var needsAdvisory = !placement.ok || _zFellBack || _zRipConf < 0.35;
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
        // Differentiate: total fallback (low) vs uncertain fit (medium)
        var isLowConf = _zFellBack && _zRipConf < 0.15;
        hint.textContent = isLowConf
          ? 'Low confidence — a clearer photo will give better results. Retake or drag the circle to fit manually.'
          : 'Uncertain fit — drag the ring to adjust if needed, then tap Analyze.';
        hint.style.color = '#f5a623';
        if (retakeBtn2) retakeBtn2.style.display = '';
      } else {
        hint.textContent = 'Auto-fit complete. Drag to adjust, then tap "Analyze Iris".';
        hint.style.color = '';
        if (retakeBtn2) retakeBtn2.style.display = 'none';
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
        'Prefer': 'return=minimal'
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
      // Upload iris crop for this eye
      var irisSrc = result.analysisImage && result.analysisImage.src;
      if (irisSrc) uploadFile(irisFileName, irisSrc).catch(function(){});
      // Upload full-face photo once per session
      if (!_sessionFaceUploaded && originalImgEl && originalImgEl.src) {
        _sessionFaceUploaded = true;
        uploadFile(faceFileName, originalImgEl.src).catch(function(){});
      }
    }).catch(function(e) {
      showSaveToast('Save failed: ' + String(e).slice(0, 60), false);
    });
  } catch(e) {
    showSaveToast('Save error', false);
  }
}

// Everything attached — flip banner to green
markRunning();
