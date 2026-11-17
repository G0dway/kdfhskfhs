import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';

async function openDownloadedPage({crypto = globalThis.crypto, denyStorage = false} = {}) {
  const {window} = parseHTML(await readFile(new URL('../dist/index.html', import.meta.url), 'utf8'));
  const {document} = window;
  const entry = document.querySelector('script');
  assert.ok(entry, 'The page includes its application script');
  assert.notEqual(entry.getAttribute('type'), 'module', 'Downloaded file:// pages must not depend on cross-file ES module loading');
  assert.equal(entry.getAttribute('src'), null, 'A downloaded HTML file must include its application code');
  assert.ok(document.querySelector('style'), 'A downloaded HTML file must include its styles');
  const storage = new Map();
  window.innerWidth = 1440;
  Object.defineProperty(window.HTMLElement.prototype, 'getBoundingClientRect', {value() {return {left:0,top:0,bottom:100,right:880,width:880,height:562};}, configurable:true});
  const canvas = document.querySelector('#networkCanvas');
  canvas.getBoundingClientRect = () => ({left:0,top:0,width:880,height:562});
  for (const el of [canvas, document.querySelector('#canvasView')]) {
    Object.defineProperty(el, 'clientWidth', {value:880});
    Object.defineProperty(el, 'clientHeight', {value:562});
  }
  const captured = new Set();
  canvas.setPointerCapture = id => captured.add(id);
  canvas.hasPointerCapture = id => captured.has(id);
  canvas.releasePointerCapture = id => captured.delete(id);
  const modal = document.querySelector('#modal');
  modal.showModal = function() {this.open = true;};
  modal.close = function() {this.open = false;};
  class DOMFormData {
    constructor(form) {
      this.data = new Map();
      for (const el of form.querySelectorAll('[name]')) {
        if (el.type === 'checkbox' && !el.checked) continue;
        const value = el.tagName === 'SELECT'
          ? (el.querySelector('option[selected]') || el.querySelector('option')).getAttribute('value')
          : el.value;
        this.data.set(el.name, value ?? '');
      }
    }
    [Symbol.iterator]() {return this.data.entries();}
    get(key) {return this.data.get(key);}
    has(key) {return this.data.has(key);}
  }
  const context = vm.createContext({
    window, document, crypto, structuredClone, Blob, URL, FormData:DOMFormData,
    localStorage:{getItem(key) {if(denyStorage)throw new Error('Storage blocked');return storage.get(key)||null;},setItem(key,value) {if(denyStorage)throw new Error('Storage blocked');storage.set(key,value);}},
    ResizeObserver:class {observe() {}}, requestAnimationFrame:fn=>fn(),
    setTimeout:()=>0, clearTimeout:()=>{}, console
  });
  new vm.Script(entry.textContent, {filename:'downloaded-index.html'}).runInContext(context);
  const $ = selector => document.querySelector(selector);
  const click = selector => {const el=$(selector);assert.ok(el,`Control exists: ${selector}`);el.click();};
  const submit = selector => $(selector).dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  const savedMap = () => {const saved=JSON.parse(storage.get('netra.workspace.v1'));return saved.maps.find(m=>m.id===saved.currentId).map;};
  return {window, document, $, click, submit, savedMap, canvas};
}

test('downloaded HTML starts its classic script and buttons open dialogs', async () => {
  const {document,$,click}=await openDownloadedPage();
  assert.equal(document.querySelectorAll('#scene [data-node]').length,14);
  click('#addDevice');assert.equal($('#modal').open,true);assert.ok($('#deviceForm'));
  click('[data-close-modal]');assert.equal($('#modal').open,false);
  click('#allMaps');assert.match($('#modal').textContent,/Мои карты/);
});

test('inventory, search and VLAN buttons work from the shipped page', async () => {
  const {$,document,window,click}=await openDownloadedPage();
  click('[data-view="devices"]');assert.equal($('#tableView').hidden,false);
  assert.equal(document.querySelectorAll('tbody tr').length,14);
  $('#search').value='10.10.30';$('#search').dispatchEvent(new window.Event('input'));
  assert.equal(document.querySelectorAll('tbody tr').length,3);
  $('#search').value='';$('#search').dispatchEvent(new window.Event('input'));
  click('[data-view="subnets"]');assert.equal(document.querySelectorAll('.subnet-card').length,5);
});

test('device form saves changes and undo/redo buttons update the map', async () => {
  const {$,click,submit,savedMap}=await openDownloadedPage();
  click('#addDevice');$('#deviceForm [name="name"]').value='Local-Switch';
  $('#deviceForm [name="ip"]').value='192.168.1.5';submit('#deviceForm');
  assert.equal(savedMap().nodes.length,15);assert.ok(savedMap().nodes.some(n=>n.name==='Local-Switch'));
  click('#undo');assert.equal(savedMap().nodes.length,14);
  click('#redo');assert.equal(savedMap().nodes.length,15);
});

test('application starts when crypto.randomUUID is unavailable', async () => {
  const {document,click,$}=await openDownloadedPage({crypto:{}});
  assert.equal(document.querySelectorAll('#scene [data-node]').length,14);
  click('#quickNew');assert.ok($('#newMapForm'));
});

test('blocked local storage leaves the editor and export menu usable', async () => {
  const {document,click,$}=await openDownloadedPage({denyStorage:true});
  assert.equal(document.querySelectorAll('#scene [data-node]').length,14);
  assert.match($('#saveIndicator').textContent,/Скачайте копию/);
  click('#exportButton');assert.equal($('#popover').hidden,false);
  assert.match($('#popover').textContent,/JSON/);
  click('#addDevice');assert.ok($('#deviceForm'));
});
