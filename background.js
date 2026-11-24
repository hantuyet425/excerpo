// background.js

importScripts(
  'docx.js',
  'jszip.js',
  'scripts/book-export.js',
  // 🇨🇳 Trung Quốc (Giản thể)
  'sources/17k.js',
  'sources/22biqu.js',
  'sources/uukanshu.js',
  'sources/jjwxc.js',
  'sources/qidian.js',
  'sources/biquge.js',
  'sources/52shuku.js',
  'sources/fanqienovel.js',
  'sources/69shuba.js',
  'sources/novel543.js',
  'sources/ixdzs8.js',
  'sources/bookqq.js',
  'sources/hetushu.js',
  'sources/xbanxia.js',
  'sources/69shumi.js',
  'sources/xbiquge.js',
  'sources/23qb.js',
  'sources/shubaow.js',
  'sources/powanjuan.js',
  'sources/shuhaige.js',
  // 🇹🇼 Đài Loan (Phồn thể)
  'sources/po18.js',
  'sources/sto55.js',
  'sources/sto9.js',
  'sources/twkan.js',
  'sources/ttkan.js',
  'sources/69shubatw.js',
  'sources/alicesw.js',
  // 🇯🇵 Nhật Bản
  'sources/kakuyomu.js',
  'sources/syosetu.js',
  'sources/syosetu_org.js',
  'sources/pixiv.js',
  // 🌍 Âu Mỹ / Toàn cầu
  'sources/royalroad.js',
  'sources/scribblehub.js',
  'sources/ao3.js',
  'sources/novellunar.js',
  'sources/fictionpress.js',
  'sources/foxaholic.js',
  'sources/lnmtl.js',
  'sources/freewebnovel.js',
  'sources/cardboardtranslation.js',
  'sources/noveldex.js',
  'sources/novelight.js',
  // 🇹🇷 Thổ Nhĩ Kỳ
  'sources/fenrirscans.js',
  // 🇷🇺 Nga
  'sources/ranobelib.js',
  // 🇧🇷 Brazil
  'sources/centralnovel.js',
  'sources/phoenixnovels.js',
  // 🇮🇩 Indonesia
  'sources/ihuaben.js',
  'sources/meionovel.js',
  'sources/novelgo.js',
  'sources/wbnovel.js',
  // 🇫🇷 Pháp
  'sources/chireads.js',
  // 🇹🇼 Đài Loan Mới
  'sources/czbooks.js',
  // Utils
  'scripts/source-utils.js',
);

const SOURCES = [
  // 🇨🇳 Trung Quốc (Giản thể)
  Source17k,
  Source22biqu,
  SourceUukanshu,
  SourceJjwxc,
  SourceQidian,
  SourceBiquge,
  Source52shuku,
  SourceFanqienovel,
  Source69shuba,
  SourceNovel543,
  SourceIxdzs8,
  SourceBookQQ,
  SourceHetushu,
  SourceXbanxia,
  Source69shumi,
  SourceXbiquge,
  Source23qb,
  SourceShubaow,
  SourcePowanjuan,
  SourceShuhaige,
  // 🇹🇼 Đài Loan (Phồn thể)
  SourcePo18,
  SourceSto55,
  SourceSto9,
  SourceTwkan,
  SourceTtkan,
  SourceAlicesw,
  // 🇯🇵 Nhật Bản
  SourceKakuyomu,
  SourceSyosetu,
  SourceSyosetuOrg,
  SourcePixiv,
  // 🌍 Âu Mỹ / Toàn cầu
  SourceRoyalRoad,
  SourceScribbleHub,
  SourceAo3,
  SourceNovelLunar,
  SourceFictionPress,
  SourceFoxaholic,
  SourceLnmtl,
  SourceFreewebnovel,
  SourceCardboardtranslation,
  SourceNoveldex,
  SourceNovelight,
  Source69shubatw,
  // 🇹🇷 Thổ Nhĩ Kỳ
  SourceFenrirScans,
  // 🇷🇺 Nga
  SourceRanobelib,
  // 🇧🇷 Brazil
  SourceCentralNovel,
  SourcePhoenixNovels,
  // 🇮🇩 Indonesia
  SourceIhuaben,
  SourceMeionovel,
  SourceNovelgo,
  SourceWbnovel,
  // 🇫🇷 Pháp
  SourceChireads,
  // 🇹🇼 Đài Loan Mới
  SourceCzbooks,
];
function getSource(url) {
  return SOURCES.find(s => s.pattern.test(url)) || null;
}

