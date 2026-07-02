// popup.js

let foundUrls = [];
let projectInfo = { infoTable: {}, title: '', content: '' };

const statusBox    = document.getElementById('status-box');
const statusText   = document.getElementById('status-text');
const btnDownload  = document.getElementById('btn-download');
const progressWrap = document.getElementById('progress-wrap');
const progressBar  = document.getElementById('progress-bar');
const progressText = document.getElementById('progress-text');

// ── Quét trang ngay khi popup mở ────────────────────────────────
chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
  if (!tab?.id) return setError('Không lấy được tab hiện tại.');
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scanPage,
    });
    const data = results?.[0]?.result ?? { urls: [], info: {} };
    foundUrls   = data.urls;
    projectInfo = data.info;

    if (foundUrls.length === 0 && !data.info.title) setEmpty();
    else setFound(foundUrls, data.info);
  } catch (e) {
    setError('Lỗi khi quét trang: ' + e.message);
  }
});

// ── Hàm chạy trong context trang ────────────────────────────────
function scanPage() {
  const info = { infoTable: {}, title: '', content: '', pageUrl: location.href, pageTitle: document.title };

  // Lấy thông tin từ div.infoProject (bảng th/td)
  const infoDiv = document.querySelector('.infoProject');
  if (infoDiv) {
    infoDiv.querySelectorAll('tr').forEach(tr => {
      const th = tr.querySelector('th')?.textContent?.trim();
      const td = tr.querySelector('td')?.textContent?.trim();
      if (th && td) info.infoTable[th] = td;
    });
  }

  // Lấy tiêu đề và nội dung từ div.contentProject
  const contentDiv = document.querySelector('.contentProject');
  if (contentDiv) {
    info.title = contentDiv.querySelector('h6')?.textContent?.trim() || '';
    const paragraphs = contentDiv.querySelectorAll('p');
    info.content = Array.from(paragraphs).map(p => p.textContent.trim()).filter(Boolean).join('\n\n');
  }

  // Lấy ảnh từ div.allImage
  const urls = [];
  const container = document.querySelector('.allImage');
  if (container) {
    container.querySelectorAll('img').forEach(img => {
      const src = img.dataset.src || img.dataset.lazySrc || img.dataset.original || img.getAttribute('src');
      if (src && !src.startsWith('data:') && !urls.includes(src)) urls.push(src);
    });
    const imgExts = ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg'];
    container.querySelectorAll('a[href]').forEach(a => {
      const href = a.href;
      if (imgExts.some(ext => href.split('?')[0].toLowerCase().endsWith(ext)) && !urls.includes(href))
        urls.push(href);
    });
    container.querySelectorAll('*').forEach(el => {
      const bg = el.style.backgroundImage;
      if (bg?.includes('url(')) {
        const m = bg.match(/url\(['"]?([^'")\s]+)['"]?\)/);
        if (m?.[1] && !m[1].startsWith('data:') && !urls.includes(m[1])) urls.push(m[1]);
      }
    });
  }

  return { urls, info };
}

// ── Bắt đầu download khi bấm nút ────────────────────────────────
btnDownload.addEventListener('click', async () => {
  if (foundUrls.length === 0 && !projectInfo.title) return;

  btnDownload.disabled = true;
  progressWrap.style.display = 'block';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const folderName = getFolderName(tab.url);

  // 1. Tạo và download file text trước
  progressText.textContent = 'Đang tạo file thông tin...';
  const txtContent = buildTextContent(projectInfo, foundUrls, tab.url);
  await downloadTextFile(txtContent, folderName + '/thong_tin_du_an.txt');

  // 2. Download từng ảnh
  let done = 0, failed = 0;
  for (const url of foundUrls) {
    const filename = getFilename(url, done + 1);
    const ok = await downloadViaBlob(url, folderName + '/' + filename);
    if (ok) done++; else failed++;

    const total = done + failed;
    const pct   = Math.round((total / foundUrls.length) * 100);
    progressBar.style.width = pct + '%';
    progressText.textContent = `Đang tải ảnh ${done}/${foundUrls.length}${failed ? ' (' + failed + ' lỗi)' : ''}`;
  }

  progressBar.style.width = '100%';
  progressText.textContent =
    `✅ Xong! ${done} ảnh + 1 file txt → "${folderName}"` + (failed ? ` (${failed} ảnh lỗi)` : '');
  btnDownload.textContent = '✅ Đã xong';
});

