'use strict';

// ======================= PALETTE =======================
var PALETTE = [
  // ── BLUE (32 entries: icy → deep navy) ──
  ['Blue','Arctic Mist','#E8F3FA'],['Blue','Porcelain Blue','#D6E6F2'],['Blue','Crystal Blue','#BFD8E8'],
  ['Blue','Ice Blue','#A8CDE0'],['Blue','Powder Blue','#92BDD6'],['Blue','Sky Blue','#7AAECB'],
  ['Blue','Periwinkle','#7EA4C8'],['Blue','Cornflower Blue','#6B96BF'],['Blue','True Blue','#5A87B2'],
  ['Blue','Cerulean','#4A78A5'],['Blue','Denim Blue','#3D6A98'],['Blue','Steel Blue','#4682B4'],
  ['Blue','Azure','#3070A0'],['Blue','Cobalt','#2860A0'],['Blue','Royal Blue','#1E508A'],
  ['Blue','Deep Blue','#1A4580'],['Blue','Sapphire','#143872'],['Blue','Navy','#0E2A5C'],
  ['Blue','Midnight Blue','#0A1F4A'],['Blue','Gunmetal Blue','#4A6480'],['Blue','Slate Blue','#5A7090'],
  ['Blue','Storm Blue','#3A5570'],['Blue','Twilight Harbor','#2E4A65'],['Blue','Indigo','#2A3F73'],
  ['Blue','Iris Blue','#5060A0'],['Blue','Wedgwood','#5B80A0'],['Blue','Aquamarine','#6ACCC0'],
  ['Blue','Teal Blue','#4AAAB0'],['Blue','Blue-Gray','#6080A0'],['Blue','Heather Blue','#7090B0'],
  ['Blue','Smoky Blue','#607A90'],['Blue','Pewter Blue','#708090'],
  ['Blue','Silver Blue','#8090A0'],['Blue','Steel Mist','#708898'],
  ['Blue','Glacial Gray','#6A7880'],['Blue','Haze Blue','#697986'],
  // ── GRAY (18 entries: silver → charcoal) ──
  ['Gray','Silver Mist','#D0D4DC'],['Gray','Pearl Gray','#C0C5CC'],['Gray','Dove Gray','#B0B5BC'],
  ['Gray','Cloud Gray','#A0A5AC'],['Gray','Ash Gray','#90969C'],['Gray','Smoke Gray','#80868C'],
  ['Gray','Dune Mist','#908880'],['Gray','Morning Fog','#808890'],
  ['Gray','Steel Gray','#608088'],['Gray','Flint','#505860'],['Gray','Graphite','#404850'],
  ['Gray','Charcoal','#384048'],['Gray','Thunderhead','#303840'],['Gray','Gun Metal','#485860'],
  ['Gray','Coastal Haze','#607080'],['Gray','Anvil','#506070'],['Gray','Evening Stone','#485868'],
  ['Gray','Iron Mist','#5A6068'],
  // ── GREEN (28 entries: pale mint → dark forest) ──
  ['Green','Mint Frost','#D0E8D4'],['Green','Pale Sage','#B8D4BC'],['Green','Sea Glass','#A0C4A8'],
  ['Green','Seafoam','#88B898'],['Green','Celadon','#78A888'],['Green','Sage','#70A078'],
  ['Green','Jade','#60986A'],['Green','Pistachio','#80A860'],['Green','Apple','#70A050'],
  ['Green','Fern','#608848'],['Green','Olive','#787848'],['Green','Oregano','#687040'],
  ['Green','Lichen','#708858'],['Green','Moss','#506040'],['Green','Rain Moss','#486038'],
  ['Green','Hunter','#406038'],['Green','Old Growth','#305830'],['Green','Emerald','#206848'],
  ['Green','Deep Emerald','#185838'],['Green','Deep Canopy','#204830'],['Green','Pine','#284838'],
  ['Green','Teal','#387868'],['Green','Deep Tide','#286058'],['Green','Malachite','#308060'],
  ['Green','Viridian','#408068'],['Green','Eucalyptus','#608878'],['Green','Autumn Green','#788848'],
  ['Green','Bayou','#506840'],
  // ── HAZEL (24 entries: golden-green → dark brown-green) ──
  ['Hazel','Warm Gold','#C8A870'],['Hazel','Honey Gold','#B89060'],['Hazel','Sandy Hazel','#A88050'],
  ['Hazel','Light Hazel','#987040'],['Hazel','Golden Hazel','#906838'],['Hazel','Warm Hazel','#886030'],
  ['Hazel','Hazel','#806028'],['Hazel','Autumn Hazel','#786020'],
  ['Hazel','Copper Hazel','#885830'],['Hazel','Rich Hazel','#705028'],['Hazel','Harvest Brown','#604820'],
  ['Hazel','Deep Hazel','#584018'],['Hazel','Cedarwood','#788848'],['Hazel','Sage Ember','#708040'],
  ['Hazel','Mossy Hazel','#687038'],['Hazel','Prairie Hazel','#787040'],['Hazel','Forest Hazel','#606838'],
  ['Hazel','Warm Moss','#706838'],['Hazel','Driftwood','#686038'],['Hazel','Bronze','#886040'],
  ['Hazel','Antique Gold','#A07840'],['Hazel','Caramel','#987848'],['Hazel','Toffee','#885A38'],
  // ── AMBER (20 entries: champagne → deep amber) ──
  ['Amber','Champagne','#F0DFBA'],['Amber','Pale Gold','#E8CF98'],['Amber','Warm Cream','#E0C080'],
  ['Amber','Honey','#D8B060'],['Amber','Gold','#D0A040'],['Amber','Topaz','#C89030'],
  ['Amber','Amber','#C08020'],['Amber','Deep Gold','#B07018'],['Amber','Burnt Gold','#A86018'],
  ['Amber','Cognac','#A05810'],['Amber','Tawny','#985010'],['Amber','Copper','#904808'],
  ['Amber','Butterscotch','#C89048'],['Amber','Caramel Gold','#B88040'],['Amber','Warm Amber','#B87030'],
  ['Amber','Bronze Gold','#A87028'],['Amber','Tiger Eye','#B87020'],['Amber','Tortoise','#987010'],
  ['Amber','Warm Tawny','#906018'],['Amber','Smoked Honey','#885010'],['Amber','Amber Hazel','#906828'],
  // ── BROWN (56 entries: tan → near-black) ──
  ['Brown','Ivory','#E8D8B8'],['Brown','Cream','#D8C8A0'],['Brown','Linen','#C8B888'],
  ['Brown','Sand','#B8A870'],['Brown','Wheat','#A89858'],['Brown','Tan','#988848'],
  ['Brown','Savanna','#908040'],['Brown','Warm Tan','#987840'],['Brown','Golden Oak','#886830'],
  ['Brown','Caramel Brown','#785820'],['Brown','Cacao','#705018'],['Brown','Hazelnut','#684810'],
  ['Brown','Chestnut','#604010'],['Brown','Cinnamon','#703818'],['Brown','Russet','#703010'],
  ['Brown','Auburn','#682818'],['Brown','Mahogany','#602010'],['Brown','Cognac','#582018'],
  ['Brown','Sienna','#703010'],['Brown','Burnt Sienna','#682808'],['Brown','Dark Oak','#604020'],
  ['Brown','Aged Oak','#584018'],['Brown','Walnut','#503010'],['Brown','Rich Walnut','#482808'],
  ['Brown','Midnight Walnut','#402008'],['Brown','Chocolate','#381808'],['Brown','Bittersweet','#301008'],
  ['Brown','Espresso','#281008'],['Brown','Mocha','#301808'],['Brown','French Roast','#281008'],
  ['Brown','Coffee','#201008'],['Brown','Darkroast','#180808'],['Brown','Obsidian','#100808'],
  ['Brown','Starless Night','#180C08'],['Brown','Dark Timber','#200C08'],['Brown','Aged Mahogany','#281008'],
  ['Brown','Rosewood','#381810'],['Brown','Autumn Ember','#401808'],['Brown','Burnished Copper','#502010'],
  ['Brown','Fired Earth','#582018'],['Brown','Adobe Canyon','#604028'],['Brown','Terracotta','#703028'],
  ['Brown','Adobe','#784030'],['Brown','Terra Rosa','#683028'],['Brown','Garnet Wood','#602018'],
  ['Brown','Warm Chestnut','#583018'],['Brown','Mink','#705050'],['Brown','Sable','#604040'],
  ['Brown','River Pelt','#706050'],['Brown','Driftwood Dusk','#503838'],['Brown','Worn Leather','#402828'],
  ['Brown','Heathland','#504030'],['Brown','River Stone','#483828'],['Brown','Earth Brown','#504030'],
  ['Brown','Forest Floor','#483830'],['Brown','Ancient Oak','#402818'],
  // ── VIOLET (20 entries: lavender → deep violet) ──
  ['Violet','Lilac Mist','#D8C8E8'],['Violet','Pale Lavender','#C8B0D8'],['Violet','Lavender','#B898C8'],
  ['Violet','Soft Violet','#A880B8'],['Violet','Mauve','#9870A8'],['Violet','Dusty Violet','#886098'],
  ['Violet','Violet','#785088'],['Violet','Warm Violet','#684878'],['Violet','Deep Violet','#583868'],
  ['Violet','Plum','#483058'],['Violet','Midnight Plum','#382048'],['Violet','Grape','#502858'],
  ['Violet','Amethyst','#806098'],['Violet','Purple','#705888'],['Violet','Iris','#808098'],
  ['Violet','Blue Violet','#6068A8'],['Violet','Indigo Violet','#485098'],['Violet','Twilight','#505070'],
  ['Violet','Storm Violet','#486080'],['Violet','Vesper','#405068']
]; // palette array end