// ─── KeepAlive Sleep (tránh service worker bị Chrome suspend) ────────────────
async function keepAliveWait(ms) {
  const CHUNK = 20000; // ping mỗi 20s
  let remaining = ms;
  while (remaining > 0) {
    const wait = Math.min(CHUNK, remaining);
    await new Promise(r => setTimeout(r, wait));
    remaining -= wait;
    // Gửi ping để Chrome biết service worker vẫn còn việc làm
    chrome.runtime.sendMessage({ type: 'KEEPALIVE_PING' }).catch(() => { });
  }
}

// ─── Config ───────────────────────────────────────────────
const WORKER_COUNT = 3;

// ─── Task State ──────────────────────────────────────────
// ── QUẢN LÝ QUẢNG CÁO ──
let downloadedSinceLastAd = 0;
const adsLinks = [
  "https://omg10.com/4/10735701", "https://omg10.com/4/10659204", "https://omg10.com/4/10738319", "https://omg10.com/4/10735617",
  "https://omg10.com/4/10735521", "https://omg10.com/4/10738329", "https://omg10.com/4/10738329", "https://omg10.com/4/10738449",
  "https://omg10.com/4/10643504", "https://omg10.com/4/10738341", "https://omg10.com/4/10739756", "https://omg10.com/4/10643607",
  "https://omg10.com/4/10735467", "https://omg10.com/4/10735657", "https://omg10.com/4/10735481", "https://omg10.com/4/10738394",
  "https://omg10.com/4/10735670", "https://omg10.com/4/10738423", "https://omg10.com/4/10735494", "https://omg10.com/4/10643590",
  "https://omg10.com/4/10738345"
];

let activeBatchTask = null;
let storageInitResolve;
const storageInitPromise = new Promise(r => storageInitResolve = r);
let storageWrite = Promise.resolve();

function getTaskProgress() {
  if (!activeBatchTask) return null;
  // Keep chapter text in storage, not in every popup progress message.
  const { results, ...progress } = activeBatchTask;
  return progress;
}

function notifyTaskProgress() {
  chrome.runtime.sendMessage({ type: 'TASK_PROGRESS', data: getTaskProgress() }).catch(() => {});
}

async function saveTaskToStorage(task = activeBatchTask) {
  if (!task) return;
  const snapshot = structuredClone({ ...task, activeChapters: [] });
  // Serialize snapshots so an older worker cannot overwrite newer results.
  storageWrite = storageWrite.catch(() => {}).then(() => chrome.storage.local.set({ activeBatchTask: snapshot }));
  try {
    await storageWrite;
  } catch (err) {
    task.status = 'error';
    task.error = `Không lưu được tiến độ: ${err.message}`;
    updateExtensionBadge(task);
    notifyTaskProgress();
    throw err;
  }
  updateExtensionBadge(task);
}

