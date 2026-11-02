const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { buildSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const temp = path.join(root, 'node_modules', '.cache', 'shop-test.cjs');
fs.mkdirSync(path.dirname(temp), { recursive: true });
buildSync({ entryPoints: [path.join(root, 'src/components/ShopView.tsx')], outfile: temp, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] });
const Shop = require(temp).default;
const markup = renderToStaticMarkup(React.createElement(Shop));
const source = fs.readFileSync(path.join(root, 'src/components/ShopView.tsx'), 'utf8');
test('renders the six exact crystal packs from the shop repository', () => {
  assert.equal((markup.match(/<article/g) || []).length, 6);
  for (const gems of [60,150,320,700,1500,3500]) assert.ok(markup.includes('Купить ' + gems + ' кристаллов — скоро'));
  for (const price of [59,139,269,549,999,1999]) assert.ok(markup.includes(price.toLocaleString('ru-RU') + ' ₽'));
});
test('all purchase buttons are disabled; no live payment or wallet side effects', () => {
  const buttons = markup.match(/<button[^>]*>/g) || [];
  const buy = buttons.filter(x => x.includes('Купить '));
  assert.equal(buy.length, 6);
  assert.ok(buy.every(x => x.includes('disabled')));
  assert.ok(!markup.includes('<a '));
  assert.ok(!/fetch\(|\/api\/user|localStorage|iframe|donationalerts\.com\/r\//.test(source));
});
test('music is not selected, does not fetch or autoplay; controls stay disabled', () => {
  assert.ok(!markup.includes('<audio'));
  assert.ok(markup.includes('Трек ещё не выбран'));
  assert.ok(!source.includes('autoPlay'));
  assert.ok(source.includes('element.pause(); element.removeAttribute("src")'));
  assert.ok(source.includes('preload="none"'));
  assert.ok(source.includes('await element.play()'));
});
test('shop is wired in navigation, view union, title and renderer', () => {
  const nav = fs.readFileSync(path.join(root,'src/components/Sidebar.tsx'),'utf8');
  const app = fs.readFileSync(path.join(root,'src/App.tsx'),'utf8');
  assert.ok(nav.includes('"shop" |'));
  assert.ok(nav.includes('id: "shop", label: "Магазин", icon: IconShop'));
  assert.ok(app.includes('view === "shop" && <ShopView />'));
  assert.ok(app.includes('shop: { title: "Магазин"'));
});
