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

$('btn-camera').addEventListener('click', function(){
  // Use in-app viewfinder if getUserMedia is available (requires HTTPS)
  if (cameraAvailable()) {
    cameraStart();
  } else {
    // Fallback: native camera via file input (desktop or non-HTTPS)
    fileInput.setAttribute('capture', 'user');
    fileInput.click();
  }
});
$('btn-upload').addEventListener('click', function(){
  fileInput.removeAttribute('capture');
  fileInput.click();
});
$('btn-cam-capture').addEventListener('click', function(){ cameraCaptureSequence(); });
$('btn-cam-stop').addEventListener('click', function(){ cameraStop(); });

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
var cropPct = 14;       // crop size as % of longer image side

var loadOriginalFromUrl = function(url){
  var img = new Image();
  img.onload = function(){
    originalImgEl = img;
    mpEyes = null;
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
  var eye  = mpEyes[side];
  var imgW = originalImgEl.naturalWidth  || originalImgEl.width;
  var imgH = originalImgEl.naturalHeight || originalImgEl.height;
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

      // Step 2: Find iris OD via horizontal band + near-horizontal rays (v0.54)
      var irisOD = findIrisODHorizontal(imgEl, cx_img, cy_img, ir * 0.5);
      var cxIris_img, cyIris_img, irisR_img, radSrc;
      if (irisOD && irisOD.irisR > 6) {
        cxIris_img = irisOD.cxIris;
        cyIris_img = irisOD.cyIris;
        irisR_img  = Math.min(irisOD.irisR, ir * 1.20); // cap: don't stray past MP hint
        radSrc = 'hband';
      } else {
        // Fall back to radial scan
        cxIris_img = cx_img;
        cyIris_img = cy_img;
        var irisBright = estimateIrisBrightness(imgEl, cx_img, cy_img, ir * 0.4, ir * 0.95);
        var isDarkIris = irisBright < 80;
        var maxRFactor = isDarkIris ? 1.55 : 1.22;
        var capFactor  = isDarkIris ? 1.40 : 1.12;
        var scanR = findIrisRadiusByRadialScan(imgEl, cx_img, cy_img, ir, maxRFactor);
        var rawR  = (scanR && scanR > 6) ? scanR : ir;
        irisR_img = Math.min(rawR, ir * capFactor);
        radSrc = (scanR && scanR > 6) ? 'scan' : 'MP';
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
      var rpx  = Math.max(6, Math.min(pupilR_img * scaleX, ripx * 0.32));

      donut.rIris  = ripx;
      donut.rPupil = rpx;
      if (hint) hint.textContent = 'Auto-fit complete. Drag to adjust, then tap "Analyze Iris".';
      if (st)   st.textContent   = 'MP+' + radSrc + ' ri=' + Math.round(ripx) + ' rp=' + Math.round(rpx) + ' cxI=' + Math.round(cxIris_img) + ' cxP=' + Math.round(cxPupil_img);
      draw();
      zoomToEye();
    } catch(e) {
      console.warn('MediaPipe detect error:', e);
      if (hint) hint.textContent = 'Detection error — using fallback';
      _applyFitClassical(isCloseupMode);
    }
  });
}

function _applyFitClassical(closeup){
  if (!imgEl) return false;
  var hint = $('autofit-hint');
  var st   = $('autofit-status');
  try {
    var fit = autoFit(imgEl, !!closeup);
    var scaleX = drawInfo.dw / imgEl.width;
    var scaleY = drawInfo.dh / imgEl.height;
    donut.cx     = drawInfo.dx + fit.cxFrac * imgEl.width * scaleX;
    donut.cy     = drawInfo.dy + fit.cyFrac * imgEl.height * scaleY;
    donut.cxPupil = fit.cxPupilFrac != null
      ? drawInfo.dx + fit.cxPupilFrac * imgEl.width  * scaleX
      : donut.cx;
    donut.cyPupil = fit.cyPupilFrac != null
      ? drawInfo.dy + fit.cyPupilFrac * imgEl.height * scaleY
      : donut.cy;
    var rpx  = fit.rPupilFrac * imgEl.width * scaleX;
    var ripx = fit.rIrisFrac  * imgEl.width * scaleX;
    ripx = Math.max(rpx*1.3, Math.min(ripx, Math.min(stageW,stageH)*0.48));
    rpx  = Math.max(6, Math.min(rpx, ripx*0.45));
    donut.rIris  = ripx;
    donut.rPupil = rpx;
    if (hint) hint.textContent = 'Auto-fit complete. Drag to adjust, then tap "Analyze Iris".';
    if (st)   st.textContent   = (closeup ? 'Close-up' : 'Classical') + ' CV: ' + (fit.ok ? 'snapped' : 'estimated');
    draw();
    zoomToEye();
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
  draw();
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

  // Pad 2.2× irisR in each direction — captures eye corners
  var pad = Math.round(iR * 2.2);
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
    donut.cx      = drawInfo.dx + niCx  * nsx;
    donut.cy      = drawInfo.dy + niCy  * nsy;
    donut.cxPupil = drawInfo.dx + niPCx * nsx;
    donut.cyPupil = drawInfo.dy + niPCy * nsy;
    donut.rIris   = iR  * nsx;
    donut.rPupil  = iPR * nsx;
    draw();
  };
  newImg.src = off.toDataURL();
}

