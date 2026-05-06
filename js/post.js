'use strict';

// ======================= POST MAKER =======================
var revealed = false;
function drawPostStage(){
  var c = $('post-canvas');
  var W = c.width = 540, H = c.height = 960;
  var pc = c.getContext('2d');
  pc.fillStyle = '#0b1020'; pc.fillRect(0, 0, W, H);
  var src = originalImgEl || imgEl;
  if (src){
    var ar = src.width / src.height;
    var dw = W, dh = W / ar;
    if (dh < H * 0.7){ dh = H * 0.7; dw = dh * ar; }
    pc.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  } else {
    pc.fillStyle = '#aab1cc'; pc.textAlign = 'center'; pc.font = '600 22px -apple-system, system-ui, sans-serif';
    pc.fillText('Analyze an iris first', W / 2, H / 2);
  }
  var grad = pc.createLinearGradient(0, H*0.6, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.85)');
  pc.fillStyle = grad; pc.fillRect(0, 0, W, H);
  pc.fillStyle = '#fff'; pc.textAlign = 'left';
  pc.font = '800 32px -apple-system, system-ui, sans-serif';
  pc.fillText('eye', 32, H - 72);
  var w = pc.measureText('eye').width;
  pc.fillStyle = '#6cc4ff'; pc.fillText('D', 32 + w, H - 72);
  pc.fillStyle = '#fff'; pc.font = '600 16px -apple-system, system-ui, sans-serif';
  pc.fillText('#eyeD', 32, H - 44);
  var t = $('post-text');
  if (revealed){
    var hasBoth = eyeResults['Left'] && eyeResults['Right'];
    if (hasBoth){
      t.textContent = eyeResults['Left'].overall.name + ' / ' + eyeResults['Right'].overall.name;
    } else if (window.__lastResult){
      t.textContent = window.__lastResult.overall.name + ' eyes';
    } else {
      t.textContent = '—';
    }
  } else {
    t.textContent = 'What color are my eyes?';
  }
}
