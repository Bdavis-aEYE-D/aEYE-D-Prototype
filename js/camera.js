'use strict';

// ======================= IN-APP CAMERA =======================
// getUserMedia viewfinder + flash→black→capture sequence.
// On success calls loadOriginalFromUrl(dataUrl) — same path as file upload.

var camStream     = null;
var camFacingMode = 'user';   // 'user' = front (selfie) | 'environment' = rear

function cameraAvailable() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

function _applyViewfinderMode() {
  var vid  = $('eyeid-viewfinder');
  var oval = document.querySelector('.face-oval');
  var guide = $('cam-guide-text');
  if (!vid) return;
  if (camFacingMode === 'environment') {
    vid.classList.add('rear');
    if (guide) guide.textContent = 'Hand to someone — frame their eyes in the oval';
    if (oval)  oval.style.borderColor = 'rgba(255,200,80,0.65)';  // amber tint for rear
  } else {
    vid.classList.remove('rear');
    if (guide) guide.textContent = 'Look at camera — eyes wide open';
    if (oval)  oval.style.borderColor = '';
  }
}

function cameraStart(facing) {
  if (!cameraAvailable()) { return false; }
  if (facing) camFacingMode = facing;

  $('card-capture').style.display = 'none';
  $('card-viewfinder').style.display = 'block';
  $('card-viewfinder').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('cam-status').textContent = 'Starting camera…';
  $('btn-cam-capture').disabled = true;

  // Stop any existing stream before requesting a new one
  if (camStream) {
    camStream.getTracks().forEach(function(t) { t.stop(); });
    camStream = null;
  }

  var constraints = {
    video: {
      facingMode: camFacingMode,
      width:      { ideal: 4096 },   // request max — iOS gives highest it supports
      height:     { ideal: 4096 },
      frameRate:  { ideal: 15, max: 30 }  // lower fps → more bandwidth per frame
    },
    audio: false
  };

  navigator.mediaDevices.getUserMedia(constraints).then(function(s) {
    camStream = s;
    var vid = $('eyeid-viewfinder');
    vid.srcObject = s;
    vid.play();
    _applyViewfinderMode();
    // Log actual resolution granted by the browser/OS
    var track = s.getVideoTracks()[0];
    if (track) {
      var settings = track.getSettings();
      console.log('[camera] granted ' + settings.width + '×' + settings.height
        + ' @ ' + (settings.frameRate || '?') + 'fps — facing: ' + camFacingMode);
    }
    var label = camFacingMode === 'environment' ? 'Rear camera ready' : 'Camera ready — tap Capture when set';
    $('cam-status').textContent = label;
    $('btn-cam-capture').disabled = false;
  }).catch(function(e) {
    $('cam-status').textContent = 'Camera error: ' + e.message;
    setTimeout(function() { cameraStop(); }, 2000);
  });
  return true;
}

function cameraFlip() {
  // Toggle facing mode and restart the stream
  camFacingMode = (camFacingMode === 'user') ? 'environment' : 'user';
  cameraStart();  // restarts with new facingMode
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
  var btn     = $('btn-cam-capture');
  var status  = $('cam-status');
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
      // Step 3: Grab frame from video
      var vid = $('eyeid-viewfinder');
      var cvs = document.createElement('canvas');
      cvs.width  = vid.videoWidth;
      cvs.height = vid.videoHeight;
      var ctx = cvs.getContext('2d');

      // Only un-mirror for front (selfie) camera; rear image is already correct
      if (camFacingMode === 'user') {
        ctx.translate(cvs.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(vid, 0, 0);

      // Restore UI
      overlay.classList.remove('dark');
      setTheme('#0b1020');

      var dataUrl = cvs.toDataURL('image/jpeg', 0.92);
      cameraStop();
      loadOriginalFromUrl(dataUrl);

    }, 400);
  }, 1500);
}
