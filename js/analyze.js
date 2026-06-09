'use strict';

// ======================= ANALYZE — eye-D UI layer =======================

// Returns the label display string: "Specific Name · Category" unless the
// specific name already contains the category word (e.g. "Sky Blue · Blue"
// would be redundant, so just "Sky Blue").
function colorDisplayName(name, cat) {
  if (!cat || name.toLowerCase().indexOf(cat.toLowerCase()) >= 0) return name;
  return name + ' · ' + cat;
}

// Returns the prose display string: "Specific Name Category" (space-joined,
// no punctuation) for use inside sentences. Same suppression rule applies.
function colorProseName(name, cat) {
  if (!cat || name.toLowerCase().indexOf(cat.toLowerCase()) >= 0) return name;
  return name + ' ' + cat;
}

// Reads globals from app.js, calls core/engine.js::analyzeIris(), then
// renders results into the DOM.
//
// To use the analysis engine in a different product or UI, load core/engine.js
// and call analyzeIris() directly — no DOM or eye-D globals needed.

function analyze(){
  // Read DOM-specific inputs
  var userAge = 0;
  var birthdateEl = document.getElementById('birthdate-input');
  if (birthdateEl && birthdateEl.value) {
    var bd = new Date(birthdateEl.value);
    var now = new Date();
    userAge = Math.floor((now - bd) / (1000 * 60 * 60 * 24 * 365.25));
  }

  // Call the UI-independent engine (core/engine.js)
  var result = analyzeIris(imgEl, donut, drawInfo, stageW, stageH, currentSide, userAge, {
    eyeShape: window.currentEyeShape || null
  });

  if (!result) return;
  if (result.error) { showError(result.error); return; }

  // Update session state and render
  eyeResults[result.side] = result;
  renderResult(result);
  window.__lastResult = result;

  // Attach iris canvas snapshot so uploadToSupabase can send the photo
  if (typeof canvas !== 'undefined' && canvas) {
    try { result.analysisImage = { src: canvas.toDataURL('image/jpeg', 0.85), iris: donut }; }
    catch(e) {}
  }
  uploadToSupabase(result);
}

// ======================= RESULT RENDERING =======================
// DOM-specific display functions — eye-D UI only.
// A different product would replace everything below with its own display layer.

