const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const path = require('node:path');
const root = path.join(__dirname, '..');
function load(file, modules) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, require: id => modules[id], Date, Number, Math, Error, Uint8Array });
  return exports;
}
const react = { useRef: () => ({ current: false }), useState: v => [v, () => {}],
  createElement: (type, props, ...children) => ({ type, props, children }) };
react.default = react;
let imported = 0, converted = 0, alerts = [], failGPS = false, cafe = null, inserts = 0;
const coords = { latitude: 37.1, longitude: 28.2, accuracy: 10 };
const gps = { requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  hasServicesEnabledAsync: async () => true, Accuracy: { High: 4 },
  getCurrentPositionAsync: async () => ({ coords: { ...coords, accuracy: failGPS ? 90 : 10 }, timestamp: Date.now() }) };
const { getFreshLocation } = load('deviceLocation.js', { 'expo-location': gps });
const native = { View: 'View', Text: 'Text', TouchableOpacity: 'Button', ActivityIndicator: 'Spinner', Alert: { alert: (...v) => alerts.push(v) } };
const supabase = {
  auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }), getSession: async () => ({ data: { session: {} } }) },
  functions: { invoke: async (name, { body }) => {
    assert.equal(name, 'import-menu'); assert.equal(body.image, 'jpeg-base64'); assert.equal(body.mimeType, 'image/jpeg');
    imported++; return { data: { count: 2 } };
  } },
  from: () => {
    const query = { select: () => query, eq: () => query, order: () => query, limit: () => query,
      maybeSingle: async () => ({ data: cafe }),
      insert: row => { inserts++; cafe = { ...row, id: 1 }; return query; },
      update: row => { cafe = { ...cafe, ...row }; return query; }, single: async () => ({ data: cafe }) };
    return query;
  },
};
function buttons(tree) { return [tree, ...tree.children.flat(Infinity).filter(v => v && typeof v === 'object').flatMap(buttons)].filter(v => v.type === 'Button'); }
(async () => {
  assert.equal((await getFreshLocation()).coords.accuracy, 10);
  failGPS = true; await assert.rejects(getFreshLocation, /GPS/); failGPS = false;
  const Demo = load('DemoCafeButton.js', { react, 'react-native': native, './supabase': { supabase }, './deviceLocation': { getFreshLocation } }).default;
  const navigate = (screen, { item }) => { assert.equal(screen, 'Details'); assert.equal(item.name, 'deneme'); assert.equal(item.latitude, coords.latitude); };
  const demo = buttons(Demo({ navigation: { navigate } }))[0];
  await demo.props.onPress(); await demo.props.onPress(); assert.equal(inserts, 1);
  const picker = { requestCameraPermissionsAsync: async () => ({ granted: true }),
    launchCameraAsync: async () => ({ assets: [{ uri: 'file:///menu.heic', width: 4000, height: 3000 }] }),
    launchImageLibraryAsync: async () => ({ assets: [{ uri: 'file:///menu.png', width: 4000, height: 3000 }] }) };
  const Menu = load('MenuPhotoImport.js', { react, 'react-native': native, 'expo-image-picker': picker,
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: async (uri, actions, options) => {
      assert.equal(actions[0].resize.width, 2400); assert.equal(options.format, 'jpeg'); converted++; return { base64: 'jpeg-base64' };
    } }, './supabase': { supabase }, './momentApi': { decodePhoto: b => { assert.equal(b, 'jpeg-base64'); return { contentType: 'image/jpeg' }; } } }).default;
  const menu = buttons(Menu({ venueId: 1, onImported: async () => {} }));
  await menu[0].props.onPress(); await menu[1].props.onPress();
  assert.equal(imported, 2); assert.equal(converted, 2); assert.equal(alerts.length, 2);
  console.log('PASS: accurate GPS, inaccurate GPS rejection, deneme cafe reuse, camera/gallery JPEG preparation and import');
})().catch(error => { console.error(error); process.exitCode = 1; });
