import { buildCatalogHtml } from '../scripts/catalogTransform';

const source = `<html><head></head><body><script>
const W=[
 ["Real Name","Real Uz",165,["photo"],["a","b"],["c","d"]],
 ["Other Name","Other Uz",170,[],["a","b"],["c","d"]]
];
const M=[
 ["Male Name","Male Uz",177,[],["x","y"],["z","w"]]
];
const RW=[10,9];
const RM=[10];
/* slug = Latin name in lower case, e.g. "Real Name" -> real-name. Missing files are skipped. */
const slug=m=>m[1];
function load(m,k,j){const im=new Image();im.src="photos/"+k+"-"+(j+1)+".jpg"}
</script><a class="brand" href="index.html" target="_top">x</a></body></html>`;

test('hard-coded models and ratings are replaced by injected data', () => {
  const out = buildCatalogHtml(source);
  expect(out).not.toContain('Real Name');
  expect(out).not.toContain('Male Name');
  expect(out).not.toContain('Real Name');
  expect(out).not.toMatch(/real-name/);
  expect(out).not.toContain('[10,9]');
  expect(out).toContain('window.ZAYA_CATALOG');
  expect(out).toMatch(/const W=\(window\.ZAYA_CATALOG\|\|\{\}\)\.W\|\|\[\]/);
  expect(out).toMatch(/const M=\(window\.ZAYA_CATALOG\|\|\{\}\)\.M\|\|\[\]/);
  expect(out).toMatch(/const RW=\(window\.ZAYA_CATALOG\|\|\{\}\)\.RW\|\|\[\]/);
});

test('photos come from the signed urls with CORS enabled', () => {
  const out = buildCatalogHtml(source);
  expect(out).not.toContain('"photos/"');
  expect(out).toContain('crossOrigin="anonymous"');
  expect(out).toContain('m[6]');
});

test('links to the marketing site are neutralised', () => {
  const out = buildCatalogHtml(source);
  expect(out).not.toContain('href="index.html"');
});

test('a source that does not look like the catalog is rejected', () => {
  expect(() => buildCatalogHtml('<html></html>')).toThrow();
});