function hexToRgb(h){ var n=parseInt(h.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function srgbLin(c){ c=c/255; return c<=0.04045 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); }
function rgbLab(r,g,b){
  var R=srgbLin(r), G=srgbLin(g), B=srgbLin(b);
  var X=(R*0.4124564+G*0.3575761+B*0.1804375)*100;
  var Y=(R*0.2126729+G*0.7151522+B*0.0721750)*100;
  var Z=(R*0.0193339+G*0.1191920+B*0.9503041)*100;
  var Xn=95.047, Yn=100, Zn=108.883;
  function f(t){ return t>0.008856 ? Math.cbrt(t) : (7.787*t + 16/116); }
  var fx=f(X/Xn), fy=f(Y/Yn), fz=f(Z/Zn);
  return [116*fy-16, 500*(fx-fy), 200*(fy-fz)];
}
function dE(a,b){ return Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]); }
function rgbHsv(r,g,b){
  r/=255; g/=255; b/=255;
  var mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn, h=0;
  if (d){ if (mx===r) h=((g-b)/d)%6; else if (mx===g) h=(b-r)/d+2; else h=(r-g)/d+4; h*=60; if (h<0) h+=360; }
  return [h, mx ? d/mx : 0, mx];
}

PALETTE.forEach(function(p){ var rgb=hexToRgb(p[2]); p.cat=p[0]; p.name=p[1]; p.hex=p[2]; p.rgb=rgb; p.lab=rgbLab(rgb[0],rgb[1],rgb[2]); });
// ===== Eye-color rarity (global distribution, approximate) =====
// Sources: published prevalence surveys synthesized — used here for product
// copy, not clinical claims. Numbers are reasonable approximations.
var RARITY = {
  'Brown':  { pct: 75,   label: 'Common',          line: 'Roughly 3 in 4 people on Earth have brown eyes — the most common color in the world.' },
  'Blue':   { pct: 9,    label: 'Uncommon',        line: 'About 1 in 11 people have blue eyes — concentrated in northern Europe and increasingly rare worldwide.' },
  'Hazel':  { pct: 5,    label: 'Uncommon',        line: 'About 1 in 20 people have hazel eyes — a true crossroads color that shifts in different light.' },
  'Amber':  { pct: 5,    label: 'Uncommon',        line: 'About 1 in 20 people have amber eyes — a single dominant gold-yellow tone, rarer than people realize.' },
  'Gray':   { pct: 3,    label: 'Rare',            line: 'About 1 in 33 people have true gray eyes — the rarest of the "common" colors.' },
  'Green':  { pct: 2,    label: 'Rare',            line: 'About 1 in 50 people have green eyes — the rarest natural eye color globally.' },
  'Violet': { pct: 0.1,  label: 'Extraordinary',   line: 'Fewer than 1 in 1,000 people have violet eyes — a vanishingly rare optical effect.' },
};

// ===== Rarity helpers =====

