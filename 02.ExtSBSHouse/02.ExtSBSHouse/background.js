// Background service worker
// Xử lý download ảnh và tạo file zip

// Nhận message từ popup để bắt đầu download
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startDownload') {
    handleDownload(request.data, request.folderName)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function handleDownload(projectData, folderName) {
  const { images, projectInfo, description, url, slug } = projectData;
  
  // Tạo nội dung file thông tin
  const txtContent = generateTxtContent(projectData, folderName);
  
  // Download file txt trước
  const txtBlob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
  const txtUrl = URL.createObjectURL(txtBlob);
  
  await chrome.downloads.download({
    url: txtUrl,
    filename: `${folderName}/thong_tin_du_an.txt`,
    saveAs: false
  });

  // Download từng ảnh
  let downloadCount = 0;
  for (let i = 0; i < images.length; i++) {
    const imgUrl = images[i];
    const ext = getImageExtension(imgUrl);
    const filename = `${folderName}/anh_${String(i + 1).padStart(3, '0')}${ext}`;
    
    try {
      await chrome.downloads.download({
        url: imgUrl,
        filename: filename,
        saveAs: false
      });
      downloadCount++;
    } catch (e) {
      console.error(`Lỗi download ảnh ${i + 1}:`, e);
    }
    
    // Delay nhỏ để tránh spam
    await sleep(100);
  }

  return { downloadCount, total: images.length };
}

function generateTxtContent(data, folderName) {
  const { projectInfo, description, images, url } = data;
  const now = new Date();
  const timeStr = formatDateTime(now);
  
  // Lấy tên dự án
  const projectName = projectInfo['Tên dự án'] || 
                      projectInfo['Tên công trình'] || 
                      projectInfo['name'] ||
                      folderName.toUpperCase();

  // Build thông tin chi tiết
  const infoLines = [];
  
  // Mapping label thực tế trên sbshouse.vn → label hiển thị trong file txt
  // Thứ tự này cũng là thứ tự xuất ra file
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
  for (const [rawKey, displayKey] of Object.entries(labelMap)) {
    if (projectInfo[rawKey] && !addedKeys.has(displayKey)) {
      infoLines.push(`${displayKey}: ${projectInfo[rawKey]}`);
      addedKeys.add(displayKey);
    }
  }

  // Thêm các key còn lại chưa được map
  for (const [key, value] of Object.entries(projectInfo)) {
    if (key === 'Tên dự án' || key === 'Tên công trình') continue;
    const displayKey = labelMap[key] || key;
    if (!addedKeys.has(displayKey) && value && value.trim()) {
      infoLines.push(`${displayKey}: ${value}`);
      addedKeys.add(displayKey);
    }
  }

  // Build danh sách ảnh
  const imageList = images.map((imgUrl, i) => {
    const filename = `anh_${String(i + 1).padStart(3, '0')}${getImageExtension(imgUrl)}`;
    return `${i + 1}. ${filename}`;
  }).join('\n');

  const separator = '==================================================';
  
  let content = `${separator}
THÔNG TIN DỰ ÁN
${separator}
TÊN DỰ ÁN: ${projectName}

--- Thông tin chi tiết ---
${infoLines.join('\n')}

--- Mô tả dự án ---
${description || '(Không có mô tả)'}
${separator}
DANH SÁCH ẢNH (${images.length} ảnh)
${separator}
${imageList}
${separator}
Nguồn: ${url}
Ngày tải: ${timeStr}
${separator}`;

  return content;
}

function getImageExtension(url) {
  const match = url.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i);
  if (match) return '.' + match[1].toLowerCase();
  return '.jpg'; // default
}

function formatDateTime(date) {
  const pad = n => String(n).padStart(2, '0');
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  const d = pad(date.getDate());
  const mo = pad(date.getMonth() + 1);
  const y = date.getFullYear();
  return `${h}:${m}:${s} ${d}/${mo}/${y}`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
