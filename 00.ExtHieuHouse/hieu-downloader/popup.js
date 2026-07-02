// popup.js

let projectData = null;
let folderName = '';

function showState(name) {
  document.querySelectorAll('.state').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`state-${name}`);
  if (el) el.classList.add('active');
}

function toNoAccent(str) {
  if (!str) return '';
  const map = {
    'à':'a','á':'a','ả':'a','ã':'a','ạ':'a','ă':'a','ắ':'a','ằ':'a','ẳ':'a','ẵ':'a','ặ':'a',
    'â':'a','ấ':'a','ầ':'a','ẩ':'a','ẫ':'a','ậ':'a','è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e',
    'ê':'e','ế':'e','ề':'e','ể':'e','ễ':'e','ệ':'e','ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
    'ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o','ô':'o','ố':'o','ồ':'o','ổ':'o','ỗ':'o','ộ':'o',
    'ơ':'o','ớ':'o','ờ':'o','ở':'o','ỡ':'o','ợ':'o','ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u',
    'ư':'u','ứ':'u','ừ':'u','ử':'u','ữ':'u','ự':'u','ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y','đ':'d',
    'À':'a','Á':'a','Ả':'a','Ã':'a','Ạ':'a','Ă':'a','Ắ':'a','Ằ':'a','Ẳ':'a','Ẵ':'a','Ặ':'a',
    'Â':'a','Ấ':'a','Ầ':'a','Ẩ':'a','Ẫ':'a','Ậ':'a','È':'e','É':'e','Ẻ':'e','Ẽ':'e','Ẹ':'e',
    'Ê':'e','Ế':'e','Ề':'e','Ể':'e','Ễ':'e','Ệ':'e','Ì':'i','Í':'i','Ỉ':'i','Ĩ':'i','Ị':'i',
    'Ò':'o','Ó':'o','Ỏ':'o','Õ':'o','Ọ':'o','Ô':'o','Ố':'o','Ồ':'o','Ổ':'o','Ỗ':'o','Ộ':'o',
    'Ơ':'o','Ớ':'o','Ờ':'o','Ở':'o','Ỡ':'o','Ợ':'o','Ù':'u','Ú':'u','Ủ':'u','Ũ':'u','Ụ':'u',
    'Ư':'u','Ứ':'u','Ừ':'u','Ử':'u','Ữ':'u','Ự':'u','Ỳ':'y','Ý':'y','Ỷ':'y','Ỹ':'y','Ỵ':'y','Đ':'d'
  };
  return str.split('').map(c => map[c] || c).join('')
    .toLowerCase().replace(/[^a-z0-9\-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function makeFolderName(slug) {
  const clean = slug.replace(/[^a-z0-9\-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `hieu_house_${clean}`;
}

function getExt(url) {
  const m = url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i);
  return m ? '.' + m[1].toLowerCase() : '.jpg';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function renderProject(data) {
  const { projectInfo, images, url, slug } = data;

  const projectName = projectInfo['Tên dự án'] || projectInfo['Tên công trình'] || '(Chưa xác định)';
  document.getElementById('project-name').textContent = projectName;
  document.getElementById('found-summary').textContent = `Tìm thấy ${images.length} ảnh + thông tin dự án`;

  // Mô tả ngắn dưới tên dự án
  const shortDescEl = document.getElementById('short-desc');
  if (shortDescEl) {
    if (data.shortDesc) {
      shortDescEl.textContent = data.shortDesc;
      shortDescEl.style.display = 'block';
    } else {
      shortDescEl.style.display = 'none';
    }
  }

  // Info rows
  const infoRowsEl = document.getElementById('info-rows');
  infoRowsEl.innerHTML = '';
  const order = ['Vị trí công trình','Vị trí','Số tầng','Diện tích đất','Diện tích','Diện tích xây dựng','Chi phí xây dựng','Chi phí','Năm hoàn thành','Năm'];
  const shown = new Set(['Tên dự án','Tên công trình']);

  for (const key of order) {
    if (projectInfo[key] && !shown.has(key)) {
      shown.add(key);
      const row = document.createElement('div');
      row.className = 'info-row';
      row.innerHTML = `<span class="info-label">${key}:</span><span class="info-value">${projectInfo[key]}</span>`;
      infoRowsEl.appendChild(row);
    }
  }
  for (const [k, v] of Object.entries(projectInfo)) {
    if (!shown.has(k) && v && v.trim() && v.length < 100) {
      const row = document.createElement('div');
      row.className = 'info-row';
      row.innerHTML = `<span class="info-label">${k}:</span><span class="info-value">${v}</span>`;
      infoRowsEl.appendChild(row);
    }
  }

  // Image list
  const listEl = document.getElementById('image-list');
  listEl.innerHTML = '';
  images.forEach((u, i) => {
    const item = document.createElement('div');
    item.className = 'image-item';
    item.innerHTML = `<span class="num">${i+1}.</span><span class="img-url">${u.split('/').pop().substring(0,55)}</span>`;
    listEl.appendChild(item);
  });

  // Folder
  folderName = makeFolderName(slug);
  document.getElementById('folder-name').textContent = folderName;
  document.getElementById('btn-label').textContent = `Download ${images.length} ảnh + file txt`;

  showState('found');
}

async function startDownload() {
  if (!projectData) return;
  const total = projectData.images.length;

  showState('downloading');
  document.getElementById('dl-label').textContent = 'Đang tạo file thông tin...';
  document.getElementById('progress-text').textContent = `0 / ${total}`;
  document.getElementById('progress-bar').style.width = '0%';

  // Download txt
  const txt = generateTxt(projectData, folderName);
  const blob = new Blob(['\ufeff' + txt], { type: 'text/plain;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);
  chrome.downloads.download({ url: blobUrl, filename: `${folderName}/thong_tin_du_an.txt`, saveAs: false });

  await sleep(400);
  document.getElementById('dl-label').textContent = 'Đang tải ảnh...';

  let downloaded = 0;
  for (let i = 0; i < projectData.images.length; i++) {
    const ext = getExt(projectData.images[i]);
    const filename = `${folderName}/anh_${String(i+1).padStart(3,'0')}${ext}`;
    try {
      await new Promise((resolve, reject) => {
        chrome.downloads.download({ url: projectData.images[i], filename, saveAs: false }, id => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else { downloaded++; resolve(id); }
        });
      });
    } catch (e) { console.error(e); }

    const pct = Math.round((i+1)/total*100);
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('progress-text').textContent = `${i+1} / ${total}`;
    await sleep(80);
  }

  showState('done');
  document.getElementById('done-msg').textContent = `Đã tải ${downloaded}/${total} ảnh và file thông tin.`;
  document.getElementById('done-folder').textContent = `📁 ${folderName}/`;
}

function generateTxt(data, folder) {
  const { projectInfo, description, images, url } = data;
  const projectName = projectInfo['Tên dự án'] || projectInfo['Tên công trình'] || folder.toUpperCase();
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}`;

  const labelOrder = [
    ['Vị trí công trình','Vị trí công trình'],['Vị trí','Vị trí công trình'],
    ['Số tầng','Số tầng'],['Diện tích đất','Diện tích đất'],['Diện tích','Diện tích đất'],
    ['Diện tích xây dựng','Diện tích xây dựng'],['Chi phí xây dựng','Chi phí xây dựng'],
    ['Chi phí','Chi phí xây dựng'],['Năm hoàn thành','Năm hoàn thành'],['Năm','Năm hoàn thành'],
    ['Team thiết kế','Team thiết kế'],['Kiến trúc sư','Kiến trúc sư'],
  ];
  const shown = new Set();
  const lines = [];
  for (const [raw, display] of labelOrder) {
    if (projectInfo[raw] && !shown.has(display)) {
      lines.push(`${display}: ${projectInfo[raw]}`);
      shown.add(display);
    }
  }
  for (const [k, v] of Object.entries(projectInfo)) {
    if (k === 'Tên dự án' || k === 'Tên công trình') continue;
    if (!shown.has(k) && v && v.trim() && v.length < 150) {
      lines.push(`${k}: ${v}`); shown.add(k);
    }
  }

  const imgList = images.map((u, i) =>
    `${i+1}. ${folder}/anh_${String(i+1).padStart(3,'0')}${getExt(u)}`
  ).join('\n');

  const shortDescBlock = data.shortDesc ? `\n--- Mô tả ngắn ---\n${data.shortDesc}\n` : '';
  const sep = '=================================================='
  return `${sep}
THÔNG TIN DỰ ÁN
${sep}
TÊN DỰ ÁN: ${projectName}${shortDescBlock}
--- Thông tin chi tiết ---
${lines.join('\n')}

--- Mô tả dự án ---
${description || '(Không có mô tả)'}
${sep}
DANH SÁCH ẢNH (${images.length} ảnh)
${sep}
${imgList}
${sep}
Nguồn: ${url}
Ngày tải: ${time}
${sep}`;
}

async function init() {
  showState('scanning');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.includes('hieuhouse.vn')) {
      showState('not-site');
      return;
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
    } catch (e) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      await sleep(500);
      response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
    }

    if (!response?.success) throw new Error(response?.error || 'Không lấy được dữ liệu');

    projectData = response.data;

    // Fallback nếu không tìm thấy ảnh
    if (!projectData.images || projectData.images.length === 0) {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          return [...new Set(
            Array.from(document.querySelectorAll('img')).map(img =>
              img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.src
            ).filter(s => s && s.startsWith('http') && /\.(jpg|jpeg|png|webp)/i.test(s))
          )].filter(u => !u.includes('logo') && !u.includes('icon') && !u.includes('favicon'));
        }
      });
      if (result?.[0]?.result) projectData.images = result[0].result;
    }

    renderProject(projectData);
  } catch (e) {
    showState('error');
    document.getElementById('error-msg').textContent =
      `Lỗi: ${e.message}\n\nHãy đảm bảo bạn đang ở trang dự án hieuhouse.vn và reload trang.`;
  }
}

document.getElementById('btn-download')?.addEventListener('click', () => { if (projectData) startDownload(); });
document.getElementById('btn-again')?.addEventListener('click', () => showState('found'));
document.getElementById('btn-retry')?.addEventListener('click', () => init());

init();
