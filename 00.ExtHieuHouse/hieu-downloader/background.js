// Background service worker

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startDownload') {
    handleDownload(request.data, request.folderName)
      .then(r => sendResponse({ success: true, result: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});

async function handleDownload(projectData, folderName) {
  const txtContent = generateTxt(projectData, folderName);
  const txtBlob = new Blob(['\ufeff' + txtContent], { type: 'text/plain;charset=utf-8' });
  const txtUrl = URL.createObjectURL(txtBlob);

  await chrome.downloads.download({ url: txtUrl, filename: `${folderName}/thong_tin_du_an.txt`, saveAs: false });

  let ok = 0;
  for (let i = 0; i < projectData.images.length; i++) {
    const ext = getExt(projectData.images[i]);
    try {
      await chrome.downloads.download({
        url: projectData.images[i],
        filename: `${folderName}/anh_${String(i + 1).padStart(3, '0')}${ext}`,
        saveAs: false
      });
      ok++;
    } catch (e) { console.error('Download error', i, e); }
    await sleep(80);
  }
  return { downloadCount: ok, total: projectData.images.length };
}

function generateTxt(data, folder) {
  const { projectInfo, description, images, url } = data;
  const projectName = projectInfo['Tên dự án'] || projectInfo['Tên công trình'] || folder.toUpperCase();

  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${pad(now.getDate())}/${pad(now.getMonth()+1)}/${now.getFullYear()}`;

  const labelOrder = [
    ['Vị trí công trình','Vị trí công trình'],
    ['Vị trí','Vị trí công trình'],
    ['Số tầng','Số tầng'],
    ['Diện tích đất','Diện tích đất'],
    ['Diện tích','Diện tích đất'],
    ['Diện tích xây dựng','Diện tích xây dựng'],
    ['Chi phí xây dựng','Chi phí xây dựng'],
    ['Chi phí','Chi phí xây dựng'],
    ['Năm hoàn thành','Năm hoàn thành'],
    ['Năm','Năm hoàn thành'],
    ['Team thiết kế','Team thiết kế'],
    ['Kiến trúc sư','Kiến trúc sư'],
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
    const display = k;
    if (!shown.has(display) && v && v.trim() && v.length < 150) {
      lines.push(`${display}: ${v}`);
      shown.add(display);
    }
  }

  const imgList = images.map((u, i) => `${i+1}. ${folder}/anh_${String(i+1).padStart(3,'0')}${getExt(u)}`).join('\n');
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

function getExt(url) {
  const m = url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i);
  return m ? '.' + m[1].toLowerCase() : '.jpg';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