function draw(){
  if (!imgEl) return;
  var cxP = donut.cxPupil != null ? donut.cxPupil : donut.cx;
  var cyP = donut.cyPupil != null ? donut.cyPupil : donut.cy;

  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, stageW, stageH);
  ctx.drawImage(imgEl, drawInfo.dx, drawInfo.dy, drawInfo.dw, drawInfo.dh);

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
  var sx = canvas.width  / rect.width;
  var sy = canvas.height / rect.height;
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
  var et  = EDGE_TOL * (canvas.width / canvas.getBoundingClientRect().width);
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
  var et = EDGE_TOL * (canvas.width / canvas.getBoundingClientRect().width);
  var d  = Math.hypot(p.x - cx, p.y - cy);
  canvas.style.cursor = fitDrag ? '' :
    (r > 0 && Math.abs(d - r) <= et) ? 'ew-resize' :
    (r > 0 && d < r - et)            ? 'move'       : 'crosshair';
});
canvas.addEventListener('mouseup',    function() { fitDrag = null; });
canvas.addEventListener('mouseleave', function() { fitDrag = null; });

var pinchStart = null;  // {dist, r} — two-finger pinch to resize

canvas.addEventListener('touchstart', function(ev) {
  if (!imgLoaded) return;
  ev.preventDefault();
  if (ev.touches.length === 2) {
    fitDrag = null;
    var dx = ev.touches[1].clientX - ev.touches[0].clientX;
    var dy = ev.touches[1].clientY - ev.touches[0].clientY;
    pinchStart = { dist: Math.hypot(dx, dy), r: fitActiveR() };
  } else if (ev.touches.length === 1) {
    pinchStart = null;
    fitOnDown(ev.touches[0].clientX, ev.touches[0].clientY);
  }
}, {passive: false});
canvas.addEventListener('touchmove', function(ev) {
  if (!imgLoaded) return;
  ev.preventDefault();
  if (ev.touches.length === 2 && pinchStart) {
    var dx = ev.touches[1].clientX - ev.touches[0].clientX;
    var dy = ev.touches[1].clientY - ev.touches[0].clientY;
    fitSetRadius(pinchStart.r * (Math.hypot(dx, dy) / pinchStart.dist));
    draw();
  } else if (ev.touches.length === 1 && !pinchStart) {
    fitOnMove(ev.touches[0].clientX, ev.touches[0].clientY);
  }
}, {passive: false});
canvas.addEventListener('touchend', function(ev) {
  if (ev.touches.length < 2) pinchStart = null;
  if (ev.touches.length === 0) fitDrag = null;
});

$('r-thresh').addEventListener('input', function(e){ donut.threshHi = +e.target.value; });
$('btn-reset').addEventListener('click', function(){ if (preZoomState) { imgEl = preZoomState.imgEl; cropRegion = preZoomState.cropRegion; preZoomState = null; } layoutStage(); var st=$('autofit-status'); if (st) st.textContent=' '; });
$('btn-autofit').addEventListener('click', function(){ applyAutoFit(); });
$('btn-fit-back').addEventListener('click', function(){
  $('card-fit').style.display = 'none';
  showLocate();
});

window.addEventListener('resize', function(){ if (imgLoaded) layoutStage(); });

$('btn-analyze').addEventListener('click', function(){
  if (captureMode === 'portrait') {
    savePortraitForCurrentResult();
  } else {
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

$('btn-again').addEventListener('click', function(){
  eyeResults = {};
  currentSide = null;
  captureMode = 'analysis';
  mpEyes = null; isCloseupMode = false;
  $('btn-analyze').textContent = 'Analyze Iris';
  originalImgEl = null; imgEl = null; imgLoaded = false;
  _sessionId = null; _sessionFaceUploaded = false;
  $('card-result').style.display = 'none';
  $('card-fit').style.display = 'none';
  $('card-locate').style.display = 'none';
  window.scrollTo({top: 0, behavior: 'smooth'});
});

$('btn-toggle-reveal').addEventListener('click', function(){ revealed = !revealed; drawPostStage(); });
$('btn-export-post').addEventListener('click', function(){
  var c = $('post-canvas');
  var out = document.createElement('canvas'); out.width = c.width; out.height = c.height;
  var octx = out.getContext('2d');
  octx.drawImage(c, 0, 0);
  octx.fillStyle = 'rgba(0,0,0,0.4)';
  octx.fillRect(0, c.height*0.4, c.width, c.height*0.2);
  octx.fillStyle = '#fff'; octx.textAlign = 'center';
  octx.font = '800 44px -apple-system, system-ui, sans-serif';
  octx.fillText($('post-text').textContent, c.width/2, c.height*0.52);
  try {
    var a = document.createElement('a');
    a.href = out.toDataURL('image/png');
    a.download = 'eyeD-post.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e) {
    var w = window.open(); if (w) w.document.write('<img src="' + out.toDataURL('image/png') + '" style="max-width:100%">');
    else showError('Save blocked. Long-press the image and choose Save.');
  }
});

// ======================= SUPABASE =======================
var SUPABASE_URL = 'https://mmotthgsydxgviabnycv.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tb3R0aGdzeWR4Z3ZpYWJueWN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMTM2MjcsImV4cCI6MjA5MzU4OTYyN30.hUgH6_0eJ-s4FbtSD3_EuyH-5sYLWIUQK4fdDAP0yMU';
var _sessionId = null;           // shared ID across all photos in one session
var _sessionFaceUploaded = false; // only upload face photo once per session

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
      face_photo_path: faceFileName
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