function renderResult(result){
  var resCard = $('card-result');
  resCard.style.display = 'block';

  // ── Quality advisory ──────────────────────────────────────────────────────
  var qa = $('quality-advisory');
  if (qa) {
    var q = result.quality;
    if (q && q.label !== 'Good') {
      var isPoor = q.label === 'Poor';
      qa.className = isPoor ? 'qa-poor' : '';
      qa.style.display = 'block';
      $('qa-icon').textContent  = isPoor ? '⚠️' : '💛';
      $('qa-title').textContent = isPoor
        ? 'Photo quality is poor — result may be inaccurate'
        : 'Photo quality is fair — result may vary';
      var reasonsEl = $('qa-reasons');
      if (reasonsEl) {
        reasonsEl.textContent = q.reasons.length
          ? q.reasons.slice(0, 2).join(' · ')
          : 'Try a closer, clearer photo for best accuracy.';
      }
    } else {
      qa.style.display = 'none';
    }
  }

  $('r-side').textContent = result.side + ' Eye';
  $('r-color').textContent = colorDisplayName(result.overall.name, result.overall.cat);

  // ── Capture thumbnail from the result's analysisImage ─────────────────────
  // result.analysisImage.src is the actual iris data URL stored by the engine.
  // This is more reliable than the DOM canvas (which can be tainted/cleared).
  if (typeof SaveStore !== 'undefined') SaveStore.captureThumbFromResult(result);

  // ── Save button: show + wire up ────────────────────────────────────────────
  var _saveBtn = $('btn-save-result');
  if (_saveBtn) {
    _saveBtn.style.display = 'block';
    _saveBtn.onclick = function() {
      if (typeof SaveModal !== 'undefined') SaveModal.show(result);
    };
  }
  // ── Confidence indicator ──────────────────────────────────────────────────
  // When the cascade RF is uncertain (confidence < 60/100), show a subtle
  // indicator so users know the colour call is borderline.
  var _confBar = $('r-confidence-bar');
  if (_confBar) {
    var _conf = result.colorConfidence;
    if (_conf != null && _conf < 60) {
      var _isVeryLow = _conf < 40;
      var _confLabel = _isVeryLow
        ? '⚠ Low confidence — ring placement may be off. Scroll up to re-adjust.'
        : '~ Borderline colour — tap to manually adjust if ring looks off.';
      _confBar.textContent = _confLabel;
      _confBar.style.display = 'block';
      // Very low confidence: also flag the ring fit section with the orange warning
      // so users scrolling back up see it immediately.
      if (_isVeryLow) {
        var _hint = $('hint');
        if (_hint && _hint.style.color !== '#fa0') {
          _hint.textContent = 'Low colour confidence — check ring placement and re-analyze if needed.';
          _hint.style.color = '#fa0';
        }
        var _rb = $('btn-quality-retake');
        if (_rb) _rb.style.display = '';
      }
    } else {
      _confBar.style.display = 'none';
    }
  }
  // ── Opening line: colour + intensity ──────────────────────────────────────
  var cat      = result.overall.cat;            // e.g. 'Blue', 'Green', 'Brown', 'Hazel'
  var name     = result.overall.name;           // e.g. 'Sky Blue', 'Emerald', 'Warm Amber'
  var proseName = colorProseName(name, cat);    // e.g. 'Graphite Gray', 'Sky Blue' (no duplicate)
  var bri  = result.brightness;    // 'Dark' | 'Medium' | 'Bright'
  var sat  = result.saturation;    // 'Muted' | 'Soft' | 'Vivid'
  var side = result.side.toLowerCase();

  // Category-specific opening
  var catOpeners = {
    'Blue':  [
      'Your ' + side + ' eye is a stunning ' + proseName + ' — a cool, luminous shade that arrests attention the moment people look your way.',
      'A crystalline ' + proseName + ' fills your ' + side + ' iris — the kind of blue that photographs like gemstone light.',
      'Your ' + side + ' eye blazes with ' + proseName + ' — pure, striking, and impossible to ignore.'
    ],
    'Green': [
      'Your ' + side + ' eye is a rare, jewel-toned ' + proseName + ' — fewer than 2% of people share this captivating shade.',
      'A rich ' + proseName + ' illuminates your ' + side + ' iris — bold, vivid, and genuinely rare.',
      'Your ' + side + ' eye burns with the kind of ' + proseName + ' that makes people look twice.'
    ],
    'Brown': [
      'Your ' + side + ' eye is a warm, soulful ' + proseName + ' — deep, rich, and full of dimension.',
      'A luminous ' + proseName + ' fills your ' + side + ' iris — earthy depth wrapped in golden warmth.',
      'Your ' + side + ' eye radiates ' + proseName + ' — bold and warm, with a depth that draws people in.'
    ],
    'Hazel': [
      'Your ' + side + ' eye shifts with ' + proseName + ' — a captivating blend that changes with the light, never quite the same color twice.',
      'A chameleon ' + proseName + ' dances through your ' + side + ' iris — warm one moment, cool the next.',
      'Your ' + side + ' eye reads as ' + proseName + ' — a rare, multi-tonal beauty that defies a single description.'
    ],
    'Gray':  [
      'Your ' + side + ' eye is a striking ' + proseName + ' — cool, magnetic, and quietly intense.',
      'A rare ' + proseName + ' fills your ' + side + ' iris — silver-cool and effortlessly captivating.',
      'Your ' + side + ' eye carries a beautiful ' + proseName + ' — the rarest eye category in the world.'
    ]
  };
  var openers = catOpeners[cat] || [
    'Your ' + side + ' eye is a beautiful ' + proseName + ' — a distinctive, eye-catching shade.'
  ];
  var n = openers[Math.floor(Math.random() * openers.length)] + ' ';

  // Intensity modifier
  if (sat === 'Vivid' && bri === 'Bright') {
    n += 'The color is intensely saturated and luminous — these are eyes that hold a room. ';
  } else if (sat === 'Vivid') {
    n += 'The color is boldly saturated with real depth and richness. ';
  } else if (sat === 'Soft' && bri === 'Bright') {
    n += 'The soft, bright tone gives the iris a dreamy, almost backlit quality. ';
  } else if (bri === 'Dark' && sat === 'Muted') {
    n += 'The deep, subdued tones carry a quiet, smouldering intensity. ';
  }

  // ── Heterochromia ─────────────────────────────────────────────────────────
  if (result.hetero !== 'None') {
    var pupName = result.heteroPup ? (result.heteroPup.displayName || result.heteroPup.color.name).toLowerCase() : 'warm';
    var cilName = result.heteroCil ? (result.heteroCil.displayName || result.heteroCil.color.name).toLowerCase() : 'cooler';
    if (result.hetero.indexOf('warmth') >= 0) {
      n += 'A warm ' + pupName + ' corona glows around your pupil — sometimes called "sunflower eyes" — radiating outward into the ' + cilName + ' outer iris. Only about 10–15% of people have this stunning inner ring. ';
    } else if (result.hetero.indexOf('lightness') >= 0) {
      n += 'A luminous ' + pupName + ' inner ring circles the pupil and radiates outward into the ' + cilName + ' iris — a gorgeous two-tone depth effect. ';
    } else if (result.hetero === 'Central') {
      n += 'Your iris holds two distinct colors: a bold ' + result.inner.name.toLowerCase() + ' inner ring melting into a ' + result.outer.name.toLowerCase() + ' outer iris — true central heterochromia, and genuinely rare. ';
    } else {
      n += 'Central heterochromia layers a ' + result.inner.name.toLowerCase() + ' inner ring against a ' + result.outer.name.toLowerCase() + ' outer iris — a captivating two-toned effect. ';
    }
  }

  // ── Central-heterochromia perception note ────────────────────────────────
  // When a warm amber/bronze collarette is detected around the pupil and the outer
  // iris is a different (cooler or neutral) color, humans spatially integrate the two
  // zones at normal viewing distance — often perceiving the eye as Hazel even when
  // the outer iris is Gray, Blue, or Brown. Surface this explanation when the engine
  // detects the warm ring AND the main color isn't already Hazel (where it's obvious).
  if (result.centralHetero && cat !== 'Hazel') {
    n += 'You may notice that some people describe this eye as Hazel — that\'s a natural perception effect: the warm amber ring around the pupil blends with the ' + cat.toLowerCase() + ' outer iris at normal viewing distances, creating the visual impression of a blended, hazel-like color. ';
  }

  // ── Limbal ring ───────────────────────────────────────────────────────────
  if (result.limbal !== 'None' && result.limbalColor) {
    var ftype = result.limbalType || 'ring';
    var lc = result.limbalColor.name.toLowerCase();
    if (ftype === 'halo') {
      n += 'A brilliant ' + lc + ' halo glows just inside the iris edge — a luminous inner border that makes the color feel lit from within. ';
    } else if (result.limbal === 'Dramatic') {
      n += 'A Dramatic ' + lc + ' limbal ring frames the entire iris like natural eyeliner — bold, magnetic, and the feature that makes eyes look deep, intense, and unforgettable. ';
    } else if (result.limbal === 'Strong') {
      n += 'A strong ' + lc + ' limbal ring circles the iris, creating crisp, high-contrast definition. This is the feature that makes eyes pop across a room — striking, beautiful, and arresting. ';
    } else {
      n += 'A ' + result.limbal.toLowerCase() + ' ' + lc + ' limbal ring adds definition and polish at the iris edge. ';
    }
  }

  // ── Sectoral heterochromia ────────────────────────────────────────────────
  if (result.sectoral) {
    n += 'A bold splash of ' + result.sectoral.color.name.toLowerCase() + ' at ' + result.sectoral.clock + " o'clock gives this iris a completely unique signature — like a one-of-a-kind fingerprint. No two people share the same sectoral marking. ";
  }

  // ── Iris freckles ─────────────────────────────────────────────────────────
  if (result.freckles && result.freckles.length) {
    var nf = result.freckles.length;
    if (nf === 1) {
      n += 'A single iris freckle near ' + result.freckles[0].clock + " o'clock adds a distinctive personal mark — a tiny detail that makes this eye truly yours. ";
    } else {
      n += nf + ' iris freckles dot the surface — small concentrations of melanin that add character and are completely unique to you. ';
    }
  }

  // ── Closing punch line (only when features warrant it) ───────────────────
  var hasStrong = (result.limbal === 'Dramatic' || result.limbal === 'Strong');
  var hasHetero = (result.hetero !== 'None');
  var hasSectoral = !!result.sectoral;
  if (hasStrong && hasHetero) {
    n += 'Together, the ' + proseName.toLowerCase() + ' color, inner ring, and strong limbal border create eyes that are genuinely hard to look away from. ';
  } else if (hasStrong && (sat === 'Vivid' || bri === 'Bright')) {
    n += 'The combination of bold color and that defined limbal ring makes these eyes truly stand out — bright, beautiful, and captivating. ';
  } else if (hasSectoral || (hasHetero && hasStrong)) {
    n += 'This is a rare combination. These are eyes that leave a lasting impression. ';
  }
  $('r-narrative').textContent = n;
  var sr = $('r-swatches'); sr.innerHTML = '';
  result.topColors.forEach(function(rgb){
    var sw = document.createElement('div'); sw.className = 'swatch';
    sw.style.background = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
    sr.appendChild(sw);
  });
  $('r-general').textContent = result.overall.cat;
  $('r-specific').textContent = colorDisplayName(result.overall.name, result.overall.cat);
  // Limbal ring shows "Strength · Color" when distinct, just "None" otherwise
  $('r-limbal').textContent = result.limbalColor
    ? (result.limbal + ' · ' + result.limbalColor.name + ' ' + (result.limbalType || 'ring'))
    : result.limbal;
  // Heterochromia cell — name the inner ring color when we have a gradient
  if (result.hetero === 'Central (warmth gradient)' || result.hetero === 'Central (lightness gradient)') {
    var ringDescriptor = result.heteroPup
      ? (result.heteroPup.displayName || result.heteroPup.color.name) + ' pupillary ring'
      : (result.hetero.indexOf('warmth') >= 0 ? 'warm pupillary ring' : 'light pupillary ring');
    $('r-hetero').textContent = 'Central · ' + ringDescriptor;
  } else if (result.hetero === 'Central' && result.heteroPup && result.heteroCil) {
    $('r-hetero').textContent = 'Central · ' + (result.heteroPup.displayName || result.heteroPup.color.name) + ' / ' + (result.heteroCil.displayName || result.heteroCil.color.name);
  } else {
    $('r-hetero').textContent = result.hetero;
  }
  // Render Highlights + Story
  renderHighlights(result);
  renderStory(result);
  $('r-sectoral').textContent = result.sectoral
    ? (result.sectoral.color.name + " · " + result.sectoral.clock + " o'clock")
    : 'None';
  $('r-freckles').textContent = (result.freckles && result.freckles.length)
    ? (result.freckles.length + (result.freckles.length === 1 ? ' freckle' : ' freckles'))
    : 'None';
  $('r-brightness').textContent = result.brightness;
  $('r-saturation').textContent = result.saturation;
  if (result.rayid && RAYID_META[result.rayid.label]) {
    var rm = RAYID_META[result.rayid.label];
    var rv = $('r-rayid');
    if (rv) {
      rv.innerHTML = '<span style="display:inline-block;width:8px;height:8px;'
        + 'border-radius:50%;background:' + rm.color + ';margin-right:6px;'
        + 'vertical-align:middle;flex-shrink:0"></span>'
        + result.rayid.label;
      rv.style.color = rm.color;
    }
  }
  // Collarette (autonomic nerve wreath)
  var collEl = $('r-collarette');
  if (collEl && result.collarette) {
    var cl = result.collarette;
    if (cl.label === 'Indistinct') {
      collEl.textContent = '—';
      collEl.style.color = '';
    } else {
      var cText = cl.label;
      if (cl.radialPct) cText += ' · ~' + cl.radialPct + '% radius';
      collEl.textContent = cText;
      collEl.style.color = cl.label === 'Prominent' ? '#34d399' : '#a3b4c8';
    }
  }
  // Eye shape
  var esEl = $('r-eyeshape');
  if (esEl) {
    if (result.eyeShape) {
      var esColors = { Almond:'#a3b4c8', Round:'#60a5fa', Hooded:'#c084fc',
                       Monolid:'#f0abfc', Upturned:'#f59e0b',
                       Downturned:'#f87171', Narrow:'var(--ink-dim)' };
      esEl.textContent = result.eyeShape.label;
      esEl.style.color = esColors[result.eyeShape.label] || '';
    } else {
      esEl.textContent = '—';
      esEl.style.color = '';
    }
  }
  // Pupil offset (eccentricity of pupil center vs iris center)
  var peEl = $('r-pupil-ecc');
  if (peEl && result.pupilEcc) {
    peEl.textContent = result.pupilEcc.label;
    peEl.style.color = result.pupilEcc.pct <= 3 ? 'var(--ink-dim)' : '#a3b4c8';
  }

  // If both eyes have been analyzed, show the two-eye summary
  var hasBoth = eyeResults['Left'] && eyeResults['Right'];
  $('twoeye-summary').style.display = hasBoth ? 'grid' : 'none';
  if (hasBoth){
    var L = eyeResults['Left'], R = eyeResults['Right'];
    $('left-name').textContent  = colorDisplayName(L.overall.name, L.overall.cat);
    $('left-meta').textContent  = L.overall.cat + ' · Limbal: ' + L.limbal + ' · Het: ' + L.hetero;
    $('right-name').textContent = colorDisplayName(R.overall.name, R.overall.cat);
    $('right-meta').textContent = R.overall.cat + ' · Limbal: ' + R.limbal + ' · Het: ' + R.hetero;
    // ===== Bilateral heterochromia (L vs R) =====
    // Compares the two eyes' overall palette anchors. Categories are the
    // strongest signal: David Bowie / Kiefer Sutherland-style "different
    // color eyes" cross category lines (blue vs brown). Same-category but
    // large ΔE flags subtle bilateral hetero (e.g. light vs dark hazel).
    // Using palette anchors (not raw RGB) keeps this stable across lighting.
    var biDe = dE(L.overall.lab, R.overall.lab);
    var sameCat = L.overall.cat === R.overall.cat;

    // Same-name snapping: when both eyes land in the same category but on
    // opposite sides of a palette boundary (biDe < 10), they look identical
    // to observers — find the single palette entry that best fits both and
    // use that name for both rather than reporting two different shades.
    if (sameCat && biDe < 10 && typeof PALETTE !== 'undefined') {
      var labL = L.fingerprint ? L.fingerprint.lab : L.overall.lab;
      var labR = R.fingerprint ? R.fingerprint.lab : R.overall.lab;
      var snapBest = null, snapBestSum = Infinity;
      for (var _pi = 0; _pi < PALETTE.length; _pi++) {
        var _pe = PALETTE[_pi];
        if (_pe.cat !== L.overall.cat) continue;
        var _s = dE(labL, _pe.lab) + dE(labR, _pe.lab);
        if (_s < snapBestSum) { snapBestSum = _s; snapBest = _pe; }
      }
      if (snapBest) {
        L.overall = snapBest;
        R.overall = snapBest;
        // Update the bilateral row names and the currently-displayed result card
        var _dn = colorDisplayName(snapBest.name, snapBest.cat);
        $('left-name').textContent  = _dn;
        $('right-name').textContent = _dn;
        if ($('r-color'))    $('r-color').textContent    = _dn;
        if ($('r-specific')) $('r-specific').textContent = _dn;
      }
    }

    var verdict, detail, cls;
    if (!sameCat){
      verdict = 'Complete bilateral heterochromia';
      detail  = L.overall.cat + ' on the left, ' + R.overall.cat + ' on the right — two genuinely different eye colors. '
              + 'About 1 in 200,000 people have eyes this distinct. David Bowie made it iconic; you\'re in rare company.';
      cls = 'bilateral';
    } else if (biDe > 25){
      // Raised from 18 → 25: differences below this threshold are within the
      // normal per-photo variation of a single iris color and not visually
      // noticeable as heterochromia to an observer.
      verdict = 'Subtle bilateral heterochromia';
      detail  = 'Both eyes are ' + L.overall.cat.toLowerCase() + ', but they\'re measurably different — '
              + L.overall.name + ' on the left versus ' + R.overall.name + ' on the right. '
              + 'Most people won\'t notice at a glance, but in good light it\'s unmistakable.';
      cls = 'bilateral';
    } else {
      verdict = 'Matched eyes';
      var _ln = L.overall.name, _rn = R.overall.name;
      detail  = (_ln === _rn)
        ? _ln + ' in both eyes — a perfectly matched pair.'
        : _ln + ' left, ' + _rn + ' right — a well-matched pair. The color reads consistently across both eyes.';
      cls = 'bilateral match';
    }
    $('bilateral-verdict').textContent = verdict;
    $('bilateral-detail').textContent  = detail;
    $('bilateral-row').className = cls;
  }
  // Hide "Other Eye" button if both done; show Both Eyes Card button instead
  $('btn-other-eye').style.display = hasBoth ? 'none' : '';
  var btnBoth = $('btn-both-eyes-card');
  if (btnBoth) btnBoth.classList.toggle('hidden', !hasBoth);
  // Update Beauty Shot button label based on whether one is already attached
  var btnPortrait = $('btn-portrait');
  if (btnPortrait) {
    btnPortrait.textContent = result.portraitImage
      ? 'Replace Beauty Shot ✓'
      : 'Add Beauty Shot';
  }
  if (hasBoth) {
    $('next-text').textContent = 'Both eyes analyzed — head to Post Maker to create your reveal card, or start over with a new photo.';
  } else {
    var other = (result.side === 'Left') ? 'Right' : 'Left';
    $('btn-other-eye').textContent = 'Analyze ' + other + ' Eye';
    $('next-text').textContent = 'One eye in. Analyze the ' + other.toLowerCase() + ' to see if they match — or go straight to Post Maker.';
  }
  setTimeout(function(){ $('card-result').scrollIntoView({behavior:'smooth', block:'start'}); }, 60);
}

