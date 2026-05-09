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
  ['Blue','Storm Blue','#3A5570'],['Blue','Dusk Blue','#2E4A65'],['Blue','Indigo','#2A3F73'],
  ['Blue','Iris Blue','#5060A0'],['Blue','Wedgwood','#5B80A0'],['Blue','Aquamarine','#6ACCC0'],
  ['Blue','Teal Blue','#4AAAB0'],['Blue','Blue-Gray','#6080A0'],['Blue','Heather Blue','#7090B0'],
  ['Blue','Smoky Blue','#607A90'],['Blue','Pewter Blue','#708090'],
  // ── GRAY (20 entries: silver → charcoal) ──
  ['Gray','Silver Mist','#D0D4DC'],['Gray','Pearl Gray','#C0C5CC'],['Gray','Dove Gray','#B0B5BC'],
  ['Gray','Cloud Gray','#A0A5AC'],['Gray','Ash Gray','#90969C'],['Gray','Smoke Gray','#80868C'],
  ['Gray','Warm Gray','#908880'],['Gray','Cool Gray','#808890'],['Gray','Slate Gray','#708090'],
  ['Gray','Steel Gray','#608088'],['Gray','Iron Gray','#505860'],['Gray','Graphite','#404850'],
  ['Gray','Charcoal','#384048'],['Gray','Dark Slate','#303840'],['Gray','Gun Metal','#485860'],
  ['Gray','Blue Gray','#607080'],['Gray','Storm Gray','#506070'],['Gray','Dusk Gray','#485868'],
  ['Gray','Silver Blue','#8090A0'],['Gray','Pewter','#708898'],
  // ── GREEN (28 entries: pale mint → dark forest) ──
  ['Green','Mint Frost','#D0E8D4'],['Green','Pale Sage','#B8D4BC'],['Green','Sea Glass','#A0C4A8'],
  ['Green','Seafoam','#88B898'],['Green','Celadon','#78A888'],['Green','Sage','#70A078'],
  ['Green','Jade','#60986A'],['Green','Pistachio','#80A860'],['Green','Apple','#70A050'],
  ['Green','Fern','#608848'],['Green','Olive','#787848'],['Green','Olive Green','#687040'],
  ['Green','Khaki Green','#708858'],['Green','Moss','#506040'],['Green','Moss Green','#486038'],
  ['Green','Hunter','#406038'],['Green','Forest Green','#305830'],['Green','Emerald','#206848'],
  ['Green','Deep Emerald','#185838'],['Green','Bottle Green','#204830'],['Green','Pine','#284838'],
  ['Green','Teal','#387868'],['Green','Dark Teal','#286058'],['Green','Malachite','#308060'],
  ['Green','Viridian','#408068'],['Green','Eucalyptus','#608878'],['Green','Autumn Green','#788848'],
  ['Green','Swamp Green','#506840'],
  // ── HAZEL (24 entries: golden-green → dark brown-green) ──
  ['Hazel','Warm Gold','#C8A870'],['Hazel','Honey Gold','#B89060'],['Hazel','Sandy Hazel','#A88050'],
  ['Hazel','Light Hazel','#987040'],['Hazel','Golden Hazel','#906838'],['Hazel','Warm Hazel','#886030'],
  ['Hazel','Hazel','#806028'],['Hazel','Autumn Hazel','#786020'],['Hazel','Amber Hazel','#906828'],
  ['Hazel','Copper Hazel','#885830'],['Hazel','Rich Hazel','#705028'],['Hazel','Dark Hazel','#604820'],
  ['Hazel','Deep Hazel','#584018'],['Hazel','Green-Hazel','#788848'],['Hazel','Olive-Hazel','#708040'],
  ['Hazel','Mossy Hazel','#687038'],['Hazel','Khaki Hazel','#787040'],['Hazel','Forest Hazel','#606838'],
  ['Hazel','Warm Moss','#706838'],['Hazel','Muddy Hazel','#686038'],['Hazel','Bronze','#886040'],
  ['Hazel','Antique Gold','#A07840'],['Hazel','Caramel','#987848'],['Hazel','Toffee','#885A38'],
  // ── AMBER (20 entries: champagne → deep amber) ──
  ['Amber','Champagne','#F0DFBA'],['Amber','Pale Gold','#E8CF98'],['Amber','Warm Cream','#E0C080'],
  ['Amber','Honey','#D8B060'],['Amber','Gold','#D0A040'],['Amber','Topaz','#C89030'],
  ['Amber','Amber','#C08020'],['Amber','Deep Gold','#B07018'],['Amber','Burnt Gold','#A86018'],
  ['Amber','Cognac','#A05810'],['Amber','Tawny','#985010'],['Amber','Copper','#904808'],
  ['Amber','Butterscotch','#C89048'],['Amber','Caramel Gold','#B88040'],['Amber','Warm Amber','#B87030'],
  ['Amber','Bronze Gold','#A87028'],['Amber','Tiger Eye','#B87020'],['Amber','Tortoise','#987010'],
  ['Amber','Warm Tawny','#906018'],['Amber','Dark Amber','#885010'],
  // ── BROWN (56 entries: tan → near-black) ──
  ['Brown','Ivory','#E8D8B8'],['Brown','Cream','#D8C8A0'],['Brown','Linen','#C8B888'],
  ['Brown','Sand','#B8A870'],['Brown','Wheat','#A89858'],['Brown','Tan','#988848'],
  ['Brown','Khaki','#908040'],['Brown','Warm Tan','#987840'],['Brown','Light Brown','#886830'],
  ['Brown','Caramel Brown','#785820'],['Brown','Warm Brown','#705018'],['Brown','Hazelnut','#684810'],
  ['Brown','Chestnut','#604010'],['Brown','Cinnamon','#703818'],['Brown','Russet','#703010'],
  ['Brown','Auburn','#682818'],['Brown','Mahogany','#602010'],['Brown','Cognac','#582018'],
  ['Brown','Sienna','#703010'],['Brown','Burnt Sienna','#682808'],['Brown','Umber','#604020'],
  ['Brown','Raw Umber','#584018'],['Brown','Walnut','#503010'],['Brown','Rich Walnut','#482808'],
  ['Brown','Dark Walnut','#402008'],['Brown','Chocolate','#381808'],['Brown','Dark Chocolate','#301008'],
  ['Brown','Espresso','#281008'],['Brown','Mocha','#301808'],['Brown','Dark Mocha','#281008'],
  ['Brown','Coffee','#201008'],['Brown','Black Coffee','#180808'],['Brown','Near Black','#100808'],
  ['Brown','Warm Black','#180C08'],['Brown','Deep Brown','#200C08'],['Brown','Rich Brown','#281008'],
  ['Brown','Mahogany Brown','#381810'],['Brown','Russet Brown','#401808'],['Brown','Copper Brown','#502010'],
  ['Brown','Brick Brown','#582018'],['Brown','Clay Brown','#604028'],['Brown','Terracotta','#703028'],
  ['Brown','Adobe','#784030'],['Brown','Burnt Clay','#683028'],['Brown','Red Brown','#602018'],
  ['Brown','Warm Chestnut','#583018'],['Brown','Mink','#705050'],['Brown','Dark Mink','#604040'],
  ['Brown','Otter Brown','#706050'],['Brown','Seal Brown','#503838'],['Brown','Dark Seal','#402828'],
  ['Brown','Peat','#504030'],['Brown','Mud Brown','#483828'],['Brown','Earth Brown','#504030'],
  ['Brown','Soil Brown','#483830'],['Brown','Bark','#402818'],
  // ── VIOLET (20 entries: lavender → deep violet) ──
  ['Violet','Lilac Mist','#D8C8E8'],['Violet','Pale Lavender','#C8B0D8'],['Violet','Lavender','#B898C8'],
  ['Violet','Soft Violet','#A880B8'],['Violet','Mauve','#9870A8'],['Violet','Dusty Violet','#886098'],
  ['Violet','Violet','#785088'],['Violet','Warm Violet','#684878'],['Violet','Deep Violet','#583868'],
  ['Violet','Plum','#483058'],['Violet','Dark Plum','#382048'],['Violet','Grape','#502858'],
  ['Violet','Amethyst','#806098'],['Violet','Purple','#705888'],['Violet','Iris','#808098'],
  ['Violet','Blue Violet','#6068A8'],['Violet','Indigo Violet','#485098'],['Violet','Twilight','#505070'],
  ['Violet','Storm Violet','#486080'],['Violet','Dusk Violet','#405068']
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
  for (var i=0;i<PALETTE.length;i++){ var d=dE(lab, PALETTE[i].lab); if (d<bd){bd=d; best=PALETTE[i];} }
  return {entry:best, distance:bd};
}
