'use strict';

// ======================= IN-APP CAMERA =======================
// getUserMedia viewfinder + flash→black→capture sequence.
// On success calls loadOriginalFromUrl(dataUrl) — same path as file upload.

var camStream = null;

function cameraAvailable() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function cameraStart() {
  if (!cameraAvailable()) { return false; }

  $('card-capture').style.display = 'none';
  $('card-viewfinder').style.display = 'block';
  $('card-viewfinder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('cam-status').textContent = 'Starting camera…';
  $('btn-cam-capture').disabled = true;

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
    audio: false
  }).then(function(s) {
    camStream = s;
    var vid = $('eyeid-viewfinder');
    vid.srcObject = s;
    vid.play();
    $('cam-status').textContent = 'Camera ready — tap Capture when set';
    $('btn-cam-capture').disabled = false;
  }).catch(function(e) {
    $('cam-status').textContent = 'Camera error: ' + e.message;
    // Fall back to file input after a moment
    setTimeout(function() { cameraStop(); }, 2000);
  });
  return true;
}

function cameraStop() {
  if (camStream) {
    camStream.getTracks().forEach(function(t) { t.stop(); });
    camStream = null;
  }
  var vid = $('eyeid-viewfinder');
  if (vid) vid.srcObject = null;
  $('card-viewfinder').style.display = 'none';
  $('card-capture').style.display = 'block';
}

// Flash → black → capture sequence
function cameraCaptureSequence() {
  if (!camStream) return;
  var btn    = $('btn-cam-capture');
  var status = $('cam-status');
  var overlay = $('cam-overlay');
  var themeMeta = $('theme-color-meta');

  btn.disabled = true;
  status.textContent = 'Flashing — hold still, eyes open…';

  function setTheme(color) { if (themeMeta) themeMeta.content = color; }

  // Step 1: White flash — constrict pupil
  overlay.classList.add('flash');
  setTheme('#ffffff');

  setTimeout(function() {
    // Step 2: Instant switch to black — phone stops being a reflection source
    overlay.classList.remove('flash');
    overlay.classList.add('dark');
    setTheme('#000000');
    status.textContent = 'Capturing…';

    setTimeout(function() {
      // Step 3: Grab frame from video — pupil still constricted, no phone glare
      var vid = $('eyeid-viewfinder');
      var cvs = document.createElement('canvas');
      cvs.width  = vid.videoWidth;
      cvs.height = vid.videoHeight;
      var ctx = cvs.getContext('2d');
      // Un-mirror (viewfinder is CSS-mirrored for selfie feel)
      ctx.translate(cvs.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(vid, 0, 0);

      // Restore UI
      overlay.classList.remove('dark');
      setTheme('#0b1020');

      var dataUrl = cvs.toDataURL('image/jpeg', 0.92);

      // Stop camera then hand off to main analysis flow
      cameraStop();
      loadOriginalFromUrl(dataUrl);

    }, 400); // settle: screen dark, camera exposure adjusts
  }, 1500);  // hold flash 1.5 s — pupil constricts in ~200–400 ms
}
