const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const meta = require('../api/_meta');
const source = fs.readFileSync(require.resolve('../scripts/meta-pixel.js'), 'utf8');
function browser({ cookie = '', host = 'revivefw.com', path = '/free-pass', gpc = false, search = '' } = {}) {
  const nodes = [], callbacks = {};
  const node = () => ({ style: {}, children: [], appendChild(n) { this.children.push(n); nodes.push(n); }, setAttribute() {}, addEventListener(name, fn) { this[name] = fn; } });
  const document = { cookie, readyState: 'loading', body: node(), createElement: node, getElementById: id => nodes.find(n => n.id === id), querySelector: () => null,
    addEventListener: (key, fn) => { callbacks[key] = fn; }, getElementsByTagName: () => [{ parentNode: { insertBefore: n => nodes.push(n) } }] };
  const window = { location: { hostname: host, pathname: path, href: 'https://' + host + path + search }, navigator: { globalPrivacyControl: gpc }, crypto: { randomUUID: () => 'test' }, history: { state: null, replaceState(_, __, url) { window.location.href = url; } } };
  vm.runInNewContext(source, { window, document, URL });
  return { window, document, nodes, ready: callbacks.DOMContentLoaded, events: () => window.fbq ? window.fbq.queue.map(args => Array.from(args)) : [] };
}
test('Pixel respects consent, GPC, private pages, and preview isolation', () => {
  for (const options of [{}, { cookie: 'revive_ads=no' }, { cookie: 'revive_ads=yes', gpc: true }, { cookie: 'revive_ads=yes', host: 'preview.vercel.app' }, ...['/careers','/admin','/pass-feedback','/privacy'].map(path => ({ path, cookie:'revive_ads=yes' }))]) {
    const b = browser(options); assert.equal(b.events().length, 0); assert.equal(b.window.reviveMeta.allowed(), false);
  }
  const b = browser({ cookie:'revive_ads=yes', search:'?email=private@example.com&fbclid=valid_click&token=secret#token=secret' });
  assert.equal(b.window.location.href, 'https://revivefw.com/free-pass?fbclid=valid_click');
  assert.ok(b.events().some(e => e[0] === 'set' && e[1] === 'autoConfig' && e[2] === false));
  assert.equal(b.events().filter(e => e[0] === 'track').map(e => e[1]).join(','), 'PageView,ViewContent');
  assert.equal(b.window.reviveMeta.track('Lead', {}, 'arbitrary-client-id'), false);
  const id = 'website-pass-00000000-0000-4000-8000-000000000000';
  assert.equal(b.window.reviveMeta.track('Lead', {}, id), true);
  assert.equal(b.events().at(-1)[3].eventID, id);
});
test('Privacy controls let guests decline and later allow without duplicate page views', () => {
  const b = browser(); b.ready();
  const decline = b.nodes.find(n => n.textContent === 'Decline'); decline.click();
  assert.equal(b.window.reviveMeta.allowed(), false);
  b.nodes.find(n => n.textContent === 'Allow').click();
  assert.equal(b.window.reviveMeta.allowed(), true);
  decline.click(); assert.equal(b.window.reviveMeta.track('Contact', {}), false);
});
test('Server matching hashes contacts and validates cookies without leaking token errors', async () => {
  assert.equal(meta.hashEmail(' Guest@Example.com '), meta.sha256('guest@example.com'));
  assert.equal(meta.hashPhone('(260) 555-1234'), meta.sha256('12605551234'));
  assert.equal(meta.getCookie({headers:{cookie:'_fbp=%ZZ'}},'_fbp'), undefined);
  const data = meta.buildUserData({ headers:{cookie:'_fbp=bad; _fbc=bad','user-agent':'test'} }, {email:'guest@example.com'});
  assert.equal(data.em[0].length,64); assert.equal(data.fbp,undefined); assert.equal(data.fbc,undefined);
  const oldFetch = global.fetch, oldEnv = {...process.env};
  Object.assign(process.env,{META_PIXEL_ID:'1236948538486968',META_CAPI_TOKEN:'secret-test'});
  try {
    global.fetch = async (url, options) => { assert.ok(!url.includes('secret-test')); assert.equal(options.headers.Authorization,'Bearer secret-test'); return {ok:true,status:200,json:async()=>({events_received:1})}; };
    assert.equal((await meta.sendCapiEvents([{event_name:'Lead',event_id:'stable'}])).ok,true);
    global.fetch = async()=>({ok:true,status:200,json:async()=>({events_received:0})});
    assert.equal((await meta.sendCapiEvents([{event_name:'Lead'}])).ok,false);
  } finally { global.fetch=oldFetch; for(const key of Object.keys(process.env)) if(!(key in oldEnv)) delete process.env[key]; Object.assign(process.env,oldEnv); }
});
test('Tracking gates require production, explicit consent, cookie, and matching pixel', () => {
  const {allowed}=require('../api/_pass-tracking'); const before=process.env.META_PIXEL_ID; process.env.META_PIXEL_ID='1236948538486968';
  const req={headers:{host:'revivefw.com',cookie:'revive_ads=yes'}};
  try {
    assert.equal(allowed(req,{adMeasurement:true}),true);
    for(const r of [{headers:{...req.headers,'sec-gpc':'1'}},{headers:{...req.headers,host:'preview.vercel.app'}},{headers:{host:'revivefw.com'}}]) assert.equal(allowed(r,{adMeasurement:true}),false);
    assert.equal(allowed(req,{}),false);
  } finally { if(before===undefined)delete process.env.META_PIXEL_ID;else process.env.META_PIXEL_ID=before; }
});
test('Job applications have no pixel or CAPI Lead and require correct CAPTCHA action', () => {
  const job=fs.readFileSync(require.resolve('../api/apply'),'utf8');
  assert.doesNotMatch(job,/sendCapi|sendMetaLead|buildUserData/);
  assert.match(job,/vj.action !== 'job_application'/);
  assert.doesNotMatch(fs.readFileSync(require.resolve('../careers.html'),'utf8'),/scripts\/meta-pixel/);
});