function startBatchDownload() {
  const task = activeBatchTask;
  runBatchDownload().catch(async err => {
    console.error('[Batch]', err);
    task.status = 'error';
    task.error = err.message;
    notifyTaskProgress();
    await saveTaskToStorage(task).catch(e => console.error('[Storage]', e));
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'KEEPALIVE_PING') {
    sendResponse({ alive: true });
    return;
  }
  if (!['ADD_TO_BATCH_DOWNLOAD', 'RETRY_BATCH_DOWNLOAD', 'CANCEL_BOOK', 'STOP_BATCH_DOWNLOAD', 'GET_TASK_STATUS'].includes(message.type)) return;

  storageInitPromise.then(async () => {
    if (message.type === 'GET_TASK_STATUS') {
      sendResponse(getTaskProgress());
      return;
    }

    if (message.type === 'ADD_TO_BATCH_DOWNLOAD') {
      const chapters = message.data?.chapters;
      if (!Array.isArray(chapters) || !chapters.length || chapters.some(c =>
        !c.chapter_url || !getSource(c.bookUrl) || !['txt', 'epub', 'docx'].includes(c.format || 'txt'))) {
        throw new Error('Danh sách chương không hợp lệ.');
      }
      if (activeBatchTask?.status === 'stopping') throw new Error('Đang dừng công việc.');
      if (['error', 'stopped'].includes(activeBatchTask?.status) &&
          activeBatchTask.queue.some(q => !['completed', 'cancelled'].includes(q.status))) {
        throw new Error('Hãy tiếp tục hoặc hủy lượt tải chưa xong trong Hàng đợi trước khi bắt đầu lượt mới.');
      }
      const isNewTask = activeBatchTask?.status !== 'running';
      if (isNewTask) {
        activeBatchTask = {
          version: 2, chapters: [], queue: [], nextIdx: 0, doneCount: 0,
          activeWorkers: 0, workerCount: WORKER_COUNT, activeChapters: [],
          results: [], errors: [], status: 'running', startTime: Date.now()
        };
      }
      const task = activeBatchTask;
      const groups = new Map();
      // Each click is a separate selection, even for the same book.
      for (const chapter of chapters) {
        let book = groups.get(chapter.bookUrl);
        if (!book) {
          book = { id: crypto.randomUUID(), bookUrl: chapter.bookUrl, bookName: chapter.bookName,
            authorName: chapter.authorName, total: 0, done: 0, status: 'pending' };
          groups.set(chapter.bookUrl, book);
          task.queue.push(book);
        }
        task.chapters.push({ ...chapter, batchId: book.id });
        book.total++;
      }
      await saveTaskToStorage(task);
      notifyTaskProgress();
      sendResponse({ status: 'started' });
      if (isNewTask) startBatchDownload();

      if (message.data.openAd) {
        setTimeout(() => {
          const randomAd = adsLinks[Math.floor(Math.random() * adsLinks.length)];
          chrome.tabs.create({ url: randomAd, active: true }, tab => {
            if (tab?.id) setTimeout(() => chrome.tabs.remove(tab.id).catch(() => {}), 60000);
          });
        }, 1000);
      }
      return;
    }

    if (message.type === 'RETRY_BATCH_DOWNLOAD') {
      if (!activeBatchTask || !['error', 'stopped'].includes(activeBatchTask.status)) {
        sendResponse({ status: 'ignored' });
        return;
      }
      activeBatchTask.status = 'running';
      activeBatchTask.nextIdx = 0;
      activeBatchTask.errors = [];
      delete activeBatchTask.error;
      for (const book of activeBatchTask.queue) {
        if (!['completed', 'cancelled'].includes(book.status)) {
          book.status = 'pending';
          delete book.error;
        }
      }
      await saveTaskToStorage();
      sendResponse({ status: 'started' });
      notifyTaskProgress();
      startBatchDownload();
      return;
    }

    if (message.type === 'CANCEL_BOOK') {
      const book = activeBatchTask?.queue.find(q => q.id === message.batchId);
      if (book && !['completed', 'exporting'].includes(book.status)) {
        // Keep indices stable for in-flight workers and persisted results.
        book.status = 'cancelled';
        if (activeBatchTask.queue.every(q => ['completed', 'cancelled'].includes(q.status)) &&
            ['error', 'stopped'].includes(activeBatchTask.status)) activeBatchTask.status = 'completed';
        await saveTaskToStorage();
        notifyTaskProgress();
      }
      sendResponse({ status: 'cancelled' });
      return;
    }

    if (message.type === 'STOP_BATCH_DOWNLOAD') {
      if (activeBatchTask?.status === 'running') {
        activeBatchTask.status = 'stopping';
        await saveTaskToStorage();
        notifyTaskProgress();
        sendResponse({ status: 'stopping' });
      } else sendResponse({ status: 'ignored' });
    }
  }).catch(err => sendResponse({ status: 'error', error: err.message }));
  return true;
});

function updateExtensionBadge(task) {
  if (!chrome.action) return;

  if (task.status === 'running' || task.status === 'stopping') {
    const total = Math.max(1, task.chapters.length);
    const pct = Math.round((task.doneCount / total) * 100);
    chrome.action.setBadgeText({ text: `${pct}%` });
    chrome.action.setBadgeBackgroundColor({ color: task.status === 'stopping' ? '#ea4335' : '#1a73e8' });
  } else if (task.status === 'completed' || task.status === 'stopped') {
    chrome.action.setBadgeText({ text: task.status === 'stopped' ? 'STOP' : 'OK' });
    chrome.action.setBadgeBackgroundColor({ color: task.status === 'stopped' ? '#f4b400' : '#0f9d58' });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 5000);
  } else if (task.status === 'error') {
    chrome.action.setBadgeText({ text: 'ERR' });
    chrome.action.setBadgeBackgroundColor({ color: '#d32f2f' });
  }
}