// ── Tạo nội dung file text ───────────────────────────────────────
function buildTextContent(info, urls, pageUrl) {
  const lines = [];
  const sep = '='.repeat(50);

  lines.push(sep);
  lines.push('THÔNG TIN DỰ ÁN');
  lines.push(sep);
  lines.push('');

  if (info.title) {
    lines.push('TÊN DỰ ÁN: ' + info.title);
    lines.push('');
  }

  if (Object.keys(info.infoTable).length > 0) {
    lines.push('--- Thông tin chi tiết ---');
    for (const [key, val] of Object.entries(info.infoTable)) {
      lines.push(`${key}: ${val}`);
    }
    lines.push('');
  }

  if (info.content) {
    lines.push('--- Mô tả dự án ---');
    lines.push(info.content);
    lines.push('');
  }

  lines.push(sep);
  lines.push('DANH SÁCH ẢNH (' + urls.length + ' ảnh)');
  lines.push(sep);
  urls.forEach((url, i) => {
    lines.push(`${i + 1}. ${decodeURIComponent(url.split('/').pop().split('?')[0])}`);
  });

  lines.push('');
  lines.push(sep);
  lines.push('Nguồn: ' + pageUrl);
  lines.push('Ngày tải: ' + new Date().toLocaleString('vi-VN'));
  lines.push(sep);

  return lines.join('\n');
}

// ── Download file text dạng blob ─────────────────────────────────
async function downloadTextFile(content, filename) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  return new Promise((resolve) => {
    chrome.downloads.download(
      { url: blobUrl, filename, conflictAction: 'uniquify', saveAs: false },
      (downloadId) => {
        if (!downloadId) { URL.revokeObjectURL(blobUrl); resolve(false); return; }
        chrome.downloads.onChanged.addListener(function listener(delta) {
          if (delta.id === downloadId && delta.state) {
            if (delta.state.current === 'complete' || delta.state.current === 'interrupted') {
              chrome.downloads.onChanged.removeListener(listener);
              URL.revokeObjectURL(blobUrl);
              resolve(delta.state.current === 'complete');
            }
          }
        });
      }
    );
  });
}

// ── Download ảnh qua blob ────────────────────────────────────────
async function downloadViaBlob(imgUrl, filename) {
  try {
    const resp = await fetch(imgUrl);
    if (!resp.ok) return false;
    const blob   = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      chrome.downloads.download(
        { url: blobUrl, filename, conflictAction: 'uniquify', saveAs: false },
        (downloadId) => {
          if (!downloadId) { URL.revokeObjectURL(blobUrl); resolve(false); return; }
          chrome.downloads.onChanged.addListener(function listener(delta) {
            if (delta.id === downloadId && delta.state) {
              if (delta.state.current === 'complete' || delta.state.current === 'interrupted') {
                chrome.downloads.onChanged.removeListener(listener);
                URL.revokeObjectURL(blobUrl);
                resolve(delta.state.current === 'complete');
              }
            }
          });
        }
      );
    });
  } catch (e) {
    console.warn('Download failed:', imgUrl, e);
    return false;
  }
}

// ── UI helpers ───────────────────────────────────────────────────
function setFound(urls, info) {
  statusBox.className = 'found';

  // Tóm tắt thông tin dự án
  let summary = '';
  if (info.title) summary += `<b>${info.title}</b><br>`;
  for (const [k, v] of Object.entries(info.infoTable || {}))
    summary += `<span style="color:var(--color-text-secondary);font-size:11px">${k}: ${v}</span><br>`;
  if (summary) {
    const infoEl = document.createElement('div');
    infoEl.style.cssText = 'margin-bottom:6px;padding:6px;background:var(--color-background-secondary);border-radius:6px;font-size:12px;line-height:1.6';
    infoEl.innerHTML = summary;
    statusBox.appendChild(infoEl);
  }

  statusText.textContent = urls.length > 0
    ? `✅ Tìm thấy ${urls.length} ảnh + thông tin dự án`
    : '✅ Tìm thấy thông tin dự án (không có ảnh)';

  // Danh sách ảnh
  if (urls.length > 0) {
    const list = document.createElement('div');
    list.className = 'img-list';
    urls.forEach((u, i) => {
      const d = document.createElement('div');
      d.title = u;
      d.textContent = `${i + 1}. ${decodeURIComponent(u.split('/').pop().split('?')[0])}`;
      list.appendChild(d);
    });
    statusBox.appendChild(list);
  }

  btnDownload.disabled = false;
  btnDownload.textContent = urls.length > 0
    ? `⬇️ Download ${urls.length} ảnh + file txt`
    : '⬇️ Download file txt';
}

function setEmpty() {
  statusBox.className = 'empty';
  statusText.textContent = '⚠️ Không tìm thấy div.allImage hoặc thông tin dự án trên trang này';
}

function setError(msg) {
  statusBox.className = 'error';
  statusText.textContent = '❌ ' + msg;
}

function getFolderName(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    const slug  = parts[parts.length - 1] || u.hostname;
    return 'allimage_' + slug.replace(/[^a-zA-Z0-9_\-]/g, '_');
  } catch { return 'allimage_download'; }
}

function getFilename(url, index) {
  try {
    const path = new URL(url).pathname;
    let name = decodeURIComponent(path.split('/').pop());
    name = name.replace(/[\\/:*?"<>|]/g, '_');
    if (name && name.includes('.')) return name;
  } catch {}
  return `image_${String(index).padStart(3, '0')}.jpg`;
}
