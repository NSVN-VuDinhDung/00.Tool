// popup.js - Logic điều khiển UI popup

let projectData = null;
let folderName = '';

// Utility: Hiển thị một state cụ thể
function showState(stateName) {
  document.querySelectorAll('.state').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`state-${stateName}`);
  if (el) el.classList.add('active');
}

// Utility: Chuyển tên dự án sang slug không dấu
function toSlug(str) {
  if (!str) return '';
  
  const map = {
    'à':'a','á':'a','ả':'a','ã':'a','ạ':'a',
    'ă':'a','ắ':'a','ằ':'a','ẳ':'a','ẵ':'a','ặ':'a',
    'â':'a','ấ':'a','ầ':'a','ẩ':'a','ẫ':'a','ậ':'a',
    'è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e',
    'ê':'e','ế':'e','ề':'e','ể':'e','ễ':'e','ệ':'e',
    'ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
    'ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o',
    'ô':'o','ố':'o','ồ':'o','ổ':'o','ỗ':'o','ộ':'o',
    'ơ':'o','ớ':'o','ờ':'o','ở':'o','ỡ':'o','ợ':'o',
    'ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u',
    'ư':'u','ứ':'u','ừ':'u','ử':'u','ữ':'u','ự':'u',
    'ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y',
    'đ':'d',
    'À':'a','Á':'a','Ả':'a','Ã':'a','Ạ':'a',
    'Ă':'a','Ắ':'a','Ằ':'a','Ẳ':'a','Ẵ':'a','Ặ':'a',
    'Â':'a','Ấ':'a','Ầ':'a','Ẩ':'a','Ẫ':'a','Ậ':'a',
    'È':'e','É':'e','Ẻ':'e','Ẽ':'e','Ẹ':'e',
    'Ê':'e','Ế':'e','Ề':'e','Ể':'e','Ễ':'e','Ệ':'e',
    'Ì':'i','Í':'i','Ỉ':'i','Ĩ':'i','Ị':'i',
    'Ò':'o','Ó':'o','Ỏ':'o','Õ':'o','Ọ':'o',
    'Ô':'o','Ố':'o','Ồ':'o','Ổ':'o','Ỗ':'o','Ộ':'o',
    'Ơ':'o','Ớ':'o','Ờ':'o','Ở':'o','Ỡ':'o','Ợ':'o',
    'Ù':'u','Ú':'u','Ủ':'u','Ũ':'u','Ụ':'u',
    'Ư':'u','Ứ':'u','Ừ':'u','Ử':'u','Ữ':'u','Ự':'u',
    'Ỳ':'y','Ý':'y','Ỷ':'y','Ỹ':'y','Ỵ':'y',
    'Đ':'d'
  };
  
  return str.split('').map(c => map[c] || c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Tạo tên folder từ slug URL
function makeFolderName(slug) {
  const cleanSlug = slug.replace(/[^a-z0-9\-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `sbs_house_${cleanSlug}`;
}

// Lấy slug từ URL trang
function getSlugFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.replace(/^\/|\/$/g, '');
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || parts[parts.length - 2] || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

// Render thông tin project lên UI
function renderProjectData(data) {
  const { projectInfo, images, url, slug } = data;

  // Tên dự án
  const projectName = projectInfo['Tên dự án'] || 
                      projectInfo['Tên công trình'] ||
                      projectInfo['name'] || 
                      '(Không có tên)';
  document.getElementById('project-name').textContent = projectName;

  // Badge
  document.getElementById('found-summary').textContent = 
    `Tìm thấy ${images.length} ảnh + thông tin dự án`;

  // Rows thông tin
  const infoRowsEl = document.getElementById('info-rows');
  infoRowsEl.innerHTML = '';

  // Hiển thị theo đúng thứ tự như trên trang sbshouse
  const displayOrder = [
    'Vị trí công trình',
    'Vị trí',
    'Số tầng',
    'Diện tích đất',
    'Diện tích',
    'Diện tích xây dựng',
    'Chi phí xây dựng',
    'Chi phí',
    'Năm hoàn thành',
    'Năm',
  ];

  const shownKeys = new Set(['Tên dự án', 'Tên công trình', 'name']);
  
  for (const key of displayOrder) {
    if (projectInfo[key] && !shownKeys.has(key)) {
      shownKeys.add(key);
      const row = document.createElement('div');
      row.className = 'info-row';
      row.innerHTML = `<span class="info-label">${key}:</span><span class="info-value">${projectInfo[key]}</span>`;
      infoRowsEl.appendChild(row);
    }
  }

  // Các key còn lại chưa hiển thị (ngoài tên dự án)
  for (const [key, value] of Object.entries(projectInfo)) {
    if (!shownKeys.has(key) && value && value.trim() && value.length < 100) {
      const row = document.createElement('div');
      row.className = 'info-row';
      row.innerHTML = `<span class="info-label">${key}:</span><span class="info-value">${value}</span>`;
      infoRowsEl.appendChild(row);
    }
  }

  // Danh sách ảnh
  const imageListEl = document.getElementById('image-list');
  imageListEl.innerHTML = '';
  images.forEach((imgUrl, i) => {
    const item = document.createElement('div');
    item.className = 'image-item';
    const shortUrl = imgUrl.split('/').pop().substring(0, 50);
    item.innerHTML = `<span class="num">${i + 1}.</span><span class="img-url">${shortUrl}</span>`;
    imageListEl.appendChild(item);
  });

  // Folder name
  const slugFromUrl = slug || getSlugFromUrl(url);
  folderName = makeFolderName(slugFromUrl);
  document.getElementById('folder-name').textContent = folderName;

  // Button label
  document.getElementById('btn-label').textContent = 
    `Download ${images.length} ảnh + file txt`;

  showState('found');
}

// Bắt đầu quá trình download
async function startDownload() {
  if (!projectData || !projectData.images.length) return;

  const totalImages = projectData.images.length;
  let downloaded = 0;

  showState('downloading');
  document.getElementById('dl-label').textContent = 'Đang tạo file thông tin...';
  document.getElementById('progress-text').textContent = `0 / ${totalImages}`;
  document.getElementById('progress-bar').style.width = '0%';

  // Tạo và download file txt trước
  const txtContent = generateTxtContent(projectData, folderName);
  downloadTextFile(txtContent, `${folderName}/thong_tin_du_an.txt`);

  await sleep(300);

  // Download từng ảnh
  document.getElementById('dl-label').textContent = 'Đang tải ảnh...';

  for (let i = 0; i < projectData.images.length; i++) {
    const imgUrl = projectData.images[i];
    const ext = getImageExtension(imgUrl);
    const filename = `${folderName}/anh_${String(i + 1).padStart(3, '0')}${ext}`;

    try {
      await downloadFile(imgUrl, filename);
      downloaded++;
    } catch (e) {
      console.error(`Lỗi tải ảnh ${i + 1}:`, e);
    }

    const pct = Math.round((i + 1) / totalImages * 100);
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('progress-text').textContent = `${i + 1} / ${totalImages}`;

    await sleep(80);
  }

  // Xong
  showState('done');
  document.getElementById('done-msg').textContent = 
    `Đã tải ${downloaded}/${totalImages} ảnh và file thông tin dự án.`;
  document.getElementById('done-folder').textContent = `📁 ${folderName}/`;
}

// Download file qua chrome.downloads API (gửi message đến background)
async function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(downloadId);
      }
    });
  });
}

