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
// ===== Random-Forest Colour Classifier =====
// 30 trees, max_depth=6, SMOTE-augmented 597 GT images. 74.4% LOO.
// Feature: [outerL,outerA,outerB,osB,innerB,rsat*100,hsvH/3.6,hsvS*100]
var RF_DATA=null;
var _RF_B64='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';
var RF_OFFSETS=[0, 340, 664, 1084, 1360, 1732, 2112, 2412, 2736, 3124, 3456, 3748, 4144, 4516, 4888, 5236, 5560, 5828, 6192, 6484, 6824, 7196, 7560, 7884, 8184, 8476, 8744, 9044, 9400, 9724];
var RF_MIN=[14.68,-24.26,-52.85,-55.71,-43.3,-1218,0,1.4];
var RF_MAX=[75.4,35.57,61.7,65.65,66.71,96.4,99.28,96.4];
var RF_CATS=['amber','blue','brown','green','grey','hazel'];
function knnColor(outerMeanRgb,osMean,t3InnerLab,hsvOuter){
  if(!RF_DATA){var bin=atob(_RF_B64),u8=new Uint8Array(bin.length);for(var _i=0;_i<bin.length;_i++)u8[_i]=bin.charCodeAt(_i);RF_DATA=u8;}
  var lab=rgbLab(outerMeanRgb[0],outerMeanRgb[1],outerMeanRgb[2]);
  var osB=osMean?rgbLab(osMean[0],osMean[1],osMean[2])[2]:lab[2];
  var innerB=t3InnerLab?t3InnerLab[2]:0;
  var rsat=outerMeanRgb[0]>0?(outerMeanRgb[0]-outerMeanRgb[2])/outerMeanRgb[0]*100:0;
  var fv=[lab[0],lab[1],lab[2],osB,innerB,rsat,hsvOuter[0]/3.6,hsvOuter[1]*100];
  var fvn=fv.map(function(v,fi){var rng=RF_MAX[fi]-RF_MIN[fi];return rng>0?Math.max(0,Math.min(255,Math.round((v-RF_MIN[fi])/rng*255))):128;});
  var votes=[0,0,0,0,0,0];
  for(var ti=0;ti<30;ti++){
    var node=0,base=RF_OFFSETS[ti];
    while(true){
      var bp=base+node*4,fi=RF_DATA[bp];
      if(fi===255){votes[RF_DATA[bp+3]]++;break;}
      node=fvn[fi]<=RF_DATA[bp+1]?RF_DATA[bp+2]:RF_DATA[bp+3];
    }
  }
  var bv=0,bc=0;
  for(var ci=0;ci<6;ci++)if(votes[ci]>bv){bv=votes[ci];bc=ci;}
  return{cat:RF_CATS[bc],votes:bv};
}