// ─── The Engine (Parallel Workers) ───────────────────────
function isContentError(result) {
  return !result || typeof result.content !== 'string' || result.__rateLimited ||
    result.content.length < 100 || /NỘI DUNG CHƯA TẢI ĐƯỢC|Hệ thống không tìm thấy nội dung|Lỗi tải nội dung|Lỗi:|LỖI[: ]|COOLDOWN_DETECTED_/.test(result.content);
}

async function downloadBlob(blob, filename, conflictAction, book) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('Không đọc được tệp xuất.'));
    reader.onabort = () => reject(new Error('Đã hủy đọc tệp xuất.'));
    reader.readAsDataURL(blob);
  });
  const id = await chrome.downloads.download({ url: dataUrl, filename, conflictAction, saveAs: false });
  if (book) {
    book.downloadId = id;
    await saveTaskToStorage();
  }
  await waitForDownload(id);
}

function waitForDownload(id) {
  return new Promise((resolve, reject) => {
    const finish = item => {
      if (item?.state === 'complete' || item?.state === 'interrupted') {
        chrome.downloads.onChanged.removeListener(onChanged);
        if (item.state === 'complete') resolve();
        else reject(new Error(item.error || 'Tải tệp bị gián đoạn.'));
      }
    };
    const onChanged = delta => {
      if (delta.id === id && delta.state) finish({ state: delta.state.current, error: delta.error?.current });
    };
    chrome.downloads.onChanged.addListener(onChanged);
    chrome.downloads.search({ id }).then(items => finish(items[0] || {
      state: 'interrupted', error: 'Không tìm thấy tệp tải xuống.'
    })).catch(err => {
      chrome.downloads.onChanged.removeListener(onChanged);
      reject(err);
    });
  });
}