// Download text file từ blob URL
function downloadTextFile(content, filename) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: false }, () => {
    URL.revokeObjectURL(url);
  });
}

function getImageExtension(url) {
  const match = url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i);
  if (match) return '.' + match[1].toLowerCase();
  return '.jpg';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== Generate file nội dung txt =====
function generateTxtContent(data, folder) {
  const { projectInfo, description, images, url } = data;

  const projectName = projectInfo['Tên dự án'] || 
                      projectInfo['Tên công trình'] || 
                      folder.toUpperCase();

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}`;

  // Thông tin chi tiết
  const labelMap = {
    'Vị trí công trình': 'Vị trí công trình',
    'Vị trí': 'Vị trí công trình',
    'Số tầng': 'Số tầng',
    'Diện tích đất': 'Diện tích đất',
    'Diện tích': 'Diện tích đất',
    'Diện tích xây dựng': 'Diện tích xây dựng',
    'Chi phí xây dựng': 'Chi phí xây dựng',
    'Chi phí': 'Chi phí xây dựng',
    'Năm hoàn thành': 'Năm hoàn thành',
    'Năm': 'Năm hoàn thành',
    'Tên dự án': 'Tên dự án',
    'Tên công trình': 'Tên dự án',
    'Team thiết kế': 'Team thiết kế',
    'Kiến trúc sư': 'Kiến trúc sư',
  };

  const addedKeys = new Set();
  const infoLines = [];

  for (const [rawKey, displayKey] of Object.entries(labelMap)) {
    if (projectInfo[rawKey] && !addedKeys.has(displayKey)) {
      infoLines.push(`${displayKey}: ${projectInfo[rawKey]}`);
      addedKeys.add(displayKey);
    }
  }

  // Còn lại
  for (const [key, value] of Object.entries(projectInfo)) {
    const displayKey = labelMap[key] || key;
    if (key === 'Tên dự án' || key === 'Tên công trình') continue;
    if (!addedKeys.has(displayKey) && value && value.trim()) {
      infoLines.push(`${displayKey}: ${value}`);
      addedKeys.add(displayKey);
    }
  }

  // Danh sách ảnh
  const imageList = images.map((imgUrl, i) => {
    const filename = `anh_${String(i + 1).padStart(3, '0')}${getImageExtension(imgUrl)}`;
    return `${i + 1}. ${filename}`;
  }).join('\n');

  const sep = '==================================================';

  return `${sep}