// ======================= HIGHLIGHTS + STORY VIEW =======================
function rgbCss(rgb){ return 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')'; }

function renderHighlights(result){
  var box = $('r-highlights');
  box.innerHTML = '';
  var items = [];
  // ===== Always-on highlights (color profile) =====
  // Rarity hero card — "1 in X" headline
  if (result.rarity) {
    var oneInStr = formatOneInX(result.rarityOneInX || 1);
    var factorDesc = (result.rarityFactors && result.rarityFactors.length)
      ? 'people share this exact combination — ' + result.rarityFactors.join(' · ')
      : 'people share this exact combination of color and iris structure';
    items.push({
      title: oneInStr,
      desc:  factorDesc,
      swatch: { type: 'solid', c1: rgbCss(result.overall.rgb) },
      hero:  true,
    });
  }
  // ===== Eye Description — vibe name + character, merged into one card =====
  if (result.vibe) {
    var bri2 = result.brightness, sat2 = result.saturation;
    // Mood sentence (from brightness + saturation combo)
    var vibeMood = (bri2 === 'Bright' && sat2 === 'Vivid')  ? 'Luminous and high-impact — a bold iris that catches the eye in any light.' :
                   (bri2 === 'Bright' && sat2 === 'Soft')   ? 'Light and airy — a gentle glow that looks almost backlit in natural light.' :
                   (bri2 === 'Bright')                       ? 'Light-reflecting and open — warmth you can see from across the room.' :
                   (bri2 === 'Dark'  && sat2 === 'Vivid')   ? 'Rich and deep — saturated color that drinks in the light.' :
                   (bri2 === 'Dark'  && sat2 === 'Muted')   ? 'Understated and quietly magnetic — depth without drama.' :
                   (bri2 === 'Dark')                         ? 'Dark and absorbing — all quiet intensity.' :
                   (sat2 === 'Vivid')                        ? 'Well-saturated with real pop — stands out in a crowd.' :
                   (sat2 === 'Muted')                        ? 'Soft and understated — a subtle beauty that rewards a closer look.' :
                                                               'A naturally balanced iris — appealing in any light.';
    // Character sentence (from pattern hint)
    var phint = getPatternHint(bri2, sat2);
    var charSentence = {
      'Vivid stroma — strong color saturation': 'High-saturation pigment that catches and holds light.',
      'Saturated iris — pigment-rich':          'Rich color that reads as vibrant even in low light.',
      'Soft, muted stroma':                     'Gentle, understated tones with their own quiet beauty.',
      'Deep, light-absorbing iris':             'A dark, absorbing iris — all depth and intensity.',
      'Bright, light-reflecting iris':          'Light-reflective and luminous.',
      'Balanced light and pigment':             'Naturally balanced — appealing in any light.'
    }[phint] || '';
    items.push({
      title: result.vibe,
      desc: 'Eye description — ' + vibeMood + (charSentence ? ' ' + charSentence : ''),
      swatch: { type: 'solid', c1: rgbCss(result.overall.rgb) },
    });
  }
  // ===== Heterochromia (any kind) =====
  if (result.hetero !== 'None') {
    var pupName, cilName, pupRgb, cilRgb, label, descParts = [];
    if (result.heteroPup && result.heteroCil) {
      pupName = result.heteroPup.displayName || result.heteroPup.color.name;
      cilName = result.heteroCil.displayName || result.heteroCil.color.name;
      pupRgb = result.heteroPup.rgb; cilRgb = result.heteroCil.rgb;
    } else {
      pupRgb = result.outer.rgb || [128,128,128];
      cilRgb = result.outer.rgb || [128,128,128];
    }
    var heteroDesc;
    if (result.hetero.indexOf('warmth') >= 0) {
      label = 'Two-tone iris';
      heteroDesc = (pupName || 'A warm-toned') + ' ring around the pupil melts outward into '
        + ((cilName || 'the cooler outer iris')).toLowerCase()
        + '. This is sometimes called "sunflower eyes" — the warm inner burst is visible even at normal conversational distance. About 1 in 10 people have it.';
    } else if (result.hetero.indexOf('lightness') >= 0) {
      label = 'Two-tone iris';
      heteroDesc = 'A brighter inner zone — ' + (pupName || 'lighter color').toLowerCase()
        + ' — gradually deepens into ' + ((cilName || 'a richer outer iris')).toLowerCase()
        + '. The two layers are clearly different even without a magnifier.';
    } else if (result.hetero === 'Central') {
      label = 'Two-tone iris';
      heteroDesc = (pupName || result.inner.name) + ' close to the pupil, '
        + ((cilName || result.outer.name)).toLowerCase()
        + ' toward the edge — a complete color change within a single iris. This is central heterochromia, affecting roughly 1 in 6 people in some form.';
    } else {
      label = 'Two-tone gradient';
      heteroDesc = result.inner.name + ' in the inner iris shifting to '
        + result.outer.name.toLowerCase() + ' toward the edge — a subtle but real two-tone effect that most people would never notice unless they looked closely.';
    }
    items.push({
      title: label, desc: heteroDesc,
      swatch: { type: 'split', c1: rgbCss(pupRgb), c2: rgbCss(cilRgb) },
    });
  }
  // Limbal ring or halo
  if (result.limbal !== 'None' && result.limbalColor) {
    var ftype = result.limbalType || 'ring';
    // Plain-English opener: tell people what a limbal ring is before describing theirs.
    var limbalShortDesc = ftype === 'halo'
      ? 'The inner halo is a luminous zone just outside the pupil that makes the iris color look lit from within — not everyone has one.'
      : 'The outer border (called the limbal ring) is the dark rim that frames the iris — not everyone has a clearly visible one. '
        + ({
            'Dramatic': 'Yours is dramatic: a bold, high-contrast rim that acts like natural eyeliner and holds attention from across the room.',
            'Strong':   'Yours is strong — a sharp, clearly visible edge that makes the iris color pop and gives the eye real definition.',
            'Moderate': 'Yours is clearly defined — a ' + result.limbalColor.name.toLowerCase() + ' border that adds crispness and depth to the color.',
            'Soft':     'Yours is soft — a gentle ' + result.limbalColor.name.toLowerCase() + ' edge that adds subtle definition.',
            'Faint':    'Yours is faint — barely there but measurably present, adding a trace of definition at the edge.'
          }[result.limbal] || 'A ' + result.limbalColor.name.toLowerCase() + ' rim at the outer iris edge.');
    items.push({
      title: result.limbal + ' outer border (limbal ring)',
      desc: limbalShortDesc,
      swatch: { type: 'solid', c1: rgbCss(result.limbalRgb || result.limbalColor.rgb) },
    });
  }
  // Sectoral patch
  if (result.sectoral) {
    items.push({
      title: 'Sectoral patch · ' + result.sectoral.color.name,
      desc: 'A sectoral patch is a wedge or splash of a completely different color within the iris — '
        + 'yours is ' + result.sectoral.color.name.toLowerCase() + ' near '
        + result.sectoral.clock + " o'clock. "
        + 'About 1 in 1,000 people have one, caused by a localised pigment difference. No two are ever in the same position.',
      swatch: { type: 'solid', c1: rgbCss(result.sectoral.rgb) },
    });
  }
  // Freckles
  if (result.freckles && result.freckles.length) {
    var nf = result.freckles.length;
    var clockStr = result.freckles.slice(0, 3).map(function(f){ return f.clock + " o'clock"; }).join(', ');
    items.push({
      title: nf + ' iris freckle' + (nf === 1 ? '' : 's'),
      desc: (nf === 1 ? 'A concentrated melanin deposit near ' : 'Melanin concentrations near ')
        + clockStr + (nf > 3 ? ' and ' + (nf - 3) + ' more' : '')
        + ' — no two people share the same freckle pattern.',
      swatch: { type: 'solid', c1: rgbCss(result.freckles[0].rgb || [60,40,20]) },
    });
  }
  // ===== Iris pattern (Rayid) =====
  if (result.rayid && RAYID_META[result.rayid.label]) {
    var rm2 = RAYID_META[result.rayid.label];
    items.push({
      title: 'Iris pattern: ' + result.rayid.label,
      desc:  rm2.story.replace(/<[^>]+>/g, ''),
      swatch: { type: 'solid', c1: rm2.color }
    });
  }
  // ===== Collarette =====
  if (result.collarette && result.collarette.label !== 'Indistinct') {
    var cProminent = result.collarette.label === 'Prominent';
    items.push({
      title: 'Inner ring (collarette)',
      desc: 'Most people have never noticed their collarette — it\'s a textured, slightly raised ring '
        + 'that runs across the iris roughly a third of the way out from the pupil. '
        + (cProminent
            ? 'Yours is clearly visible. If you hold a phone camera close to your eye in good light, you can see it — the rippled inner border before the main iris color starts.'
            : 'Yours is faint but detectable. A macro lens or bright direct light would make it more visible.'),
      swatch: { type: 'solid', c1: cProminent ? '#34d399' : '#a3b4c8' }
    });
  }
  // Render
  if (items.length === 0) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'flex';
  items.forEach(function(it){
    var row = document.createElement('div');
    row.className = 'highlight' + (it.hero ? ' rarity-hero' : '');
    var sw = document.createElement('div');
    sw.className = 'swatch-circle' + (it.swatch.type === 'split' ? ' split' : '');
    if (it.swatch.type === 'split') {
      sw.style.setProperty('--c1', it.swatch.c1);
      sw.style.setProperty('--c2', it.swatch.c2);
    } else {
      sw.style.background = it.swatch.c1;
    }
    var body = document.createElement('div');
    body.className = 'body';
    var t = document.createElement('div'); t.className = 'title'; t.textContent = it.title;
    var d2 = document.createElement('div'); d2.className = 'desc'; d2.textContent = it.desc;
    body.appendChild(t); body.appendChild(d2);
    row.appendChild(sw); row.appendChild(body);
    box.appendChild(row);
  });
}

