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
// ===== 5-NN Colour Classifier =====
// Training data: 597 GT images, 8 features per iris, label 0-5.
// Feature vector (per row): [label, outerL, outerA, outerB, osB, innerB, rsat100, hsvH100, hsvS100]
// All values quantised to 0-255 via the normalization constants below.
// LOO accuracy: 72.9% (435/597) vs 64.7% rule-based.  k=5.
var KNN_TRAIN=[
  0,132,228,237,234,225,255,21,255,0,177,147,180,186,174,246,22,125,0,113,113,124,141,125,238,13,22,0,31,181,173,166,156,252,15,214,0,114,114,195,191,161,249,30,174,0,64,161,157,157,143,247,14,144,0,164,199,201,205,189,249,18,169,0,78,169,173,182,137,249,17,170,0,30,203,177,175,161,253,13,229,0,56,133,146,149,126,245,18,113,
  0,98,127,179,181,153,248,26,158,0,71,147,199,195,197,253,26,233,0,124,161,198,196,147,250,22,181,0,28,194,169,175,149,252,12,209,0,58,145,155,155,142,247,17,138,0,87,171,171,171,149,248,16,159,0,132,206,219,218,197,252,20,215,0,49,101,135,142,99,241,32,61,0,125,136,189,184,148,248,25,161,0,120,201,159,169,97,246,8,130,
  0,72,122,152,156,156,245,23,112,0,225,113,195,190,184,245,29,120,0,99,133,181,182,148,248,25,161,0,120,215,219,218,191,253,19,225,0,165,143,177,185,144,246,22,125,0,130,140,181,188,162,247,23,144,0,168,102,169,178,152,244,31,96,0,162,117,176,184,150,245,27,116,0,181,173,183,186,175,246,18,134,0,146,255,242,246,232,254,19,247,
  0,115,168,177,189,172,248,18,153,0,46,180,188,208,210,253,19,234,0,179,98,225,219,170,250,34,182,0,173,147,148,144,105,242,14,78,0,114,166,205,222,225,251,23,202,0,126,110,158,174,137,243,28,93,0,93,98,169,174,156,246,33,129,0,146,170,167,178,156,245,15,123,0,110,125,213,222,213,253,30,221,0,56,133,191,194,174,253,28,231,
  0,216,165,179,181,163,245,18,115,0,198,215,255,255,228,253,23,227,0,100,126,208,216,255,252,30,220,0,72,105,146,148,120,243,29,87,0,169,126,185,192,152,246,26,130,0,113,119,168,176,170,245,26,123,0,110,159,164,175,178,246,17,132,0,100,117,150,166,152,243,24,92,0,207,119,194,199,232,246,28,125,0,64,140,155,157,147,246,19,132,
  0,193,91,137,149,106,238,43,26,0,148,187,193,189,177,248,18,164,0,198,118,131,146,114,239,16,31,0,167,104,169,179,156,244,30,96,0,61,165,153,157,116,247,12,140,0,28,177,172,168,156,252,16,216,0,158,148,144,144,115,242,12,77,0,86,136,178,190,190,249,24,166,0,128,110,160,165,125,244,28,98,0,63,119,175,180,152,249,28,175,
  0,162,123,183,186,146,246,27,128,0,89,180,205,216,205,253,22,226,0,11,147,164,166,163,252,21,218,0,26,178,171,166,155,252,16,215,0,195,172,161,169,155,244,13,100,0,177,141,216,219,218,249,27,176,0,90,158,183,183,133,250,21,179,0,97,146,175,181,129,248,22,156,0,114,147,146,167,169,243,14,93,0,64,183,194,210,196,253,20,227,
  0,87,192,188,191,175,251,17,194,0,198,87,142,153,101,239,43,34,0,168,129,177,175,167,245,25,118,0,62,235,188,188,187,252,11,218,0,176,137,210,212,209,249,27,166,0,114,194,226,230,215,255,23,252,0,168,111,200,214,206,247,31,149,0,96,175,182,181,167,249,18,174,0,124,159,196,194,143,249,23,179,0,133,217,223,229,224,253,20,223,
  0,163,129,172,171,166,245,24,113,0,91,123,146,147,136,243,21,90,0,153,140,159,159,154,244,19,99,0,54,133,195,193,188,254,29,246,0,92,134,181,193,147,249,25,167,0,94,150,163,168,152,246,18,135,0,118,154,168,178,168,246,19,133,1,95,84,60,59,62,193,146,181,1,30,80,101,102,81,221,141,115,1,50,87,101,105,92,226,144,87,
  1,64,85,98,102,87,226,144,92,1,118,94,89,95,72,228,150,80,1,111,92,93,99,70,228,149,76,1,107,94,102,109,78,231,148,52,1,103,57,72,79,109,190,141,185,1,110,72,108,116,120,230,134,61,1,152,85,72,75,50,222,148,111,1,63,115,100,101,77,232,168,42,1,183,125,89,97,60,233,171,36,1,172,37,81,91,61,215,138,138,
  1,91,72,109,105,85,230,132,64,1,50,200,0,0,32,0,157,244,1,64,107,82,83,53,223,155,107,1,157,100,83,85,69,228,153,74,1,66,75,107,108,106,228,136,78,1,129,96,74,65,58,223,151,105,1,177,80,96,99,79,230,143,61,1,105,90,95,99,75,228,147,74,1,168,103,63,72,41,223,153,105,1,99,89,103,106,81,231,144,55,
  1,91,95,100,103,81,230,149,59,1,100,101,87,91,70,227,153,84,1,93,89,74,69,52,216,148,135,1,95,90,96,86,100,228,147,74,1,29,64,98,88,82,202,137,168,1,131,76,83,66,53,223,145,106,1,160,83,98,109,83,230,144,59,1,49,102,97,102,101,228,154,74,1,136,114,66,64,15,224,156,100,1,142,87,72,75,52,221,149,114,
  1,155,75,106,105,77,231,136,51,1,126,121,49,52,31,216,155,135,1,158,94,62,65,47,220,150,118,1,78,101,79,91,79,221,152,115,1,90,67,113,114,95,230,127,63,1,146,78,101,99,117,230,141,60,1,37,95,104,101,88,229,147,71,1,119,96,95,102,76,230,151,62,1,113,82,75,80,64,218,147,127,1,110,96,88,88,90,227,151,83,
  1,133,80,102,108,81,230,141,58,1,158,70,109,107,92,232,132,48,1,126,92,111,109,88,234,139,26,1,37,117,70,70,61,210,155,152,1,43,85,93,88,85,219,145,123,1,83,83,95,89,88,225,144,93,1,135,79,80,85,61,222,146,110,1,42,100,84,90,65,218,151,125,1,68,77,69,71,51,180,144,196,1,99,113,60,62,53,216,154,134,
  1,140,69,67,70,45,212,145,146,1,76,94,123,118,100,237,68,13,1,127,48,110,116,112,227,127,82,1,39,85,81,83,70,200,145,172,1,74,62,97,94,108,219,137,125,1,56,103,90,82,83,225,153,94,1,103,71,62,68,66,184,144,192,1,118,98,110,126,102,234,148,24,1,112,97,71,66,39,220,151,120,1,142,84,54,79,70,208,147,156,
  1,120,82,98,97,93,229,143,70,1,126,58,107,107,67,228,131,75,1,85,102,94,90,57,229,154,70,1,86,68,103,99,95,226,136,92,1,120,74,110,111,123,231,132,51,1,108,74,111,111,122,231,131,50,1,73,78,100,97,114,226,141,91,1,115,97,122,126,104,237,64,7,1,179,104,80,73,100,229,154,70,1,53,74,103,99,102,224,138,98,
  1,75,81,115,112,118,233,125,41,1,151,119,83,81,90,230,162,58,1,103,89,112,107,110,234,136,30,1,32,103,100,106,90,229,155,71,1,140,43,109,110,126,227,127,85,1,108,86,89,90,105,225,147,93,1,159,40,103,105,78,225,131,93,1,137,69,67,71,44,211,145,148,1,109,120,102,106,71,234,181,29,1,134,91,108,105,92,233,142,33,
  1,53,118,140,140,131,243,21,89,1,139,71,67,69,49,213,145,144,1,252,15,82,95,65,220,135,120,1,135,68,92,92,76,225,141,95,1,36,100,104,103,86,230,151,59,1,38,70,106,107,83,222,135,110,1,111,66,87,68,76,219,141,123,1,83,58,89,79,94,210,139,150,1,193,100,81,72,57,229,153,68,1,110,91,79,86,68,222,149,109,
  1,160,81,58,67,33,213,147,141,1,141,68,88,89,80,224,142,102,1,80,108,104,105,82,233,161,35,1,79,67,101,98,83,224,137,101,1,150,92,103,108,102,232,146,41,1,137,94,29,28,0,147,146,217,1,99,92,73,63,32,218,149,128,1,136,70,69,71,45,212,145,145,1,78,83,104,104,79,229,141,70,1,73,106,88,81,39,227,155,86,
  1,134,69,68,70,45,211,144,148,1,139,43,64,68,73,175,140,200,1,129,121,49,59,7,217,156,131,1,88,117,68,64,48,221,157,116,1,165,104,84,87,75,229,155,67,1,105,115,68,62,55,222,156,110,1,141,118,102,110,96,234,178,24,1,140,66,72,65,52,214,144,140,1,87,111,96,92,83,231,161,53,1,141,77,106,107,78,231,137,51,
  1,140,92,67,65,68,220,150,120,1,174,81,95,98,78,230,144,63,1,136,72,69,68,47,213,145,141,1,61,87,99,95,87,227,144,86,1,83,58,82,81,82,199,140,173,2,91,121,181,184,152,249,28,165,2,56,154,149,151,130,246,13,130,2,37,163,167,166,143,250,17,190,2,40,155,153,165,104,248,15,152,2,38,127,148,156,130,246,21,129,
  2,30,168,116,114,88,241,242,103,2,63,179,174,174,146,250,16,185,2,12,155,145,145,119,248,11,156,2,38,128,150,147,145,246,21,134,2,55,134,143,146,128,244,16,108,2,32,147,159,157,123,249,18,172,2,0,133,107,122,104,236,214,57,2,12,141,143,147,153,247,14,144,2,31,116,133,139,133,242,19,75,2,77,107,115,122,117,236,193,3,
  2,8,130,156,159,143,250,22,188,2,18,136,137,137,123,245,13,115,2,100,127,147,160,160,243,20,89,2,51,128,138,142,99,243,16,90,2,16,150,126,127,108,243,255,96,2,9,118,116,122,75,238,235,31,2,14,140,145,142,122,247,15,146,2,94,141,164,169,149,246,20,134,2,0,148,142,143,134,248,12,157,2,54,124,135,141,91,242,16,80,
  2,27,118,112,114,113,236,214,21,2,69,139,134,140,127,242,9,80,2,22,149,138,145,112,246,9,125,2,54,159,149,164,138,246,12,133,2,12,136,123,131,125,242,254,74,2,3,182,139,144,126,248,1,157,2,53,124,122,125,116,239,0,37,2,60,146,163,173,152,248,19,157,2,55,167,158,164,133,248,14,156,2,55,173,159,164,137,248,13,158,
  2,13,154,135,142,120,246,6,124,2,46,226,190,190,166,254,13,240,2,155,156,184,182,152,247,21,142,2,147,135,153,157,148,243,19,88,2,17,194,170,170,161,253,13,231,2,160,126,157,162,130,243,22,88,2,116,139,164,160,147,245,21,122,2,15,137,154,158,80,249,20,174,2,107,153,163,161,154,246,18,129,2,28,147,146,147,130,247,13,140,
  2,61,150,166,165,152,248,19,162,2,77,143,143,148,126,244,13,100,2,60,151,169,171,148,249,20,170,2,119,162,169,182,175,246,17,136,2,69,137,127,122,122,241,4,60,2,13,158,135,140,109,246,4,126,2,84,117,122,132,153,238,5,24,2,41,145,162,168,122,249,20,171,2,100,158,171,179,149,247,19,149,2,57,241,160,174,144,249,2,174,
  2,116,238,208,210,187,252,15,211,2,83,145,148,145,124,244,15,108,2,70,136,145,156,132,244,16,104,2,36,135,135,145,100,243,12,96,2,53,139,161,168,157,248,21,154,2,58,164,172,176,142,250,18,182,2,101,134,129,140,131,241,7,54,2,12,159,148,148,127,249,11,166,2,62,145,174,178,158,250,22,179,2,73,128,139,142,133,243,16,83,
  2,85,138,198,202,168,252,27,213,2,18,122,116,119,106,238,241,38,2,83,182,165,174,154,248,13,155,2,71,171,171,175,151,249,16,172,2,50,175,148,146,139,247,8,139,2,20,116,115,111,101,237,231,23,2,17,125,122,125,110,240,0,51,2,84,194,192,188,166,251,17,204,2,84,199,179,177,159,250,14,183,2,6,139,151,152,102,249,18,175,
  2,126,215,199,196,145,250,16,189,2,86,174,153,155,132,246,10,129,2,30,107,112,109,94,235,171,15,2,34,174,160,163,130,249,13,179,2,39,183,159,158,132,249,11,174,2,86,120,149,160,144,243,23,96,2,74,149,162,161,149,247,18,145,2,49,125,163,172,162,248,25,159,2,34,170,137,147,118,246,3,124,2,65,156,167,168,161,248,18,163,
  2,28,150,134,140,101,244,6,107,2,13,134,122,131,120,241,254,70,2,53,148,155,164,141,247,17,144,2,47,158,162,172,143,249,17,169,2,73,126,135,141,121,242,15,72,2,34,150,138,142,127,245,9,116,2,37,170,156,160,124,249,12,166,2,64,179,171,178,165,249,15,178,2,14,205,167,163,145,253,10,228,2,81,144,149,157,161,245,16,112,
  2,123,209,194,195,163,250,16,183,2,15,155,157,163,119,250,16,188,2,58,122,117,120,104,238,243,29,2,132,133,132,142,141,240,10,52,2,87,133,135,144,105,242,12,72,2,89,142,127,136,122,241,2,57,2,21,182,160,153,136,250,11,192,2,53,176,174,171,111,250,16,193,2,120,131,148,155,141,243,19,87,2,15,151,149,147,113,248,14,161,
  2,57,150,142,161,135,245,11,112,2,98,126,135,141,121,241,15,64,2,51,150,150,153,111,246,15,134,2,40,124,129,135,124,241,12,67,2,82,180,179,177,155,250,17,180,2,126,131,206,215,191,250,28,190,2,100,110,139,148,83,241,25,61,2,67,121,121,123,109,239,0,30,3,71,18,167,165,150,242,71,140,3,158,14,114,113,99,224,123,112,
  3,133,69,142,155,121,239,62,49,3,101,2,201,198,180,249,60,200,3,165,64,191,195,162,245,43,120,3,245,30,180,178,184,241,57,82,3,100,71,141,140,141,239,62,53,3,151,61,146,149,138,239,64,52,3,47,77,124,132,135,235,101,42,3,171,0,167,169,133,238,78,90,3,57,89,136,144,122,240,46,52,3,124,59,137,148,144,237,81,43,
  3,75,110,160,156,170,245,29,123,3,133,52,157,155,151,240,60,78,3,36,76,135,139,131,239,67,61,3,29,113,155,157,158,247,27,150,3,163,59,121,124,85,233,114,45,3,145,57,163,165,159,241,54,83,3,106,82,139,141,131,239,52,46,3,148,75,155,160,137,241,47,65,3,154,60,195,194,177,246,43,135,3,148,21,123,124,118,228,116,95,
  3,67,39,162,168,134,243,64,127,3,144,69,174,194,160,244,44,100,3,44,58,127,144,130,232,105,80,3,56,24,161,161,122,241,73,136,3,60,55,140,141,129,237,79,70,3,48,81,121,121,101,234,107,38,3,241,17,180,180,189,240,62,84,3,141,66,168,187,155,243,47,92,3,62,50,152,152,135,241,66,101,3,93,13,178,171,150,244,66,149,
  3,39,86,119,116,116,234,112,33,3,82,14,189,196,183,248,61,188,3,48,41,154,156,147,241,70,121,3,107,11,175,173,135,242,68,132,3,141,67,139,143,114,238,68,42,3,60,51,150,152,134,240,67,99,3,68,87,149,147,138,243,41,82,3,95,107,130,141,126,239,24,37,3,248,23,123,134,127,232,115,64,3,82,26,142,142,140,233,96,97,
  3,67,88,152,153,113,243,40,93,3,54,31,162,162,150,242,69,140,3,12,88,144,143,156,244,43,106,3,155,66,171,191,150,243,46,92,3,82,40,128,130,102,230,109,92,3,184,93,148,164,172,240,35,50,3,156,42,157,168,152,239,66,73,3,159,91,152,160,108,241,36,62,3,43,96,150,151,138,244,35,110,3,75,91,118,124,112,235,114,17,
  3,185,40,147,150,131,237,78,51,3,65,81,148,170,145,242,47,81,3,58,79,115,115,158,232,125,50,3,63,85,153,153,118,244,41,97,3,158,67,174,192,148,243,45,95,3,91,55,105,110,104,224,132,102,3,119,72,183,186,157,246,41,133,3,68,67,150,160,149,241,56,88,3,193,77,145,147,132,239,52,39,3,92,70,113,114,104,231,126,56,
  3,177,58,148,147,153,239,64,52,3,80,29,177,173,165,245,60,155,3,146,84,122,132,109,236,100,16,3,97,62,143,150,138,239,67,63,3,76,100,132,138,135,239,33,40,3,53,79,162,170,142,246,43,130,3,150,22,176,171,149,242,63,110,3,136,38,157,151,129,239,68,81,3,127,35,159,159,147,240,69,86,3,39,99,148,151,146,244,33,107,
  3,80,66,145,155,165,240,61,71,3,44,41,98,102,129,129,133,224,3,74,89,152,160,157,243,38,90,3,168,86,123,129,179,236,96,12,3,74,86,151,156,156,243,41,86,3,78,84,146,154,137,241,45,70,3,68,33,166,171,135,243,65,136,3,255,16,181,178,183,240,62,83,4,150,85,97,98,84,230,145,61,4,82,108,114,112,98,236,186,6,
  4,137,112,95,98,93,232,162,42,4,164,92,114,119,102,235,133,15,4,94,102,123,121,107,237,34,12,4,123,94,126,126,118,237,55,14,4,49,100,146,148,139,243,33,95,4,161,85,118,121,124,235,116,17,4,98,114,120,120,110,238,0,13,4,164,91,115,119,103,235,128,13,4,97,106,128,139,134,239,25,31,4,133,96,115,128,97,235,136,11,
  4,167,92,114,118,103,235,133,14,4,122,110,127,129,90,239,20,28,4,143,87,113,112,91,234,132,23,4,156,87,105,119,89,232,142,41,4,160,103,116,128,97,236,150,1,4,30,103,124,127,101,238,29,26,4,79,93,111,112,88,233,140,32,4,90,114,114,112,95,236,214,8,4,206,90,118,122,102,236,118,10,4,146,99,117,125,101,236,128,3,
  4,133,96,137,141,119,239,36,39,4,208,88,102,105,90,233,145,38,4,125,102,123,122,96,237,34,9,4,151,101,116,125,100,236,143,3,4,71,70,121,120,101,233,112,51,4,52,89,136,138,124,240,46,54,4,141,107,110,109,87,235,165,12,4,199,92,101,103,91,233,147,37,4,153,90,124,131,120,236,78,9,4,101,106,111,126,102,235,164,13,
  4,53,102,102,111,93,231,154,57,4,112,101,101,104,82,232,153,43,4,77,97,127,126,130,238,43,20,4,75,98,132,131,140,239,36,37,4,157,93,106,113,103,233,145,32,4,95,85,120,124,170,235,109,23,4,157,108,139,137,141,240,26,47,4,69,104,115,117,110,235,157,7,4,81,102,123,121,111,238,34,13,4,128,94,116,115,131,235,128,11,
  4,100,100,111,117,132,235,150,19,4,98,83,115,109,94,234,125,31,4,102,90,135,135,129,239,46,37,4,102,96,108,111,124,233,147,34,4,62,98,123,127,101,237,54,12,4,147,83,137,151,136,238,53,34,4,100,93,122,118,106,236,86,8,4,58,103,99,100,77,230,154,63,4,46,99,95,99,88,226,151,88,4,95,106,102,92,93,233,158,40,
  4,47,90,112,110,95,232,136,42,4,89,91,111,111,99,233,139,32,4,137,83,111,96,83,233,134,33,4,205,93,116,120,97,235,128,8,4,152,82,113,112,111,234,131,28,4,131,94,109,110,98,234,144,29,4,125,88,112,120,100,234,135,28,4,209,75,105,108,85,232,137,43,4,155,102,115,124,98,236,150,5,4,149,97,114,118,96,235,141,12,
  4,52,110,134,136,105,241,24,64,4,62,111,144,141,118,243,26,91,4,98,103,106,110,104,233,155,32,4,84,90,171,169,147,246,36,135,4,59,106,104,103,91,232,158,42,4,74,96,118,110,98,236,118,10,4,158,105,106,121,97,234,158,22,4,126,104,109,113,110,235,157,18,4,127,106,110,113,108,235,161,15,4,84,93,114,113,112,234,134,22,
  4,64,98,112,114,96,234,144,25,4,108,92,131,129,122,238,47,27,4,118,99,96,110,84,230,152,58,4,63,110,129,132,124,240,21,46,4,120,68,97,107,79,226,139,88,4,67,106,117,123,100,236,214,0,4,69,114,123,120,104,239,9,27,4,120,100,99,103,82,232,153,49,4,85,98,112,110,93,234,144,21,4,88,95,109,110,99,233,145,35,
  4,211,89,120,124,103,236,104,8,4,140,83,140,150,133,239,50,40,4,179,100,114,118,96,236,146,6,4,121,100,125,127,90,238,37,14,4,110,99,118,114,99,236,107,2,4,127,98,115,119,97,235,137,9,4,149,97,111,117,94,235,146,18,4,145,89,104,108,102,232,144,43,4,128,90,129,129,127,238,56,21,4,111,104,115,119,98,236,157,4,
  4,115,86,133,130,122,238,56,31,4,141,96,108,110,100,234,147,27,4,75,103,106,108,96,233,155,37,4,167,86,104,109,102,232,143,42,4,114,110,122,121,108,238,12,14,4,137,90,103,107,98,232,145,46,4,112,94,141,139,120,240,37,52,4,74,100,123,119,107,237,43,10,4,145,90,103,107,101,232,145,45,4,111,100,103,104,81,232,152,41,
  4,108,105,111,126,102,235,159,15,4,152,102,101,109,77,233,154,36,4,85,98,112,116,95,234,144,21,4,106,96,108,117,96,233,147,34,4,109,92,133,136,117,239,46,30,4,122,103,136,135,135,240,29,43,4,154,89,115,125,91,235,128,16,4,129,89,130,139,124,238,55,23,4,80,98,114,114,102,235,143,16,4,94,105,112,117,99,235,163,11,
  5,82,107,160,162,196,245,30,119,5,147,99,148,161,195,241,32,62,5,87,92,150,161,167,242,37,82,5,132,82,108,122,167,232,137,42,5,63,98,133,138,135,240,36,45,5,141,81,123,130,174,236,98,19,5,107,75,106,114,116,230,137,64,5,114,140,163,170,158,245,20,121,5,73,106,129,135,147,239,25,37,5,143,76,111,125,166,233,131,39,
  5,122,59,103,100,125,227,134,86,5,106,87,119,124,124,235,112,19,5,165,102,125,141,168,237,32,13,5,80,86,126,129,129,237,75,23,5,155,84,122,129,173,236,100,16,5,143,89,169,178,175,244,36,100,5,144,56,169,166,159,242,52,94,5,81,73,115,127,199,232,123,51,5,26,140,153,152,127,248,18,160,5,64,71,170,170,163,247,45,143,
  5,83,117,120,118,126,238,0,21,5,97,86,119,123,100,235,114,23,5,93,103,116,119,137,236,150,2,5,55,101,143,137,127,243,32,83,5,117,65,114,120,131,231,125,55,5,87,86,129,136,130,238,64,28,5,79,99,121,129,143,237,57,6,5,113,87,119,120,147,235,112,18,5,82,74,108,114,116,229,134,67,5,69,116,152,151,153,245,25,112,
  5,116,81,134,141,135,238,61,33,5,97,101,127,139,149,238,33,23,5,188,73,108,116,154,232,134,41,5,110,104,138,147,140,240,29,51,5,146,67,151,153,181,240,55,61,5,51,79,127,137,159,236,86,33,5,107,91,165,170,166,244,36,107,5,110,48,130,131,125,233,104,65,5,28,98,114,126,135,234,143,26,5,84,108,163,153,122,246,29,125,
  5,67,97,121,131,149,237,71,7,5,71,116,147,145,142,244,24,96,5,109,125,169,178,191,246,25,130,5,186,140,196,203,180,247,25,142,5,73,94,132,139,158,239,43,35,5,117,121,184,191,195,248,28,152,5,112,61,192,196,178,248,44,158,5,55,127,155,164,146,246,22,134,5,79,73,118,122,127,233,118,49,5,190,111,218,227,212,249,31,167,
  5,34,83,144,151,152,242,47,87,5,75,120,134,135,194,241,17,64,5,72,111,157,160,193,245,28,120,5,62,102,137,146,152,241,31,61,5,137,99,146,156,197,241,32,59,5,128,102,166,169,176,244,31,104,5,128,132,167,170,197,245,23,120,5,43,71,138,143,136,239,65,70,5,84,139,161,161,140,246,20,133,5,83,112,169,177,207,247,29,142,
  5,125,128,164,173,191,245,23,114,5,117,111,140,142,128,241,25,60,5,99,103,162,164,196,245,31,111,5,93,102,142,142,172,241,30,65,5,132,152,174,183,194,246,20,136,5,110,121,163,168,142,245,25,116,5,80,118,151,149,144,244,24,103,5,52,96,159,174,192,246,34,132,5,169,122,164,167,154,243,24,95,5,131,78,149,157,167,240,48,59,
  5,79,142,145,144,168,244,14,102,5,67,109,148,156,202,244,28,98,5,43,117,143,143,123,244,23,104,5,175,117,158,162,156,242,25,81,5,99,111,167,169,146,246,29,127,5,110,94,139,145,126,240,38,45,5,136,114,157,150,147,243,26,90,5,154,120,163,165,161,244,25,97,5,162,92,179,191,189,245,34,112,5,113,112,175,172,179,246,29,134,
  5,105,104,135,142,178,240,29,45,5,77,88,125,131,133,237,73,20,5,68,43,120,121,132,226,118,108,5,102,102,160,166,171,244,31,104,5,93,118,103,110,127,234,178,30,5,124,89,166,175,185,244,36,102,5,127,112,135,134,157,240,22,45
];
var KNN_MIN=[14.68,-24.26,-52.85,-55.71,-43.3,-1218,0,1.4];
var KNN_MAX=[75.4,35.57,61.7,65.65,66.71,96.4,99.28,96.4];
var KNN_CATS=['amber','blue','brown','green','grey','hazel'];

