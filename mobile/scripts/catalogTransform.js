// Turns the marketing-site catalog.html into a template fed from the database.
// Hard-coded model data is removed; data arrives as window.ZAYA_CATALOG.
const DATA = '(window.ZAYA_CATALOG||{})';

function replaceBlock(src, name, re) {
  if (!re.test(src)) throw new Error(`catalog source has no ${name} block`);
  return src.replace(re, `const ${name}=${DATA}.${name}||[];`);
}

function buildCatalogHtml(source) {
  let out = source;
  out = replaceBlock(out, 'W', /const W=\[[\s\S]*?\n\];/);
  out = replaceBlock(out, 'M', /const M=\[[\s\S]*?\n\];/);
  out = replaceBlock(out, 'RW', /const RW=\[[^\]]*\];/);
  out = replaceBlock(out, 'RM', /const RM=\[[^\]]*\];/);

  const photoRe = /im\.src="photos\/"\+k\+"-"\+\(j\+1\)\+"\.jpg"/;
  if (!photoRe.test(out)) throw new Error('catalog source has no photo loader');
  out = out.replace(photoRe, 'im.crossOrigin="anonymous";im.src=(m[6]&&m[6][j])||""');

  // The site's comment about photo slugs quotes a real model's name.
  out = out.replace(/\/\* slug = [^\n]*?\*\//g, '');

  out = out.split('href="index.html#models"').join('href="#"').split('href="index.html"').join('href="#"');
  out = out.replace('</head>', '<style>.site{display:none!important}</style></head>');
  return out;
}

module.exports = { buildCatalogHtml };