THÔNG TIN DỰ ÁN
${sep}
TÊN DỰ ÁN: ${projectName}

--- Thông tin chi tiết ---
${infoLines.join('\n')}

--- Mô tả dự án ---
${description || '(Không có mô tả)'}
${sep}
DANH SÁCH ẢNH (${images.length} ảnh)
${sep}
${imageList}
${sep}
Nguồn: ${url}
Ngày tải: ${timeStr}
${sep}`;
}

// ===== Khởi động popup =====
async function init() {
  showState('scanning');

  try {
    // Lấy tab hiện tại
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || !tab.url.includes('sbshouse.vn')) {
      showState('not-sbs');
      return;
    }

    // Inject content script nếu chưa có và gọi extractData
    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
    } catch (e) {
      // Content script chưa được inject - inject thủ công
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await sleep(500);
      response = await chrome.tabs.sendMessage(tab.id, { action: 'extractData' });
    }

    if (!response || !response.success) {
      throw new Error(response?.error || 'Không thể lấy dữ liệu từ trang');
    }

    projectData = response.data;

    if (!projectData.images || projectData.images.length === 0) {
      // Thử lấy ảnh trực tiếp từ DOM nếu content script không tìm thấy
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const imgs = Array.from(document.querySelectorAll('img')).map(img => {
            return img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.src;
          }).filter(src => src && src.startsWith('http') && !src.includes('data:'));
          return [...new Set(imgs)];
        }
      });
      if (result && result[0] && result[0].result) {
        projectData.images = result[0].result.filter(url => 
          !url.includes('logo') && !url.includes('icon') && !url.includes('favicon')
        );
      }
    }

    renderProjectData(projectData);

  } catch (e) {
    console.error('Init error:', e);
    showState('error');
    document.getElementById('error-msg').textContent = 
      `Lỗi: ${e.message}\n\nHãy đảm bảo bạn đang ở trang dự án trên sbshouse.vn và reload trang.`;
  }
}

// Event listeners
document.getElementById('btn-download')?.addEventListener('click', () => {
  if (projectData) startDownload();
});

document.getElementById('btn-again')?.addEventListener('click', () => {
  showState('found');
});

document.getElementById('btn-retry')?.addEventListener('click', () => {
  init();
});

// Khởi chạy
init();
