'use strict';

// ======================= COLLARETTE DETECTION =======================
// The collarette (autonomic nerve wreath) is the jagged, frill-like ring
// that divides the pupillary zone (inner iris) from the ciliary zone (outer
// iris), typically 20–55% of the way from the pupil border to the limbus.
//
// Algorithm:
//   1. Sample N concentric rings across the iris annulus (radial profiles)
//   2. At each ring, compute mean grayscale intensity + circumferential std dev
//   3. The collarette produces a local peak in circumferential variance (the
//      irregular boundary creates angular intensity fluctuations) AND/OR a
//      step in the radial mean profile
//   4. Combine both signals into a prominence score → Prominent / Faint / Indistinct
//
// Inputs (same coordinate space as unwrapIris):
//   imageData  – Uint8ClampedArray (RGBA) from canvas getImageData
//   W, H       – canvas dimensions in pixels
//   cx, cy     – iris centre (stage px)
//   rOut       – iris radius (limbus edge)
//   rIn        – pupil radius (inner exclusion)
//
// Returns { label, radialPct, score }
//   label       – 'Prominent' | 'Faint' | 'Indistinct'
//   radialPct   – integer % of iris span where wreath was detected (null if Indistinct)
//   score       – raw prominence score (diagnostic)

function detectCollarette(imageData, W, H, cx, cy, rOut, rIn) {
  var NSTEPS  = 56;   // radial slices across the iris annulus
  var NANGLES = 72;   // angular samples per ring (every 5°)

  var irisSpan = rOut - rIn;
  if (irisSpan < 4) return { label: 'Indistinct', radialPct: null, score: 0 };

  var meanProfile = new Float32Array(NSTEPS);
  var stdProfile  = new Float32Array(NSTEPS);

  for (var s = 0; s < NSTEPS; s++) {
    var rFrac = (s + 0.5) / NSTEPS;        // 0 → 1 across iris width
    var r     = rIn + rFrac * irisSpan;

    var sum = 0, sum2 = 0, count = 0;
    for (var a = 0; a < NANGLES; a++) {
      var angle = (a / NANGLES) * 2 * Math.PI;
      var px    = cx + r * Math.cos(angle);
      var py    = cy + r * Math.sin(angle);
      var ix    = Math.round(px) | 0;
      var iy    = Math.round(py) | 0;
      if (ix < 0 || ix >= W || iy < 0 || iy >= H) continue;
      var idx  = (iy * W + ix) * 4;
      var gray = 0.299 * imageData[idx] + 0.587 * imageData[idx + 1] + 0.114 * imageData[idx + 2];
      sum  += gray;
      sum2 += gray * gray;
      count++;
    }
    if (count > 0) {
      var m          = sum / count;
      meanProfile[s] = m;
      stdProfile[s]  = Math.sqrt(Math.max(0, sum2 / count - m * m));
    }
  }

  // ---- Search zone: 18 % – 58 % of iris span (physiological range) ----
  var sMin = Math.floor(0.18 * NSTEPS) | 0;
  var sMax = Math.floor(0.58 * NSTEPS) | 0;

  // Signal 1: peak circumferential std dev inside search zone
  var maxStd = 0, maxStdS = sMin, totalStd = 0;
  for (var s2 = 0; s2 < NSTEPS; s2++) {
    totalStd += stdProfile[s2];
    if (s2 >= sMin && s2 < sMax && stdProfile[s2] > maxStd) {
      maxStd  = stdProfile[s2];
      maxStdS = s2;
    }
  }
  var meanStd = totalStd / NSTEPS;

  // Signal 2: peak radial gradient of mean intensity inside search zone
  var maxGrad = 0, maxGradS = sMin, totalGrad = 0;
  for (var s3 = 0; s3 < NSTEPS - 1; s3++) {
    var g = Math.abs(meanProfile[s3 + 1] - meanProfile[s3]);
    totalGrad += g;
    if (s3 >= sMin && s3 < sMax - 1 && g > maxGrad) {
      maxGrad  = g;
      maxGradS = s3;
    }
  }
  var meanGrad = totalGrad / (NSTEPS - 1);

  // Prominence ratios (signal vs. overall baseline)
  var stdRatio  = meanStd  > 0.5 ? maxStd  / meanStd  : 0;
  var gradRatio = meanGrad > 0.1 ? maxGrad / meanGrad : 0;

  // Combined score (variance is primary; gradient is confirmatory)
  var score = stdRatio * 0.65 + gradRatio * 0.35;

  // Radial position: use whichever signal is stronger
  var bestS      = stdRatio >= gradRatio ? maxStdS : maxGradS;
  var radialFrac = (bestS + 0.5) / NSTEPS;
  var radialPct  = Math.round(radialFrac * 100);

  // Clamp to physiological range for display
  radialPct = Math.max(18, Math.min(58, radialPct));

  var label;
  if      (score >= 2.2 && radialFrac >= 0.18 && radialFrac <= 0.58) label = 'Prominent';
  else if (score >= 1.5 && radialFrac >= 0.18 && radialFrac <= 0.58) label = 'Faint';
  else                                                                  label = 'Indistinct';

  return {
    label:      label,
    radialPct:  label !== 'Indistinct' ? radialPct : null,
    score:      Math.round(score * 100) / 100
  };
}