function _addCommas(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Format "1 in X" — rounds to sensible sig-figs so it reads naturally
function formatOneInX(n) {
  if (n >= 1000000) return '1 in 1,000,000+';
  if (n >= 100000) return '1 in ' + _addCommas(Math.round(n / 10000) * 10000);
  if (n >= 10000)  return '1 in ' + _addCommas(Math.round(n / 1000) * 1000);
  if (n >= 1000)   return '1 in ' + _addCommas(Math.round(n / 100) * 100);
  return '1 in ' + n;
}

// ===== Composite rarity — multiplicative "1 in X" model =====
// Each measurable trait narrows the population that shares this exact profile.
// Probability = product of independent trait fractions → "1 in X" = 1 / probability.
// Also returns legacy 0–100 score (used in story view prose).
function computeRarityScore(result) {
  var cat = result.overall ? result.overall.cat : 'Brown';

  // ── Multiplicative model ──────────────────────────────────────────────────
  var prob = 1.0;
  var factorWeights = [];   // { label, w } — sorted rarest-first for display

  // 1. Eye color category
  var colorProb = { Brown: 0.750, Blue: 0.090, Hazel: 0.050, Amber: 0.050,
                    Gray: 0.030, Green: 0.020, Violet: 0.001 };
  var cp = colorProb[cat] || 0.050;
  prob *= cp;
  if (cp <= 0.050) factorWeights.push({ label: cat + ' eye color', w: cp });

  // 2. Brightness sub-category (Dark / Medium / Bright — ~3 equal bands)
  if (result.brightness) prob *= 0.34;

  // 3. Saturation sub-category (Muted / Soft / Vivid — ~3 equal bands)
  if (result.saturation) prob *= 0.34;

  // 4. Heterochromia
  if (result.hetero && result.hetero !== 'None') {
    var hp = (result.hetero === 'Central') ? 0.06
           : (result.hetero.indexOf('warmth') >= 0 || result.hetero.indexOf('lightness') >= 0) ? 0.10
           : 0.08;
    prob *= hp;
    factorWeights.push({ label: (result.hetero === 'Central' ? 'Central heterochromia' : 'Color-gradient heterochromia'), w: hp });
  }

  // 5. Sectoral heterochromia (independent of central/gradient)
  if (result.sectoral) {
    prob *= 0.008;
    factorWeights.push({ label: 'Sectoral heterochromia', w: 0.008 });
  }

  // 6. Limbal ring strength
  var limbalProb = { Faint: 0.70, Soft: 0.45, Moderate: 0.25, Strong: 0.10, Dramatic: 0.04 };
  if (result.limbal && limbalProb[result.limbal]) {
    var lp = limbalProb[result.limbal];
    prob *= lp;
    if (lp <= 0.25) factorWeights.push({ label: result.limbal.toLowerCase() + ' limbal ring', w: lp });
  }

  // 7. Rayid iris pattern
  var rayidProb = { Flower: 0.30, Stream: 0.30, Jewel: 0.20, Shaker: 0.20 };
  if (result.rayid && result.rayid.label && rayidProb[result.rayid.label]) {
    var rp = rayidProb[result.rayid.label];
    prob *= rp;
    factorWeights.push({ label: result.rayid.label + ' iris pattern', w: rp });
  }

  // 8. Collarette prominence
  var collProb = { Prominent: 0.25, Faint: 0.40 };
  if (result.collarette && collProb[result.collarette.label]) {
    var cpp = collProb[result.collarette.label];
    prob *= cpp;
    if (cpp <= 0.30) factorWeights.push({ label: result.collarette.label.toLowerCase() + ' inner ring', w: cpp });
  }

  // 9. Iris freckles
  if (result.freckles && result.freckles.length) {
    var fp = result.freckles.length >= 3 ? 0.05 : 0.20;
    prob *= fp;
    factorWeights.push({ label: result.freckles.length + ' iris freckle' + (result.freckles.length > 1 ? 's' : ''), w: fp });
  }

  // Sort rarest first, show top 3
  factorWeights.sort(function(a, b) { return a.w - b.w; });
  var factors = factorWeights.slice(0, 3).map(function(f) { return f.label; });

  // Cap at 1 in 1,000,000
  var oneInX = Math.min(1000000, Math.max(2, Math.round(1 / Math.max(prob, 0.000001))));

  // ── Legacy 0–100 score (story view prose) ────────────────────────────────
  var base = { Brown: 0, Blue: 40, Hazel: 45, Amber: 50, Gray: 65, Green: 75, Violet: 95 };
  var score = base[cat] || 0;
  if (result.hetero && result.hetero !== 'None') {
    if (result.hetero.indexOf('warmth') >= 0 || result.hetero.indexOf('lightness') >= 0) score += 8;
    else if (result.hetero === 'Central') score += 12;
    else score += 6;
  }
  if (result.sectoral) score += 15;
  var limbalBonus = { Faint: 2, Soft: 4, Moderate: 7, Strong: 12, Dramatic: 18 };
  if (result.limbal && limbalBonus[result.limbal]) {
    var lb = limbalBonus[result.limbal];
    if ((result.userAge || 0) > 40) lb = Math.round(lb * 1.3);
    score += lb;
  }
  if (result.rayid && result.rayid.label) score += (result.rayid.label === 'Jewel' || result.rayid.label === 'Shaker') ? 6 : 3;
  if (result.collarette && result.collarette.label === 'Prominent') score += 4;
  if (result.freckles && result.freckles.length) score += Math.min(8, result.freckles.length * 2);
  score = Math.min(100, Math.round(score));

  return { score: score, oneInX: oneInX, factors: factors };
}

function rarityScoreLabel(score) {
  if (score >= 90) return 'Extraordinary';
  if (score >= 75) return 'Very Rare';
  if (score >= 60) return 'Rare';
  if (score >= 45) return 'Uncommon';
  if (score >= 25) return 'Somewhat Common';
  return 'Common';
}

// ===== Vibe descriptors per category (light to dark) =====
// Pick one based on the dominant outer-iris L* value.
var VIBES = {
  'Brown':  ['Warm ivory','Sandy dune','Golden caramel','Whiskey-soaked','Rich chestnut','Velvet brown','Espresso depth','Near-black depth'],
  'Blue':   ['Glacial mist','Arctic ice','Powder sky','Cornflower','Denim wash','Steel water','Stormcloud blue','Midnight ink'],
  'Gray':   ['Silver cloud','Pearl mist','Dove gray','Smoke and ash','Worn pewter','Smoke and silver','Iron slate','Dark graphite'],
  'Hazel':  ['Warm honey','Golden wheat','Autumn ember','Chestnut shimmer','Forest floor','Whiskey-amber','Bark and bronze','Dark loam'],
  'Amber':  ['Champagne glow','Pale gold','Sunlit honey','Honeyed gold','Maple warmth','Cognac warmth','Tawny ember','Burnt amber'],
  'Green':  ['Sea-glass','Pale sage','Spring moss','Celadon mist','Forest moss','Deep jade','Emerald depth','Dark forest'],
  'Violet': ['Lavender mist','Pale lilac','Soft amethyst','Twilight mauve','Dusty violet','Deep violet','Plum depth','Indigo bloom'],
};

function getVibe(cat, lab){
  var arr = VIBES[cat] || ['Singular'];
  var L = lab ? lab[0] : 50;
  var b = lab ? lab[2] : 0;
  // Cool-gray variant: Gray eyes with a blue bias (b* < -2) get vibe names that
  // signal their blue-gray nature — photo lighting often flattens blue eyes to gray pixels.
  if (cat === 'Gray' && b < -2){
    arr = ['Arctic silver','Ice mist','Pale blue steel','Blue-gray haze','Steel blue','Cold iron','Blue steel','Midnight slate'];
  }
  // map L (0-100) into the array length
  var idx = Math.max(0, Math.min(arr.length-1, Math.floor((100 - L) / (100/arr.length))));
  return arr[idx];
}

// ===== Iris pattern hint from saturation + brightness =====
// Rough heuristic — true Rayid pattern classification is v1.1's CoreML target.
function getPatternHint(brightness, saturation){
  // brightness 0..255, saturation 0..1 (these are the analyzer's existing fields)
  if (saturation > 0.30 && brightness > 100) return 'Vivid stroma — strong color saturation';
  if (saturation > 0.25) return 'Saturated iris — pigment-rich';
  if (saturation < 0.10) return 'Soft, muted stroma';
  if (brightness < 70) return 'Deep, light-absorbing iris';
  if (brightness > 140) return 'Bright, light-reflecting iris';
  return 'Balanced light and pigment';
}

function rgbToHex(rgb){
  function p(n){ var s = n.toString(16); return s.length===1 ? '0'+s : s; }
  return '#' + p(rgb[0]) + p(rgb[1]) + p(rgb[2]);
}
function nearestPal(rgb){
  var lab=rgbLab(rgb[0],rgb[1],rgb[2]), best=null, bd=Infinity;
  var bestBlue=null, bdBlue=Infinity, bestGray=null, bdGray=Infinity;
  var bestGreen=null, bdGreen=Infinity, bestHazel=null, bdHazel=Infinity;
  for (var i=0;i<PALETTE.length;i++){
    var d=dE(lab, PALETTE[i].lab);
    if (d<bd){bd=d; best=PALETTE[i];}
    if (PALETTE[i].cat==='Blue'  && d<bdBlue){bdBlue=d; bestBlue=PALETTE[i];}
    if (PALETTE[i].cat==='Gray'  && d<bdGray){bdGray=d; bestGray=PALETTE[i];}
    if (PALETTE[i].cat==='Green' && d<bdGreen){bdGreen=d; bestGreen=PALETTE[i];}
    if (PALETTE[i].cat==='Hazel' && d<bdHazel){bdHazel=d; bestHazel=PALETTE[i];}
  }
  var aStar = lab[1];
  var bStar = lab[2];
  // b* tiebreaker: blue eyes photographed under frontal lighting register as gray pixels.
  // If the nearest match is Gray but b* < -2 (any blue bias) and the nearest Blue entry
  // is within 5 Delta-E, the photo-lighting effect is likely the cause — prefer Blue.
  if (best && best.cat==='Gray' && bestBlue && bStar < -2 && (bdBlue - bdGray) < 5){
    best = bestBlue; bd = bdBlue;
  }
  // a* tiebreaker: green/teal eyes can land in Brown when they are dark or
  // when WB correction warms them. Lab a* < -2 means the pixel has a
  // measurable green component — no brown iris ever has negative a*. If the
  // nearest match landed in Brown, redirect to the nearest Green or Hazel
  // entry (whichever is closer in Lab space).
  // Guard b* > -10: blue irises can also have a* slightly negative (cool side of
  // neutral), but they have strongly negative b* (b* ≈ -20 to -50). Without this
  // guard, dark blue irises that happen to match a near-black brown palette entry
  // get incorrectly redirected to Green via the a* path.
  if (best && best.cat==='Brown' && aStar < -2 && bStar > -10) {
    if (bestGreen && bestHazel) {
      if (bdGreen <= bdHazel) { best = bestGreen; bd = bdGreen; }
      else                     { best = bestHazel; bd = bdHazel; }
    } else if (bestGreen)  { best = bestGreen;  bd = bdGreen;  }
    else if (bestHazel)    { best = bestHazel;  bd = bdHazel;  }
  }
  return {entry:best, distance:bd};
}
// ===== Random-Forest Colour Classifier (replaces 5-NN) =====
// 30 trees, max_depth=6, trained on 597 GT images + SMOTE augmentation.
// 5-fold CV accuracy: 74.4% LOO (vs 72.9% for flat k-NN).
// Feature vector: [outerL, outerA, outerB, osB, innerB, rsat*100, hsvH/3.6, hsvS*100]
//
// RF_DATA: packed uint8 tree structure.
//   Each node = 4 bytes [feature_idx, threshold_u8, left_child, right_or_class]
//   feature_idx=255 marks a leaf; right_or_class = winning class (0-5).
// RF_OFFSETS: byte offset of each tree's root in RF_DATA.
// RF_MIN/RF_MAX: normalization range (feature_raw → 0-255 mapping).

var RF_DATA = null;  // lazy-decoded Uint8Array
var _RF_B64 = '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';
var RF_OFFSETS = [0, 1360, 2656, 4336, 5440, 6928, 8448, 9648, 10944, 12496, 13824, 14992, 16576, 18064, 19552, 20944, 22240, 23312, 24768, 25936, 27296, 28784, 30240, 31536, 32736, 33904, 34976, 36176, 37600, 38896];
var RF_MIN = [14.68,-24.26,-52.85,-55.71,-43.3,-1218,0,1.4];
var RF_MAX = [75.4,35.57,61.7,65.65,66.71,96.4,99.28,96.4];
var RF_CATS = ['amber','blue','brown','green','grey','hazel'];

// Classify an iris using the 30-tree random forest.
// Interface identical to knnColor() for drop-in replacement.
function knnColor(outerMeanRgb, osMean, t3InnerLab, hsvOuter) {
  // Lazy-decode tree data on first call
  if (!RF_DATA) {
    var bin = atob(_RF_B64), u8 = new Uint8Array(bin.length);
    for (var _i=0;_i<bin.length;_i++) u8[_i]=bin.charCodeAt(_i);
    RF_DATA = u8;
  }
  // Compute normalised feature vector (same as previous k-NN)
  var lab = rgbLab(outerMeanRgb[0], outerMeanRgb[1], outerMeanRgb[2]);
  var osB = osMean ? rgbLab(osMean[0], osMean[1], osMean[2])[2] : lab[2];
  var innerB = t3InnerLab ? t3InnerLab[2] : 0;
  var rsat = outerMeanRgb[0]>0 ? (outerMeanRgb[0]-outerMeanRgb[2])/outerMeanRgb[0]*100 : 0;
  var fv = [lab[0],lab[1],lab[2],osB,innerB,rsat,hsvOuter[0]/3.6,hsvOuter[1]*100];
  var fvn = fv.map(function(v,fi){
    var rng=RF_MAX[fi]-RF_MIN[fi];
    return rng>0?Math.max(0,Math.min(255,Math.round((v-RF_MIN[fi])/rng*255))):128;
  });
  // Vote across 30 trees
  var votes=[0,0,0,0,0,0];
  for (var ti=0;ti<30;ti++) {
    var node=0, base=RF_OFFSETS[ti];
    while (true) {
      var bp=base+node*4, fi=RF_DATA[bp];
      if (fi===255){votes[RF_DATA[bp+3]]++;break;}
      node = fvn[fi]<=RF_DATA[bp+1] ? RF_DATA[bp+2] : RF_DATA[bp+3];
    }
  }
  var bv=0,bc=0;
  for(var ci=0;ci<6;ci++)if(votes[ci]>bv){bv=votes[ci];bc=ci;}
  return {cat:RF_CATS[bc],votes:bv};
}
// ===== 2-Stage Cascade Random Forest Colour Classifier =====
// Architecture: Stage1 (dark/light) → Stage2a (amber/brown/hazel) | Stage2b (blue/grey/green)
// LOO 5-fold CV: 74.9% (vs 72.9% flat k-NN, 74.4% flat RF).
// Total model: ~20KB — 3 RF classifiers, 30 trees each, max_depth=6, SMOTE-augmented.
// Feature: [outerL,outerA,outerB,osB,innerB,rsat*100,hsvH/3.6,hsvS*100]
//
// Each model stored as packed uint8: 4 bytes/node [feat,thresh,left,right].
// feat=255 marks leaf; right byte = class index for that model.
// Dark classes: 0=amber,1=brown,2=hazel → mapped to 6-class indices 0,2,5
// Light classes: 0=blue,1=grey,2=green → mapped to 6-class indices 1,4,3

var _CAS = null; // lazy-decoded {s1,s2a,s2b} Uint8Arrays
var _CAS_B = {
  s1:  'BigBHAKCAgkBcwMIBxgEBwFlBQb/AAAB/wAAAP8AAAD/AAABAW4KFwSTCxIBZwwPAoYNDv8AAAD/AAAABIwQEf8AAAH/AAAABh0TFgduFBX/AAAB/wAAAP8AAAEAHRgbBhgZGv8AAAH/AAAA/wAAAQR7HSgG4B4nAowfJAJpICH/AAAABHMiI/8AAAD/AAAAByklJv8AAAH/AAAA/wAAAQFNKTIF6iotALYrLP8AAAH/AAAABJ0uL/8AAAAHWTAx/wAAAP8AAAEGNzM4BJI0Nf8AAAABVDY3/wAAAf8AAAAHDzk8BKE6O/8AAAH/AAAAAWM9Pv8AAAH/AAABAnYBGARwAg0AEgME/wAAAQJ0BQoCbwYH/wAAAAamCAn/AAAA/wAAAAXtCwz/AAAA/wAAAQCIDhcBNQ8Q/wAAAAR8ERQHHhIT/wAAAf8AAAADdhUW/wAAAP8AAAH/AAAABiAZMARsGiUAaxsgAoYcHwdVHR7/AAAA/wAAAf8AAAEGESEkAHQiI/8AAAD/AAAB/wAAAAcwJisEkScqA38oKf8AAAH/AAAA/wAAAQdbLC8Edy0u/wAAAf8AAAH/AAABACIxNAXyMjP/AAAB/wAAAAKONTwEfDY5A5I3OP8AAAD/AAABAKE6O/8AAAH/AAAAA6A9Pv8AAAABVD9A/wAAAP8AAAEGIQEQAoYCCwYRAwgDeQQHBHIFBv8AAAD/AAAB/wAAAQcZCQr/AAAB/wAAAAAnDA8GGA0O/wAAAf8AAAD/AAABBr0RKAN2EhsDbBMU/wAAAAamFRgBTBYX/wAAAP8AAAAAdBka/wAAAf8AAAACeRwjAHgdIAcRHh//AAAA/wAAAQFVISL/AAAB/wAAAALPJCcEoCUm/wAAAP8AAAH/AAABAnIpLARjKiv/AAAA/wAAAf8AAAEF8AEcBIMCDwAcAwT/AAABBGMFCgapBgf/AAAABsAICf8AAAH/AAAAAXMLDgcSDA3/AAAA/wAAAP8AAAEGbhAXBLARFgCbEhUHRhMU/wAAAf8AAAD/AAAA/wAAAAXqGBn/AAABA3UaG/8AAAD/AAABAC8dIgYYHh//AAABA5ogIf8AAAH/AAAABiUjKgF2JCkDjSUm/wAAAAKiJyj/AAAB/wAAAf8AAAEF9iswBJ0sLf8AAAAHYS4v/wAAAf8AAAAF9zEy/wAAAf8AAAAGIAEWA4sCDQJ8AwYHEQQF/wAAAP8AAAEEpwcMBhMICf8AAAEHSQoL/wAAAP8AAAH/AAABApAOFQF5DxQBdRATBfIREv8AAAH/AAAB/wAAAP8AAAH/AAABA3EXIAXsGB8CZhka/wAAAABzGxz/AAAAAHwdHv8AAAH/AAAA/wAAAQbgISoAHyIj/wAAAQSeJCcBXiUm/wAAAP8AAAAAlSgp/wAAAf8AAAD/AAABAWoBKgYiAg0F7QME/wAAAASSBQwDjAYJBIIHCP8AAAH/AAAABfIKC/8AAAH/AAAA/wAAAQdGDh0EfA8WBGgQEwKEERL/AAAA/wAAAQc/FBX/AAAA/wAAAQODFxoBTRgZ/wAAAf8AAAAEmxsc/wAAAP8AAAEElh4jAS0fIgEqICH/AAAA/wAAAP8AAAAHZyQnAMclJv8AAAH/AAAABfcoKf8AAAD/AAAAA2srLP8AAAADjS00AokuMwRbLzD/AAAAA3gxMv8AAAH/AAAB/wAAAAOdNToBcjY5AE83OP8AAAD/AAAB/wAAAf8AAAECfAEWA3ECBwAfAwYCaQQF/wAAAP8AAAH/AAAAAXMIFQByCQ4DgAoNBHELDP8AAAD/AAAB/wAAAQJtDxICahAR/wAAAP8AAAEBVBMU/wAAAP8AAAD/AAABB18XLAYgGB8GExka/wAAAQSJGx4HMxwd/wAAAP8AAAH/AAABAosgJwBIISQChiIj/wAAAf8AAAEBYyUm/wAAAP8AAAAEnSgp/wAAAAFCKiv/AAAA/wAAAQYmLTQBbi4zAqEvMgOZMDH/AAAA/wAAAf8AAAH/AAABATw1Nv8AAAAGKzc4/wAAAACAOTr/AAAB/wAAAAOBAR4DdwIRACEDBgNpBAX/AAAA/wAAAQR8BwwAUggLAmsJCv8AAAD/AAAA/wAAAAEyDQ7/AAAABecPEP8AAAH/AAAAAGsSGwRmExT/AAAAA3oVGAF0Fhf/AAAB/wAAAQYyGRr/AAAA/wAAAQSIHB3/AAAA/wAAAQYiHy4F8CAnA40hJgJ+IiP/AAABBhckJf8AAAH/AAAA/wAAAQF2KC0DiCkq/wAAAAYgKyz/AAAB/wAAAf8AAAEANC8yAo0wMf8AAAH/AAAAAoYzOgSANDcAgzU2/wAAAf8AAAAGJjg5/wAAAP8AAAEBTDs+AI48Pf8AAAD/AAAAByM/QP8AAAD/AAAABiABFAFuAgsF8AMIA4UEBf8AAAAAVQYH/wAAAf8AAAAHeQkK/wAAAf8AAAABdgwTBG0NDv8AAAAGGw8SB38QEf8AAAH/AAAA/wAAAf8AAAECZhUW/wAAAAX5FyABcxgfA3cZHAFLGhv/AAAA/wAAAAXpHR7/AAAB/wAAAP8AAAH/AAABBfEBJARpAg0F6gME/wAAAAcOBQb/AAAAA3wHCgcYCAn/AAAB/wAAAAceCwz/AAAA/wAAAQYgDhcDeQ8SAFoQEf8AAAH/AAAAAoATFP8AAAEHMBUW/wAAAf8AAAEBYRgdA54ZHAFYGhv/AAAA/wAAAP8AAAACeR4hBesfIP8AAAH/AAABA4YiI/8AAAD/AAABB5YlPgYnJjMEjCcuB18oKwF4KSr/AAAA/wAAAQYgLC3/AAAB/wAAAAYiLzD/AAABB3kxMv8AAAH/AAAABfI0OQOcNTb/AAABAqU3OP8AAAD/AAABBqA6PQeLOzz/AAAA/wAAAP8AAAEDwz9A/wAAAQX4QUQBJUJD/wAAAP8AAAEDyEVIBflGR/8AAAD/AAAB/wAAAQFxASYDgAITA3cDDAAfBAcHQQUG/wAAAf8AAAAEcwgJ/wAAAAaFCgv/AAAA/wAAAQcRDQ7/AAAAAngPEgRwEBH/AAAA/wAAAf8AAAADqxQjBJ4VHAYgFhkDjRcY/wAAAP8AAAEBLRob/wAAAP8AAAAAUx0gAEUeH/8AAAH/AAAAAKYhIv8AAAH/AAAAAU0kJf8AAAD/AAABBeonKgJmKCn/AAAA/wAAAQcRKyz/AAAABIMtMgF3LjEEgi8w/wAAAf8AAAD/AAAB/wAAAQXwARACaQID/wAAAANxBAcAIgUG/wAAAf8AAAABcwgPBIoJDAc/Cgv/AAAA/wAAAAY2DQ7/AAAB/wAAAP8AAAEF9BEgAVcSFwSWExT/AAAAAq4VFv8AAAH/AAAAB20YHwFkGRwEoRob/wAAAP8AAAECjR0e/wAAAf8AAAH/AAAAB5YhKgO5IicCoiMmBiYkJf8AAAH/AAAA/wAAAQYlKCn/AAAB/wAAAAPFKyz/AAABA8gtLv8AAAD/AAABAWoBGgN3AgkEcQME/wAAAAdABQb/AAAABeQHCP8AAAD/AAABAUgKEQJ4Cwz/AAABBKINDv8AAAAF9Q8Q/wAAAP8AAAECpBIZBiATFgXuFBX/AAAA/wAAAQZtFxj/AAAA/wAAAf8AAAECaRsc/wAAAAXvHSQHHB4jBG8fIgAxICH/AAAB/wAAAP8AAAH/AAABBhQlJv8AAAEATScqAXgoKf8AAAH/AAAB/wAAAQYiARgHMAIPAnkDBP8AAAEAYAUKADoGCQXuBwj/AAAA/wAAAf8AAAAChwsOAHYMDf8AAAD/AAAB/wAAAAFvEBcGGhES/wAAAAYdExYEnhQV/wAAAf8AAAD/AAAB/wAAAQFzGSoCaRob/wAAAAN3HCMHPx0gBqYeH/8AAAD/AAAAA24hIv8AAAD/AAABBJ0kJwKLJSb/AAAA/wAAAASyKCn/AAAB/wAAAAauKyz/AAAAAmYtLv8AAAD/AAABAXMBIAN3Ag0GiQMMBI4ECQJqBQgCaQYH/wAAAP8AAAD/AAAAAUsKC/8AAAH/AAAA/wAAAAcRDhcCfA8UBrIQEf8AAAAHARIT/wAAAP8AAAEHDRUW/wAAAf8AAAACeBgbAVwZGv8AAAH/AAAAADAcHf8AAAAHGh4f/wAAAf8AAAAESyEi/wAAAAXoIyT/AAAA/wAAAQXxASwHRgIfBe8DEgJxBAsAuQUIBx0GB/8AAAD/AAAAAMEJCv8AAAH/AAAABHsMDwAZDQ7/AAAB/wAAAAJ/EBH/AAAB/wAAAAKHExgEfxQXADIVFv8AAAH/AAAA/wAAAQSSGRwBbRob/wAAAP8AAAEEsB0e/wAAAf8AAAEARiArAS4hJgXpIiUDbyMk/wAAAP8AAAH/AAAABfAnKP8AAAAGmikq/wAAAP8AAAH/AAAAAWAtPAAmLjEBVS8w/wAAAf8AAAAGJTI3BiIzNP8AAAEHajU2/wAAAf8AAAACqDg5/wAAAAKsOjv/AAAB/wAAAAFxPUQCmz5DBIQ/QgKQQEH/AAAA/wAAAf8AAAD/AAABA4xFSAR/Rkf/AAAB/wAAAP8AAAEF8QEgAnECDwXrAw4DcQQJBeoFBv8AAAAGqAcI/wAAAP8AAAEEcQoL/wAAAAXnDA3/AAAB/wAAAf8AAAEGIhAXBGkREv8AAAABZxMWBfAUFf8AAAD/AAAB/wAAAQFvGB8EexkcBxYaG/8AAAD/AAAAByEdHv8AAAH/AAAA/wAAAQOTISL/AAABA5wjKgX1JCkATCUoBhkmJ/8AAAH/AAAA/wAAAf8AAAEBWiswBJ0sLf8AAAAGOC4v/wAAAf8AAAADnTE0ApkyM/8AAAH/AAAB/wAAAQYiASYF8AIVAFgDCgFzBAkARgUG/wAAAABKBwj/AAAB/wAAAP8AAAEAegsOAWUMDf8AAAH/AAAAAI4PEgcaEBH/AAAA/wAAAQKHExT/AAAB/wAAAAXzFh0HWBcY/wAAAQdZGRr/AAAABhkbHP8AAAH/AAAABJ0eH/8AAAECmyAjAC8hIv8AAAD/AAABBfUkJf8AAAH/AAABBt4nPgZ9KDMAkikuA3cqK/8AAAAGRywt/wAAAP8AAAECjy8yBjAwMf8AAAH/AAAA/wAAAAcDNDkAdzU4AnQ2N/8AAAH/AAAA/wAAAAbHOj0HPzs8/wAAAP8AAAD/AAAB/wAAAQJ2ARYBeQITABwDBP8AAAEBTQUMBecGCQRxBwj/AAAA/wAAAAFHCgv/AAAA/wAAAQasDRACcw4P/wAAAP8AAAAGsxES/wAAAf8AAAACNRQV/wAAAP8AAAEF8RcsBGwYIQOLGRwGcBob/wAAAP8AAAEGIh0e/wAAAQFYHyD/AAAB/wAAAAFgIicAkiMmBkckJf8AAAD/AAAB/wAAAASPKCsEbikq/wAAAf8AAAH/AAABB24tNAXyLi//AAABA5IwMf8AAAEBZDIz/wAAAP8AAAEBWzU6A6o2OQX2Nzj/AAAA/wAAAf8AAAAF9Ts+A5w8Pf8AAAD/AAABBho/QP8AAAH/AAABAoABFAa6Ag8GBgMGBHMEBf8AAAD/AAABABwHCP8AAAEHAgkMAWQKC/8AAAD/AAABBnwNDv8AAAD/AAAAA3EQEwJyERL/AAAA/wAAAf8AAAEEuRUwBiAWIwcwFxwDhRgZ/wAAAActGhv/AAAB/wAAAAA1HSAHWR4f/wAAAP8AAAEATCEi/wAAAf8AAAEGNyQrBJ0lKAcwJif/AAAA/wAAAAYjKSr/AAAA/wAAAQclLC3/AAABBH4uL/8AAAD/AAAA/wAAAQXwASACdAINBt4DDASBBAkHVgUIBeUGB/8AAAD/AAAA/wAAAAcZCgv/AAAA/wAAAf8AAAEGEg4TBxwPEgR1EBH/AAAA/wAAAf8AAAEEjRQbBmYVGAKJFhf/AAAA/wAAAARlGRr/AAAA/wAAAQOaHB8BWx0e/wAAAf8AAAH/AAAAAFIhMgYgIisBdiMqB14kJwdXJSb/AAAB/wAAAAeGKCn/AAAB/wAAAP8AAAEGmywxACYtLv8AAAEEuy8w/wAAAP8AAAH/AAABBigzPAXxNDcClDU2/wAAAf8AAAAGIjg5/wAAAQKqOjv/AAAB/wAAAP8AAAADhAEYA2wCBwXiAwT/AAAABHUFBv8AAAD/AAABBHEIDwXvCQ4AGQoL/wAAAQReDA3/AAAA/wAAAP8AAAEHQBAVBwcREv8AAAEBcRMU/wAAAP8AAAEHVBYX/wAAAf8AAAAF8xkwB1AaJwYsGyABbhwfAWkdHv8AAAH/AAAA/wAAAQOPISQGOCIj/wAAAP8AAAEBTSUm/wAAAP8AAAAAKygp/wAAAQKTKi0BcSss/wAAAP8AAAEBZS4v/wAAAP8AAAEGJjE4BfYyNwSSMzT/AAABAW41Nv8AAAH/AAAB/wAAAQSiOTr/AAAAA6s7PP8AAAEHnD0+/wAAAP8AAAACfAEaBqgCFQZxAwwGEwQHAXMFBv8AAAD/AAABA3oICf8AAAAHDgoL/wAAAP8AAAEBUg0UAVEOEQaJDxD/AAAA/wAAAAB9EhP/AAAA/wAAAf8AAAAEZBYZADAXGP8AAAH/AAAA/wAAAQSOGzIGGRwlAoYdJAcxHiEBcR8g/wAAAP8AAAEGFSIj/wAAAf8AAAD/AAABBx0mKwR9Jyj/AAAABe0pKv8AAAH/AAABAVwsLwExLS7/AAAA/wAAAAKbMDH/AAAA/wAAAQXzM0AAlzQ7ApY1OAZANjf/AAAB/wAAAASUOTr/AAAB/wAAAAdSPD8GMD0+/wAAAf8AAAD/AAAABjRBRgeWQkUHlUNE/wAAAf8AAAD/AAAB/wAAAAFsASIDcQINAT0DBgdZBAX/AAAB/wAAAAXqBwj/AAAABGUJDARaCgv/AAAA/wAAAf8AAAAF9A4bAEwPFAYgEBH/AAABAUkSE/8AAAD/AAAABKUVGAByFhf/AAAA/wAAAAEpGRr/AAAA/wAAAQFcHCEDwx0e/wAAAAetHyD/AAAB/wAAAP8AAAEGXCMyA3kkKQcSJSb/AAAABHInKP8AAAD/AAABBzAqLQFvKyz/AAAA/wAAAQA+LjEF9C8w/wAAAf8AAAH/AAABA3EzOANrNDX/AAAABxo2N/8AAAD/AAAB/wAAAQOCASIEcAIPAm8DBgXrBAX/AAAA/wAAAQAnBwoBaAgJ/wAAAP8AAAEHEwsM/wAAAAXqDQ7/AAAA/wAAAAXnEBkEdBEUAE0SE/8AAAD/AAABB1UVFv8AAAAGhRcY/wAAAP8AAAEGoxohAn4bHgR8HB3/AAAA/wAAAQYXHyD/AAAB/wAAAP8AAAEBWiM4BjckMQBdJSoGLiYn/wAAAAAxKCn/AAAB/wAAAAXwKy4HHCwt/wAAAP8AAAEHYi8w/wAAAP8AAAAF7TI3A4QzNgR6NDX/AAAA/wAAAf8AAAD/AAAAA4s5QASQOj8CfTs8/wAAAQXxPT7/AAAA/wAAAf8AAAEBZEFGA5RCQ/8AAAAEkkRF/wAAAf8AAAEF90dKBhpISf8AAAH/AAAB/wAAAQXwARwAHQID/wAAAQN3BA8F6gUKAmsGB/8AAAAArQgJ/wAAAP8AAAEEhQsOBqgMDf8AAAD/AAAB/wAAAQKLEBcBWBEUBnQSE/8AAAH/AAABA40VFv8AAAD/AAABBjAYGwKQGRr/AAAA/wAAAf8AAAACjx0e/wAAAQX0HygBZCAnAqghJAShIiP/AAAA/wAAAQKqJSb/AAAB/wAAAP8AAAEDuSkwBiIqLQeWKyz/AAAB/wAAAQKqLi//AAAB/wAAAAfNMTQBWzIz/wAAAP8AAAH/AAABAW4BFgN2AgsGqAMIBykEBwC3BQb/AAAA/wAAAf8AAAAF6wkK/wAAAf8AAAAAMAwN/wAAAAEpDg//AAAAAF0QEwR9ERL/AAAA/wAAAQOYFBX/AAAA/wAAAQJlFxj/AAAAAXMZIARyGhv/AAAAB5UcHf8AAAEBcB4f/wAAAf8AAAACjSEmBfIiI/8AAAEGEiQl/wAAAf8AAAD/AAABBiEBHAXwAg8EaAME/wAAAAcRBQgDgwYH/wAAAP8AAAEF7wkMA4gKC/8AAAH/AAABBgoNDv8AAAH/AAAABiAQGwOMERYGExIT/wAAAQA2FBX/AAAA/wAAAQOcFxoEoxgZ/wAAAf8AAAH/AAAB/wAAAAR7HTQHJh4rADwfJAcfICH/AAABA3UiI/8AAAD/AAABALwlKAZzJif/AAAA/wAAAAFXKSr/AAAB/wAAAAXqLDEGiS0wBz8uL/8AAAD/AAAA/wAAAAFyMjP/AAAA/wAAAQZ0NUAF7TY7AVU3OgBJODn/AAAA/wAAAP8AAAEBNTw9/wAAAAKoPj//AAAA/wAAAQcSQUL/AAAAAU1DRP8AAAEEfEVG/wAAAP8AAAEF8AEcA3ECCwAfAwT/AAABBekFBv8AAAACagcKAmYICf8AAAD/AAAB/wAAAAFtDBsHFg0UAVcOEQXrDxD/AAAB/wAAAABgEhP/AAAA/wAAAASZFRgBSBYX/wAAAP8AAAACpBka/wAAAf8AAAD/AAABB5sdMgSlHisEhh8kAWAgIf8AAAADjSIj/wAAAf8AAAEF8iUoA5cmJ/8AAAH/AAAAAWQpKv8AAAD/AAABAUosLf8AAAAEqy4xB3gvMP8AAAH/AAAA/wAAAQY0MzT/AAAB/wAAAARsARIBfgIRBjADBgKDBAX/AAAA/wAAAQF5Bw4CcwgLBeoJCv8AAAD/AAAAAncMDf8AAAD/AAAABFEPEP8AAAD/AAAB/wAAAQKiEyoF8xQhAWIVHAXuFhkAihcY/wAAAP8AAAAEnRob/wAAAP8AAAEGGR0e/wAAAQBGHyD/AAAB/wAAAQX1IicGHCMk/wAAAQFqJSb/AAAB/wAAAAKhKCn/AAAB/wAAAAFPKzIGNiwxAT8tMALBLi//AAAB/wAAAP8AAAD/AAAA/wAAAQ==',
  s2a: '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',
  s2b: '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'
};
var _CAS_O = {
  s1:  [0, 252, 512, 692, 896, 1068, 1304, 1540, 1800, 1932, 2224, 2428, 2616, 2788, 2976, 3124, 3416, 3628, 3880, 4140, 4336, 4580, 4832, 5116, 5344, 5644, 5856, 6012, 6296, 6508],
  s2a: [0, 228, 464, 724, 920, 1148, 1376, 1628, 1856, 2092, 2352, 2628, 2888, 3164, 3472, 3716, 3936, 4236, 4488, 4708, 4936, 5220, 5456, 5628, 5896, 6180, 6416, 6676, 6944, 7204],
  s2b: [0, 212, 376, 572, 800, 1036, 1296, 1572, 1808, 1988, 2192, 2356, 2560, 2708, 2952, 3140, 3352, 3508, 3704, 3900, 4128, 4340, 4560, 4740, 4960, 5124, 5328, 5516, 5680, 5868]
};
var CAS_MIN = [14.68,-24.26,-52.85,-55.71,-43.3,-1218,0,1.4];
var CAS_MAX = [75.4,35.57,61.7,65.65,66.71,96.4,99.28,96.4];
// Mapping: Stage2a: [amber,brown,hazel]→[0,2,5]; Stage2b: [blue,grey,green]→[1,4,3]
var _CAS_D = [0,2,5], _CAS_L = [1,4,3];
var CAS_CATS = ['amber','blue','brown','green','grey','hazel'];

function _casTree(data, offset, fvn) {
  var node=0;
  while(true) {
    var bp=offset+node*4, fi=data[bp];
    if(fi===255) return data[bp+3];
    node = fvn[fi]<=data[bp+1] ? data[bp+2] : data[bp+3];
  }
}
function _casPredict(b64key, offsets, fvn, nTrees) {
  if(!_CAS) {
    _CAS={};
    ['s1','s2a','s2b'].forEach(function(k) {
      var bin=atob(_CAS_B[k]),u8=new Uint8Array(bin.length);
      for(var i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
      _CAS[k]=u8;
    });
  }
  var data=_CAS[b64key], votes=[];
  for(var i=0;i<nTrees;i++) votes.push(0);
  var nClass=0;
  for(var ti=0;ti<nTrees;ti++) {
    var v=_casTree(data, offsets[ti], fvn);
    if(v+1>nClass) nClass=v+1;
    votes[v]=(votes[v]||0)+1;
  }
  var bv=0,bc=0;
  for(var ci=0;ci<nClass;ci++) if((votes[ci]||0)>bv){bv=votes[ci];bc=ci;}
  return {cls:bc,votes:bv};
}

// Drop-in replacement for knnColor()
function knnColor(outerMeanRgb,osMean,t3InnerLab,hsvOuter) {
  var lab=rgbLab(outerMeanRgb[0],outerMeanRgb[1],outerMeanRgb[2]);
  var osB=osMean?rgbLab(osMean[0],osMean[1],osMean[2])[2]:lab[2];
  var innerB=t3InnerLab?t3InnerLab[2]:0;
  var rsat=outerMeanRgb[0]>0?(outerMeanRgb[0]-outerMeanRgb[2])/outerMeanRgb[0]*100:0;
  var fv=[lab[0],lab[1],lab[2],osB,innerB,rsat,hsvOuter[0]/3.6,hsvOuter[1]*100];
  var fvn=fv.map(function(v,fi){
    var rng=CAS_MAX[fi]-CAS_MIN[fi];
    return rng>0?Math.max(0,Math.min(255,Math.round((v-CAS_MIN[fi])/rng*255))):128;
  });
  // Stage 1: dark (1) vs light (0)
  var s1=_casPredict('s1',_CAS_O.s1,fvn,30);
  var isDark=s1.cls===1;
  var s2;
  // ── Soft routing: when Stage 1 is uncertain (< 60% agreement, votes < 18/30),
  // run BOTH Stage 2a and 2b and take the sub-classifier with higher vote confidence.
  // This prevents the cascade from confidently routing hazel irises (which sit near
  // the dark/light boundary) to the wrong sub-classifier.
  if (s1.votes < 18) {
    var _s2a=_casPredict('s2a',_CAS_O.s2a,fvn,30);
    var _s2b=_casPredict('s2b',_CAS_O.s2b,fvn,30);
    if (_s2a.votes >= _s2b.votes) { isDark=true;  s2=_s2a; }
    else                          { isDark=false; s2=_s2b; }
  } else {
    s2=isDark?_casPredict('s2a',_CAS_O.s2a,fvn,30):_casPredict('s2b',_CAS_O.s2b,fvn,30);
  }
  var catIdx=(isDark?_CAS_D:_CAS_L)[s2.cls];
  // ── Hazel rescue: cascade routes hazel irises with neutral outer stroma
  // to the "light" group, where Stage 2b classifies them as grey.
  if (catIdx === 4 && t3InnerLab && t3InnerLab[2] > 18 && lab[2] < 12) {
    catIdx = 5; // reclassify grey→hazel
  }
  // ── Confidence score 0-100: minimum of Stage 1 and Stage 2 vote fractions.
  // Low score (< 60) = classifier is uncertain; UI should offer manual adjust.
  var _conf = Math.round(Math.min(s1.votes, s2.votes) / 30 * 100);
  return {cat:CAS_CATS[catIdx],votes:s2.votes,darkVotes:s1.votes,confidence:_conf};
}