function outputFilename(chapter, title, index, format) {
  const safe = value => String(value).replace(/[\\/:*?"<>|]/g, '_').replace(/[. ]+$/, '') || 'Book';
  const folder = (chapter.folderName || 'Excerpo').split(/[\\/]/)
    .filter(part => part && part !== '.' && part !== '..').map(safe).join('/') || 'Excerpo';
  const name = (chapter.nameFormat || '#{index}_{title}')
    .replace(/\{index\}/g, index).replace(/\{title\}/g, title);
  return `${folder}/${safe(chapter.bookName || 'Book')}/${safe(name)}.${format}`;
}

async function exportCompletedBook(task, book) {
  if (task.status !== 'running' || ['completed', 'cancelled', 'exporting', 'error'].includes(book.status)) return;
  const indices = task.chapters.map((c, i) => c.batchId === book.id ? i : -1).filter(i => i >= 0);
  if (!indices.every(i => task.results[i])) return;
  book.status = 'exporting';
  await saveTaskToStorage(task);
  notifyTaskProgress();
  try {
    const first = task.chapters[indices[0]];
    const format = first.format || 'txt';
    if (book.downloadId !== undefined) {
      await waitForDownload(book.downloadId);
    } else if (format !== 'docx') {
      const chapters = indices.map(i => task.results[i]);
      const firstNumber = first.chapter_number || indices[0] + 1;
      const lastNumber = task.chapters[indices[indices.length - 1]].chapter_number || indices[indices.length - 1] + 1;
      const range = firstNumber === lastNumber ? String(firstNumber) : `${firstNumber}-${lastNumber}`;
      const blob = format === 'txt'
        ? new Blob([buildBookText(chapters)], { type: 'text/plain;charset=utf-8' })
        : new Blob([await buildEpubBuffer(book, chapters)], { type: 'application/epub+zip' });
      await downloadBlob(blob, outputFilename(first, book.bookName || 'Book', range, format), first.conflictAction || 'uniquify', book);
    }
    book.status = 'completed';
    delete book.error;
  } catch (err) {
    book.status = 'error';
    book.error = err.message;
    delete book.downloadId;
  }
  await saveTaskToStorage(task);
  notifyTaskProgress();
}

async function runBatchDownload() {
  const task = activeBatchTask;
  if (!task || task.status !== 'running') return;

  async function worker(workerId) {
    while (task.status === 'running') {
      const i = task.nextIdx;
      if (i >= task.chapters.length) break;
      task.nextIdx = i + 1;
      const c = task.chapters[i];
      const book = task.queue.find(q => q.id === c.batchId);
      if (!book || ['completed', 'cancelled'].includes(book.status) || task.results[i]) continue;
      book.status = 'running';
      const chapterSource = getSource(c.bookUrl);
      const displayTitle = `${c.bookName} - ${c.chapter_title}`;
      task.activeChapters[workerId] = displayTitle;
      notifyTaskProgress();
      try {
        if (!chapterSource) throw new Error('Nguồn không hợp lệ.');
        let result;
        let lastError;
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            result = await fetchChapterContentInBackground(chapterSource, c, workerId);
            if (!isContentError(result)) break;
            lastError = new Error(result?.__rateLimited ? 'Rate limit' : 'Không lấy được đầy đủ nội dung.');
          } catch (err) {
            result = null;
            lastError = err;
          }
          if (attempt < 5 && book.status !== 'cancelled') {
            let wait = result?.__rateLimited ? 60 : 5;
            if (result?.content?.startsWith('COOLDOWN_DETECTED_')) {
              wait = (parseInt(result.content.replace('COOLDOWN_DETECTED_', '')) || 180) + 2;
            }
            task.activeChapters[workerId] = `⏳ ${attempt}/5: ${displayTitle}`;
            await keepAliveWait(wait * 1000);
          }
          if (book.status === 'cancelled') break;
        }
        if (isContentError(result)) throw lastError;
        if (book.status !== 'cancelled') {
          const chapter = { chapter_title: result.chapter_title || c.chapter_title, content: result.content };
          if (c.format === 'docx') {
            const blob = new Blob([await buildDocxBuffer(chapter)], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            await downloadBlob(blob, outputFilename(c, c.chapter_title, String(c.chapter_number || i + 1), 'docx'), c.conflictAction || 'uniquify');
          }
          task.results[i] = c.format === 'docx' ? true : chapter;
          delete task.errors[i];
          task.doneCount++;
          book.done++;
        }
      } catch (err) {
        task.errors[i] = `${c.chapter_title}: ${err.message}`;
        console.error(`[Worker ${workerId}]`, task.errors[i]);
      }
      task.activeChapters[workerId] = null;
      await saveTaskToStorage(task);
      notifyTaskProgress();
      await exportCompletedBook(task, book);
      if (task.status === 'running' && task.nextIdx < task.chapters.length) {
        const storage = await chrome.storage.local.get('chapterDelay');
        const userDelay = (storage.chapterDelay ?? 60) * 1000;
        await keepAliveWait(Math.max(chapterSource?.downloadDelay || 500, userDelay));
      }
    }
  }

  const storage = await chrome.storage.local.get('chapterDelay');
  const numWorkers = Math.max(1, Math.min((storage.chapterDelay ?? 60) > 0 ? 1 : WORKER_COUNT, task.chapters.length));
  task.workerCount = numWorkers;
  task.activeWorkers = numWorkers;
  do {
    await Promise.all(Array.from({ length: numWorkers }, (_, id) => worker(id)));
    // Retry export without fetching chapters again, including after a restart.
    for (const book of task.queue) await exportCompletedBook(task, book);
  } while (task.status === 'running' && task.nextIdx < task.chapters.length);

  task.activeWorkers = 0;
  task.activeChapters = [];
  for (const book of task.queue) {
    if (!['completed', 'cancelled'].includes(book.status)) {
      const errors = task.chapters.flatMap((c, i) => c.batchId === book.id && task.errors[i] ? [task.errors[i]] : []);
      book.status = task.status === 'stopping' ? 'stopped' : 'error';
      if (errors.length) book.error = errors.join('\n');
    }
  }
  task.status = task.status === 'stopping' ? 'stopped'
    : task.queue.some(q => q.status === 'error') ? 'error' : 'completed';
  await saveTaskToStorage(task);
  notifyTaskProgress();
}

// ─── Fetching logic ───────────────────────────────────────
async function fetchChapterContentInBackground(source, chapter, workerId) {
  const shouldBeActive = chapter.type === 'vip';
  const tab = await chrome.tabs.create({ url: chapter.chapter_url, active: shouldBeActive });

  try {
    const contentConfig = typeof source.content === 'function' ? source.content(chapter) : source.content;
    const readySelector = contentConfig?.readySelector || "body";
    // Tối đa chờ 120 lần * 500ms = 60s (Web nước ngoài có thể lag)
    const { ok, alertMsg } = await waitForContentInTab(tab.id, readySelector, 120, 500);

    // Chờ thêm 5 giây riêng cho chương VIP để web xử lý xong giải mã / xác thực
    if (shouldBeActive && ok && !alertMsg) {
      await new Promise(r => setTimeout(r, 5000));
    }

    if (alertMsg) {
      return await parseOnTab(tab.id, source, chapter, alertMsg);
    }
    if (!ok) {
      console.warn(`[Worker ${workerId}] Timeout chờ content: ${chapter.chapter_url}`);
      const errMsg = `Hệ thống không tìm thấy nội dung sau 60s chờ đợi.\nSelector cần tìm: ${readySelector}`;
      return await parseOnTab(tab.id, source, chapter, errMsg);
    }

    return await parseOnTab(tab.id, source, chapter, null);

  } finally {
    chrome.tabs.remove(tab.id).catch(() => { });
  }
}

async function parseOnTab(tabId, source, chapter, alertMsg) {
  const { chapter_title: title, chapter_url: url, chapter_number: num } = chapter;
  console.log(`[parseOnTab] Đang tiến hành bóc tách nội dung chương: ${title} (${url})`);

  if (alertMsg) {
    return {
      chapter_title: title,
      chapter_url: url,
      chapter_number: num,
      content: "NỘI DUNG CHƯA TẢI ĐƯỢC:\n\n" + alertMsg,
      debug: []
    };
  }

  const contentConfig = typeof source.content === 'function' ? source.content(chapter) : source.content;

  // Gọi engine lấy nội dung từ tab
  const parsedResult = contentConfig
    ? await parseContentInTab(tabId, contentConfig)
    : { paragraphs: [], debug: ["Lỗi: Source chưa cấu hình source.content"] };

  const result = {
    chapter_title: title,
    chapter_url: url,
    chapter_number: num,
    content: (parsedResult.paragraphs || []).join("\n\n"),
    debug: parsedResult.debug || [],
    needOCR: parsedResult.needOCR || false,
    dataUrls: parsedResult.dataUrls || null,
    __rateLimited: !!parsedResult.__rateLimited
  };

  if (result && result.needOCR) {
    if (parsedResult.dataUrl) {
      // Chế độ cũ: Chụp toàn bộ trang làm 1 ảnh lớn
      console.log(`[parseOnTab] Đang thực hiện OCR toàn trang qua tab phụ (tránh CSP) cho: ${title}...`);
      try {
        const ocrText = await runExternalOCR(parsedResult.dataUrl);
        // Xử lý xuống dòng thông minh: 
        const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const paragraphs = [];
        let currentPara = "";

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          currentPara += line;

          const lastChar = line.slice(-1);
          const terminalPunctuation = /['"”’。！？.!?…~>\]】]/;

          if (line.length < 35 || terminalPunctuation.test(lastChar) || i === lines.length - 1) {
            paragraphs.push(currentPara);
            currentPara = "";
          }
        }

        result.content = paragraphs.join("\n\n");
        result.debug.push(`[External OCR] Hoàn thành OCR toàn trang, trích xuất được ${paragraphs.length} đoạn.`);
      } catch (e) {
        console.error("[External OCR Lỗi]", e);
        result.debug.push(`[External OCR LỖI] ${e.message}`);
      }
    } else if (result.dataUrls && result.dataUrls.length > 0) {
      // Chế độ mới: OCR song song từng đoạn văn (5 workers)
      console.log(`[parseOnTab] Đang thực hiện OCR song song cho ${result.dataUrls.length} ảnh thẻ p của: ${title}...`);
      try {
        let completedCount = 0;
        const totalCount = result.dataUrls.length;

        const ocrPromises = result.dataUrls.map(async (dataUrl, idx) => {
          try {
            // if (idx < 3) {
            //   console.log(`[BASE64 IMAGE - Đoạn ${idx} - ${title}] Mở trong tab mới để xem ảnh:\n`, dataUrl);
            // }
            const ocrText = await runExternalOCR(dataUrl);
            // Mỗi thẻ p là một dòng văn bản. Xóa bỏ tất cả các ký tự xuống dòng thừa bên trong OCR của thẻ p đó
            const cleanedText = ocrText.replace(/\r?\n/g, '').trim();
            completedCount++;
            if (completedCount % 10 === 0 || completedCount === totalCount) {
              console.log(`[OCR Tiến trình - ${title}] Đã nhận diện xong: ${completedCount}/${totalCount} thẻ p...`);
            }
            return cleanedText;
          } catch (e) {
            console.error(`[OCR Lỗi thẻ p #${idx} trong chương ${title}]`, e);
            return `[LỖI OCR thẻ p #${idx}: ${e.message}]`;
          }
        });

        const paragraphs = await Promise.all(ocrPromises);
        result.content = paragraphs.filter(Boolean).join("\n\n");
        result.debug.push(`[External OCR] Hoàn thành, trích xuất song song được ${paragraphs.length} đoạn.`);
      } catch (e) {
        console.error("[External OCR Lỗi]", e);
        result.debug.push(`[External OCR LỖI] ${e.message}`);
      }
    }
  }

  // ← Log ra Service Worker console
  if (result?.debug) {
    console.log(`[parseOnTab] Kết quả xử lý: ${title}`);
    result.debug.forEach(l => {
      if (l.startsWith("DATA_URL: ")) {
        console.log(`[OCR_IMAGE_URL - ${title}]`, l.replace("DATA_URL: ", ""));
      } else {
        console.log('  >', l);
      }
    });
  } else {
    console.log(`[parseOnTab] Không nhận được kết quả hợp lệ cho ${title}`, result);
  }

  if (result && result.__rateLimited) {
    return { __rateLimited: true, chapter_title: title, chapter_url: url };
  }

  return result;
}

// ─── Offscreen Document Setup ──────────────────────────────
async function setupOffscreenDocument() {
  if (await chrome.offscreen.hasDocument()) return;
  await chrome.offscreen.createDocument({
    url: 'ocr.html',
    reasons: ['WORKERS'],
    justification: 'Thực thi OCR ngầm trên ảnh do CSP chặn',
  });
}

// Tự động khởi tạo Offscreen Document khi Service Worker khởi động (để pre-warm workers và hiển thị inspect view)
setupOffscreenDocument().catch(e => console.error("[Startup] Lỗi khởi tạo Offscreen Document:", e));

// ─── External OCR Helper ─────────────────────────────────
async function runExternalOCR(dataUrl) {
  await setupOffscreenDocument();

  const response = await chrome.runtime.sendMessage({
    type: 'run_ocr',
    dataUrl: dataUrl
  });

  if (!response) {
    throw new Error("Mất kết nối với Offscreen Document.");
  }

  if (response.success) {
    return response.text;
  } else {
    throw new Error(response.error + "\n" + response.stack);
  }
}

// ─── Docx helper ─────────────────────────────────────────
async function buildDocxBuffer(chapter) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docx;

  const paragraphs = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun(chapter.chapter_title || "Chapter")]
    }),
    new Paragraph({ children: [new TextRun("")] }),
    ...(chapter.content || "").split("\n\n").map(text =>
      new Paragraph({
        children: [new TextRun({ text: text.trim(), size: 24 })],
        spacing: { after: 200 }
      })
    )
  ];

  const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  return blob.arrayBuffer();
}

// ─── Restore task on startup ──────────────────────────────
chrome.storage.local.get('activeBatchTask').then(async res => {
  const task = res.activeBatchTask;
  if (task?.version === 2) {
    activeBatchTask = task;
    task.results ||= [];
    task.errors ||= [];
    task.activeChapters = [];
    task.activeWorkers = 0;
    // Revisit assigned-but-unfinished chapters; cached results are skipped.
    task.nextIdx = 0;
    task.doneCount = task.results.filter(Boolean).length;
    for (const book of task.queue) {
      book.done = task.chapters.filter((c, i) => c.batchId === book.id && task.results[i]).length;
      if (book.status === 'exporting') book.status = 'pending';
    }
    if (task.status === 'stopping') task.status = 'stopped';
    await saveTaskToStorage(task);
  }
}).catch(err => console.error('[Restore]', err)).finally(() => {
  storageInitResolve();
  if (activeBatchTask?.status === 'running') startBatchDownload();
});
