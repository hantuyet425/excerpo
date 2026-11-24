const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(predicate) {
  for (let i = 0; i < 1000; i++) {
    if (predicate()) return;
    await tick();
  }
  assert.fail('Download did not reach the expected state');
}
function deferred() {
  let resolve;
  const promise = new Promise(r => resolve = r);
  return { promise, resolve };
}
function chapter(number, extra = {}) {
  return { chapter_number: number, chapter_title: `Chương ${number} — 中文`,
    chapter_url: `https://www.royalroad.com/fiction/123/test/chapter/${number}`,
    bookUrl: 'https://www.royalroad.com/fiction/123/test', bookName: 'Truyện & <test>',
    authorName: 'Tác giả', format: 'txt', ...extra };
}
function result(c) {
  return { chapter_title: c.chapter_title, content: `Nội dung ${c.chapter_number}. ` + 'Văn bản tiếng Việt 中文. '.repeat(12) + '\n\nĐoạn thứ hai.' };
}

function harness({ fetch = async c => result(c), state = {}, delay = 0,
  downloadError = false, downloadState, storageError = () => false } = {}) {
  const storage = { chapterDelay: delay, ...structuredClone(state) };
  const downloads = [];
  const messages = [];
  const calls = [];
  const handlers = [];
  const downloadListeners = new Set();
  class FileReader {
    readAsDataURL(blob) {
      blob.arrayBuffer().then(bytes => {
        this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString('base64')}`;
        this.onload();
      }, error => { this.error = error; this.onerror(); });
    }
  }
  const context = vm.createContext({
    Blob, FileReader, TextEncoder, TextDecoder, structuredClone, crypto: webcrypto,
    Uint8Array, ArrayBuffer, setImmediate, clearImmediate,
    setTimeout: (fn, ms) => { const t = setTimeout(fn, ms); t.unref(); return t; }, clearTimeout,
    console: { log() {}, warn() {}, error() {} },
    chrome: {
      runtime: {
        onMessage: { addListener: fn => handlers.push(fn) },
        sendMessage: async message => { messages.push(structuredClone(message)); },
        getURL: p => p
      },
      offscreen: { hasDocument: async () => true },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {} },
      storage: { local: {
        get: async key => typeof key === 'string' ? { [key]: structuredClone(storage[key]) } : structuredClone(storage),
        set: async data => {
          if (storageError()) throw new Error('Storage unavailable');
          Object.assign(storage, structuredClone(data));
        }
      } },
      downloads: {
        download: async options => { downloads.push(options); return downloads.length; },
        search: async () => [{ state: downloadState ||
          ((typeof downloadError === 'function' ? downloadError() : downloadError) ? 'interrupted' : 'complete'), error: 'DISK_FULL' }],
        onChanged: { addListener: fn => downloadListeners.add(fn), removeListener: fn => downloadListeners.delete(fn) }
      }
    }
  });
  context.self = context;
  context.importScripts = (...files) => files.forEach(file => {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  });
  context.fetchStub = async c => { calls.push(c.chapter_number); return fetch(c); };
  vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), context, { filename: 'background.js' });
  vm.runInContext('fetchChapterContentInBackground = (s, c) => fetchStub(c); keepAliveWait = async () => {};', context);
  const api = vm.runInContext('({ buildBookText, buildEpubBuffer, outputFilename, getTask: () => activeBatchTask, ready: storageInitPromise, JSZip })', context);
  const send = message => new Promise(resolve => handlers[0](message, {}, resolve));
  return { ...api, send, storage, calls, downloads, messages, downloadListeners };
}

test('parallel completion produces one UTF-8 TXT in selected chapter order', async () => {
  const gates = [deferred(), deferred(), deferred()];
  const h = harness({ fetch: c => gates[c.chapter_number - 1].promise });
  await h.ready;
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [1, 2, 3].map(n => chapter(n)) } });
  await until(() => h.calls.length === 3);
  gates[2].resolve(result(chapter(3)));
  gates[1].resolve(result(chapter(2)));
  await until(() => h.getTask().doneCount === 2);
  assert.equal(h.downloads.length, 0, 'never export a partial book');
  gates[0].resolve(result(chapter(1)));
  await until(() => h.getTask().status === 'completed');
  assert.equal(h.downloads.length, 1);
  const text = Buffer.from(h.downloads[0].url.split(',')[1], 'base64').toString('utf8');
  assert.equal(text, [1, 2, 3].map(n => result(chapter(n))).map(c => `${c.chapter_title}\n\n${c.content}`).join('\n\n\n'));
  assert.match(h.downloads[0].filename, /#1-3_Truyện & _test_\.txt$/);
  assert.ok(h.messages.every(m => !m.data || !Object.hasOwn(m.data, 'results')));
  assert.equal(h.downloadListeners.size, 0);
});

test('EPUB contains all chapter files, valid ZIP layout and matching TOC/spine order', async () => {
  const h = harness();
  await h.ready;
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [1, 4, 12].map(n => chapter(n, { format: 'epub' })) } });
  await until(() => h.getTask().status === 'completed');
  assert.equal(h.downloads.length, 1);
  const bytes = Buffer.from(h.downloads[0].url.split(',')[1], 'base64');
  assert.equal(bytes.readUInt16LE(8), 0, 'mimetype must be stored uncompressed');
  assert.equal(bytes.subarray(30, 38).toString(), 'mimetype');
  const zip = await h.JSZip.loadAsync(new Uint8Array(bytes));
  assert.equal(await zip.file('mimetype').async('string'), 'application/epub+zip');
  const opf = await zip.file('OEBPS/content.opf').async('string');
  const toc = await zip.file('OEBPS/toc.ncx').async('string');
  assert.match(opf, /Truyện &amp; &lt;test&gt;/);
  assert.match(opf, /Tác giả/);
  for (const [i, n] of [1, 4, 12].entries()) {
    assert.match(await zip.file(`OEBPS/chapter-${i + 1}.xhtml`).async('string'), new RegExp(`Chương ${n} — 中文`));
    assert.ok(opf.includes(`idref="chapter-${i + 1}"`));
    assert.ok(toc.includes(`src="chapter-${i + 1}.xhtml"`));
  }
  assert.ok(toc.indexOf('Chương 1 —') < toc.indexOf('Chương 4 —'));
  assert.ok(toc.indexOf('Chương 4 —') < toc.indexOf('Chương 12 —'));
});

test('failed chapters block export, survive popup closure, and retry only missing chapters', async () => {
  let fail = true;
  const h = harness({ fetch: async c => {
    if (c.chapter_number === 2 && fail) throw new Error('Network error');
    return result(c);
  } });
  await h.ready;
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [1, 2, 3].map(n => chapter(n)) } });
  await until(() => h.getTask().status === 'error');
  assert.equal(h.downloads.length, 0);
  assert.equal(h.getTask().doneCount, 2);
  assert.match(h.getTask().queue[0].error, /Chương 2.*Network error/);
  const progress = await h.send({ type: 'GET_TASK_STATUS' });
  assert.equal(progress.status, 'error');
  assert.equal(Object.hasOwn(progress, 'results'), false);
  const blocked = await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [chapter(4)] } });
  assert.equal(blocked.status, 'error', 'a new job cannot erase unfinished content');
  const previous = h.calls.length;
  fail = false;
  await h.send({ type: 'RETRY_BATCH_DOWNLOAD' });
  await until(() => h.getTask().status === 'completed');
  assert.deepEqual(h.calls.slice(previous), [2]);
  assert.equal(h.downloads.length, 1);
});

test('stop retains content and resume finishes the same selection', async () => {
  const gate = deferred();
  const h = harness({ delay: 1, fetch: c => c.chapter_number === 1 ? gate.promise : result(c) });
  await h.ready;
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [1, 2].map(n => chapter(n)) } });
  await until(() => h.calls.length === 1);
  await h.send({ type: 'STOP_BATCH_DOWNLOAD' });
  gate.resolve(result(chapter(1)));
  await until(() => h.getTask().status === 'stopped');
  assert.equal(h.downloads.length, 0);
  assert.ok(h.storage.activeBatchTask.results[0]);
  await h.send({ type: 'RETRY_BATCH_DOWNLOAD' });
  await until(() => h.getTask().status === 'completed');
  assert.deepEqual(h.calls, [1, 2]);
  assert.equal(h.downloads.length, 1);
});

test('restart revisits unfinished assigned chapters and reuses saved results', async () => {
  const first = chapter(1, { batchId: 'saved' });
  const second = chapter(2, { batchId: 'saved' });
  const task = { version: 2, status: 'running', chapters: [first, second],
    results: [result(first)], errors: [], nextIdx: 2, doneCount: 1,
    queue: [{ id: 'saved', bookName: first.bookName, total: 2, done: 1, status: 'running' }] };
  const h = harness({ state: { activeBatchTask: task } });
  await until(() => h.getTask()?.status === 'completed');
  assert.deepEqual(h.calls, [2]);
  assert.equal(h.downloads.length, 1);
});

test('cancelling a selection never exports it or shifts another book indices', async () => {
  const gate = deferred();
  const h = harness({ delay: 1, fetch: c => c.chapter_number === 1 ? gate.promise : result(c) });
  await h.ready;
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [1, 2].map(n => chapter(n)) } });
  await until(() => h.calls.length === 1);
  const id = h.getTask().queue[0].id;
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [chapter(10, {
    bookUrl: 'https://www.royalroad.com/fiction/456/other', bookName: 'Other'
  })] } });
  await h.send({ type: 'CANCEL_BOOK', batchId: id });
  gate.resolve(result(chapter(1)));
  await until(() => h.getTask().status === 'completed');
  assert.deepEqual(h.calls, [1, 10]);
  assert.equal(h.downloads.length, 1);
  assert.match(h.downloads[0].filename, /Other/);
});

test('separate selections of the same book each produce exactly one file', async () => {
  const gate = deferred();
  const h = harness({ fetch: c => c.chapter_number === 1 ? gate.promise : result(c) });
  await h.ready;
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [chapter(1)] } });
  await until(() => h.calls.length === 1);
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [chapter(5)] } });
  gate.resolve(result(chapter(1)));
  await until(() => h.getTask().status === 'completed');
  assert.equal(h.downloads.length, 2);
  assert.ok(h.downloads.some(d => d.filename.includes('#1_')));
  assert.ok(h.downloads.some(d => d.filename.includes('#5_')));
});

test('download failure remains an error instead of reporting completion', async () => {
  const h = harness({ downloadError: true });
  await h.ready;
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [chapter(1)] } });
  await until(() => h.getTask().status === 'error');
  assert.equal(h.downloads.length, 1);
  assert.match(h.getTask().queue[0].error, /DISK_FULL/);
});

test('DOCX remains a per-chapter download', async () => {
  const h = harness();
  await h.ready;
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [1, 2].map(n => chapter(n, { format: 'docx' })) } });
  await until(() => ['error', 'completed'].includes(h.getTask().status));
  assert.equal(h.getTask().status, 'completed');
  assert.equal(h.downloads.length, 2);
  assert.ok(h.downloads.every(d => d.filename.endsWith('.docx')));
});

test('Chrome must finish saving before the book is reported completed', async () => {
  const h = harness({ downloadState: 'in_progress' });
  await h.ready;
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [chapter(1)] } });
  await until(() => h.downloadListeners.size === 1);
  assert.equal(h.getTask().queue[0].status, 'exporting');
  for (const listener of h.downloadListeners) listener({ id: 1, state: { current: 'complete' } });
  await until(() => h.getTask().status === 'completed');
  assert.equal(h.downloadListeners.size, 0);
});

test('restart during file saving reattaches to the existing download', async () => {
  const c = chapter(1, { batchId: 'saving' });
  const task = { version: 2, status: 'running', chapters: [c], results: [result(c)], errors: [],
    nextIdx: 1, doneCount: 1, queue: [{ id: 'saving', bookName: c.bookName, total: 1, done: 1,
      status: 'exporting', downloadId: 99 }] };
  const h = harness({ state: { activeBatchTask: task } });
  await until(() => h.getTask()?.status === 'completed');
  assert.deepEqual(h.calls, []);
  assert.equal(h.downloads.length, 0, 'do not submit a second file');
});

test('retrying a failed file save reuses every fetched chapter', async () => {
  let fail = true;
  const h = harness({ downloadError: () => fail });
  await h.ready;
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [chapter(1)] } });
  await until(() => h.getTask().status === 'error');
  fail = false;
  await h.send({ type: 'RETRY_BATCH_DOWNLOAD' });
  await until(() => h.getTask().status === 'completed');
  assert.deepEqual(h.calls, [1]);
  assert.equal(h.downloads.length, 2, 'only the interrupted file is submitted again');
});

test('storage failure remains visible and can be retried without losing the selection', async () => {
  let fail = true;
  const h = harness({ storageError: () => fail });
  await h.ready;
  const response = await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [chapter(1)] } });
  assert.equal(response.status, 'error');
  assert.equal(h.getTask().status, 'error');
  assert.match(h.getTask().error, /Storage unavailable/);
  assert.deepEqual(h.calls, []);
  fail = false;
  await h.send({ type: 'RETRY_BATCH_DOWNLOAD' });
  await until(() => h.getTask().status === 'completed');
  assert.equal(h.downloads.length, 1);
});

test('partial OCR errors cannot enter an otherwise long book chapter', async () => {
  const h = harness({ fetch: async c => ({ ...result(c), content: result(c).content + '\n[LỖI OCR thẻ p #2: timeout]' }) });
  await h.ready;
  await h.send({ type: 'ADD_TO_BATCH_DOWNLOAD', data: { chapters: [chapter(1)] } });
  await until(() => h.getTask().status === 'error');
  assert.equal(h.calls.length, 5);
  assert.equal(h.downloads.length, 0);
  assert.equal(h.getTask().doneCount, 0);
});