// Classify an iris using 5-nearest-neighbour lookup.
// Returns {cat, votes} where votes is the majority vote count (max 5).
function knnColor(outerMeanRgb, osMean, t3InnerLab, hsvOuter) {
  var lab = rgbLab(outerMeanRgb[0], outerMeanRgb[1], outerMeanRgb[2]);
  var osB = osMean ? rgbLab(osMean[0], osMean[1], osMean[2])[2] : lab[2];
  var innerB = t3InnerLab ? t3InnerLab[2] : 0;
  var rsat = outerMeanRgb[0] > 0 ? (outerMeanRgb[0]-outerMeanRgb[2])/outerMeanRgb[0]*100 : 0;
  var fv = [lab[0], lab[1], lab[2], osB, innerB, rsat, hsvOuter[0]/3.6, hsvOuter[1]*100];
  var fvn = [];
  for (var fi = 0; fi < 8; fi++) {
    var rng = KNN_MAX[fi] - KNN_MIN[fi];
    fvn.push(rng > 0 ? Math.max(0, Math.min(255, Math.round((fv[fi]-KNN_MIN[fi])/rng*255))) : 0);
  }
  var n = 597, k = 5, dists = [];
  for (var j = 0; j < n; j++) {
    var base = j * 9, d = 0;
    for (var f = 0; f < 8; f++) {
      var dx = fvn[f] - KNN_TRAIN[base + 1 + f];
      d += dx * dx;
    }
    dists.push({d: d, li: KNN_TRAIN[base]});
  }
  dists.sort(function(a,b){return a.d-b.d;});
  var votes = [0,0,0,0,0,0];
  for (var ki = 0; ki < k; ki++) votes[dists[ki].li]++;
  var maxV = 0, maxCat = 0;
  for (var vi = 0; vi < 6; vi++) { if (votes[vi] > maxV) { maxV = votes[vi]; maxCat = vi; } }
  return {cat: KNN_CATS[maxCat], votes: maxV};
}