function renderStory(result){
  var box = $('view-story-content');
  box.innerHTML = '';
  var paras = [];
  var side = result.side.toLowerCase();

  // ── Opening — name + vibe ────────────────────────────────────────────────
  var openLine = 'Your <strong>' + side + ' eye</strong> is <strong>' + result.overall.name + '</strong>';
  if (result.vibe) openLine += ' — ' + result.vibe;
  openLine += '.';
  paras.push(openLine);

  // ── Rarity ────────────────────────────────────────────────────────────────
  if (result.rarity) {
    var rarityLine = result.rarity.line;
    if (result.rarityOneInX) {
      rarityLine += ' Factor in color tone, limbal ring, iris pattern, and every personal marking, and roughly '
        + '<strong>' + formatOneInX(result.rarityOneInX) + '</strong> people share this exact combination.';
    }
    paras.push(rarityLine);
  }

  // ── Iris character ────────────────────────────────────────────────────────
  var ph = getPatternHint(result.brightness, result.saturation);
  if (ph) {
    var storyPatDescs = {
      'Vivid stroma — strong color saturation': 'The iris itself has a <strong>vivid, pigment-rich character</strong> — bold, saturated color that catches light and holds it. These are the eyes that read as striking even in a photograph.',
      'Saturated iris — pigment-rich':          'The iris is <strong>well-saturated and pigment-rich</strong> — color that looks vibrant and alive even in dim or indoor light.',
      'Soft, muted stroma':                     'The iris has a <strong>soft, understated character</strong> — gentle tones that reward a closer look rather than announcing themselves across the room.',
      'Deep, light-absorbing iris':             'The iris is <strong>deep and light-absorbing</strong> — a dark, quietly intense color that draws people in without giving everything away.',
      'Bright, light-reflecting iris':          'The iris is <strong>bright and light-reflective</strong> — open and luminous, almost as if it\'s lit from behind. Photographs beautifully.',
      'Balanced light and pigment':             'The iris has a <strong>naturally balanced character</strong> — neither too vivid nor too muted. Easy and appealing in any light.'
    };
    var storyPat = storyPatDescs[ph]
      || ('The iris character: <strong>' + ph.toLowerCase() + '</strong>.');
    if (result.fingerprint) {
      storyPat += ' Color fingerprint: ' + result.fingerprint.hex.toUpperCase() + ' — no two people share the same reading.';
    }
    paras.push(storyPat);
  }

  // ── Heterochromia ─────────────────────────────────────────────────────────
  if (result.hetero !== 'None') {
    var pupName = result.heteroPup ? (result.heteroPup.displayName || result.heteroPup.color.name) : null;
    var cilName = result.heteroCil ? (result.heteroCil.displayName || result.heteroCil.color.name) : null;
    if (result.hetero.indexOf('warmth') >= 0) {
      paras.push('The standout feature here is <strong>central heterochromia</strong> — a '
        + (pupName ? '<strong>' + pupName + '</strong>' : 'warm')
        + ' inner ring sits immediately around the pupil, then melts into a '
        + ((cilName || 'cooler') + ' outer iris').toLowerCase()
        + '. Sometimes called "sunflower eyes," this warm inner corona appears in roughly 10–15% of people. It\'s subtle enough that many people who have it have never noticed — yet unmistakable once you see it.');
    } else if (result.hetero.indexOf('lightness') >= 0) {
      paras.push('This eye has a <strong>lightness-gradient heterochromia</strong> — a '
        + (pupName ? '<strong>' + pupName + '</strong>' : 'brighter')
        + ' zone glows around the pupil, gradually deepening into a '
        + ((cilName || 'darker') + ' outer iris').toLowerCase()
        + '. It\'s a two-tone depth effect that gives the eye real dimension — the kind of detail that makes people lean in for a closer look.');
    } else if (result.hetero === 'Central') {
      paras.push('This is a <strong>true central heterochromia</strong> — two genuinely different colors in the same iris. '
        + (result.inner ? result.inner.name : 'One color') + ' in the inner ring, '
        + (result.outer ? result.outer.name.toLowerCase() : 'another') + ' beyond it, with a clear visible boundary between them. '
        + 'Most people who meet you will sense something striking about your eyes without being able to name exactly what it is.');
    } else {
      paras.push('A <strong>subtle heterochromia</strong> gives this iris a quiet two-tone quality — '
        + (result.inner ? result.inner.name.toLowerCase() : 'warmer') + ' in the inner iris, '
        + (result.outer ? result.outer.name.toLowerCase() : 'cooler') + ' toward the edge. '
        + 'Understated, but it adds real depth.');
    }
  }

  // ── Limbal ring or halo ───────────────────────────────────────────────────
  if (result.limbal !== 'None' && result.limbalColor) {
    var lstrength = result.limbal.toLowerCase();
    var lftype2   = result.limbalType || 'ring';
    var lc2       = result.limbalColor.name.toLowerCase();
    if (lftype2 === 'halo') {
      paras.push('There\'s a <strong>' + lstrength + ' ' + lc2 + ' halo</strong> glowing just inside the iris edge — a luminous inner border that makes the color feel lit from within. Halos are less talked about than limbal rings but are just as striking: they give the iris an inset, almost backlit quality that\'s impossible to fake.');
    } else if (result.limbal === 'Dramatic') {
      paras.push('A <strong>dramatic ' + lc2 + ' limbal ring</strong> frames the entire iris — bold, high-contrast natural eyeliner that never comes off. This is the feature that makes eyes look deep and unforgettable. Strong limbal rings are most striking in younger people and tend to soften gradually with age, which makes this one worth appreciating right now.');
    } else if (result.limbal === 'Strong') {
      paras.push('A <strong>strong ' + lc2 + ' limbal ring</strong> circles the iris — a sharp, high-contrast border that makes the eye color pop and gives the iris a crisp, defined look. This is the feature people are describing when they say someone has "intense eyes."');
    } else {
      paras.push('A <strong>' + lstrength + ' ' + lc2 + ' limbal ring</strong> traces the iris edge — present and polished, adding quiet definition without dominating the color itself.');
    }
  }

  // ── Sectoral heterochromia ────────────────────────────────────────────────
  if (result.sectoral) {
    var sc = result.sectoral;
    paras.push('A <strong>sectoral patch of ' + sc.color.name.toLowerCase() + '</strong> near '
      + sc.clock + " o'clock — a rare splash of a completely different color. "
      + 'Only about 1 in 1,000 people have one, and no two are ever in the same spot.');
  }

  // ── Iris freckles ─────────────────────────────────────────────────────────
  if (result.freckles && result.freckles.length) {
    var nf2 = result.freckles.length;
    if (nf2 === 1) {
      paras.push('A single <strong>iris freckle</strong> near ' + result.freckles[0].clock
        + " o'clock adds a detail that is entirely yours — a concentrated spot of melanin that's as permanent as a fingerprint and as individual as a name.");
    } else {
      var fclocks = result.freckles.slice(0, 3).map(function(f){ return f.clock + " o'clock"; }).join(', ');
      paras.push('<strong>' + nf2 + ' iris freckles</strong> dot the iris near ' + fclocks
        + (nf2 > 3 ? ' and ' + (nf2 - 3) + ' more' : '')
        + ' — concentrated melanin deposits that form a pattern completely unique to this eye. No two people share the same freckle map.');
    }
  }

  // ── Nothing beyond color detected ────────────────────────────────────────
  if (paras.length <= 2) {
    paras.push('No heterochromia, limbal ring, sectoral patches, or iris freckles were detected at this resolution. That doesn\'t mean none exist — subtle features sometimes need a closer crop or better lighting to surface. The color itself is still one-of-a-kind.');
  }

  // ── Rayid iris type ───────────────────────────────────────────────────────
  if (result.rayid && RAYID_META[result.rayid.label]) {
    paras.push(RAYID_META[result.rayid.label].story);
  }

  // ── Collarette ────────────────────────────────────────────────────────────
  if (result.collarette && result.collarette.label !== 'Indistinct') {
    var cLbl = result.collarette.label.toLowerCase();
    paras.push('The <strong>collarette</strong> — the autonomic nerve wreath — appears as a '
      + cLbl + ' jagged ring at roughly ' + result.collarette.radialPct + '% of the iris radius. '
      + 'This boundary marks the physiological divide between the inner <em>pupillary zone</em>, '
      + 'governed by the sphincter pupillae muscle, and the outer <em>ciliary zone</em>, governed '
      + 'by the dilator pupillae. Its irregular, frill-like edge reflects the uneven thickness of '
      + 'the iris stroma at this junction — a structural feature that is completely unique to each eye.');
  }

  // ── Eye shape ─────────────────────────────────────────────────────────────
  if (result.eyeShape) {
    var esStories = {
      Almond:     'The <strong>almond eye shape</strong> — tapered ends, moderate vertical opening, corner-to-corner line roughly horizontal — is the most anatomically common form. The inner (medial) and outer (lateral) canthus sit at nearly the same height, giving the eye a balanced look across most lighting conditions.',
      Round:      'The <strong>round eye shape</strong> has a generous vertical opening relative to its width — the iris is exposed more fully, and the upper or lower sclera may be visible at neutral gaze. Round eyes tend to emphasise iris colour and are particularly effective at conveying depth of expression.',
      Hooded:     'A <strong>hooded eye shape</strong> — the upper eyelid fold descends past the lid crease, partially draping over the iris when the eye is in neutral gaze. The crease is still visible (distinguishing hooded from monolid), but the upper iris is covered by skin rather than open lid. This is an anatomical trait unrelated to tiredness — it results from the relative depth of the brow ridge and the volume of the upper eyelid. Note: the upper iris region may be less fully sampled in this analysis.',
      Monolid:    'A <strong>monolid eye shape</strong> — the upper lid has no visible crease or fold, so the skin runs in a single smooth plane from brow to lash. Common in East Asian heritage, this is purely an anatomical variant reflecting the attachment of the levator palpebrae to the eyelid skin. The absence of a crease means the upper lid sits closer to the pupil than in a creased eye, and the upper iris zone may be partially covered. This analysis captures the visible iris region.',
      Upturned:   'An <strong>upturned (cat-eye) shape</strong> — the outer corner sits perceptibly higher than the inner corner. This positive canthal tilt is a distinctive structural feature associated with a "lifted" appearance at the lateral edge. The angle is fixed by the lateral canthal tendon and the orbital rim.',
      Downturned: 'A <strong>downturned eye shape</strong> — the outer corner drops below the inner corner. The gentle negative canthal tilt lends a soft, considered appearance at rest. This form is associated with a longer medial canthal tendon relative to the lateral anchor.',
      Narrow:     'A <strong>narrow eye opening</strong> — the visible aperture is compact relative to the width. This may reflect a naturally close upper and lower lid margin, a hooded brow ridge limiting visible lid height, or strong orbicularis tone. Iris colour is partially framed by the lash line even in open-eye gaze.'
    };
    if (esStories[result.eyeShape.label]) paras.push(esStories[result.eyeShape.label]);
  }

  // ── Closing note ──────────────────────────────────────────────────────────
  paras.push('<em style="color: var(--ink-dim); font-size:12px">The unique combination of your color, inner ring, limbal border, and personal markings has never appeared in exactly this way before — and never will again. Your eyes are one of a kind.</em>');

  paras.forEach(function(p){
    var el = document.createElement('p');
    el.innerHTML = p;
    box.appendChild(el);
  });
}
