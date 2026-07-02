// Content script chạy trên trang sbshouse.vn

function extractProjectData() {
  const data = {
    url: window.location.href,
    slug: getSlugFromUrl(window.location.href),
    projectInfo: {},
    description: '',
    images: []
  };

  extractProjectInfo(data);
  extractDescription(data);
  extractImages(data);

  return data;
}

function getSlugFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.replace(/^\/|\/$/g, '');
    const parts = path.split('/');
    return parts[parts.length - 1] || parts[parts.length - 2] || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function extractProjectInfo(data) {
  const info = data.projectInfo;

  // ===== Lấy tên dự án từ h1 =====
  const h1 = document.querySelector('h1');
  if (h1) info['Tên dự án'] = h1.textContent.trim();

  // ===== Lấy thông tin từ block "Thông tin công trình" =====
  // Cấu trúc thực tế sbshouse.vn:
  // Mỗi mục gồm: img (icon) + p (label) + p (value) bọc trong 1 div con
  // Block cha chứa tiêu đề "Thông tin công trình"

  // Tìm container chứa "Thông tin công trình"
  let infoContainer = null;
  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    if (el.children.length === 0 && el.textContent.trim() === 'Thông tin công trình') {
      // Tìm ancestor gần nhất chứa các mục thông tin
      let parent = el.parentElement;
      for (let i = 0; i < 5; i++) {
        if (parent && parent.querySelectorAll('img').length >= 3) {
          infoContainer = parent;
          break;
        }
        parent = parent?.parentElement;
      }
      break;
    }
  }

  if (infoContainer) {
    // Trong container, mỗi item có: img + 2 đoạn text (label + value)
    // Tìm các div/span con trực tiếp chứa cặp label-value
    const items = infoContainer.querySelectorAll('div, li');
    
    items.forEach(item => {
      // Bỏ qua item quá lớn (là wrapper)
      if (item.querySelectorAll('img').length > 2) return;
      
      const img = item.querySelector('img');
      if (!img) return;

      // Lấy tất cả text node trực tiếp + p/span con
      const textEls = Array.from(item.querySelectorAll('p, span, h3, h4, h5, b, strong'))
        .filter(el => el.children.length === 0 && el.textContent.trim().length > 0);
      
      if (textEls.length >= 2) {
        const label = textEls[0].textContent.trim();
        const value = textEls[1].textContent.trim();
        if (label && value && value.length < 100) {
          info[label] = value;
        }
      } else if (textEls.length === 1) {
        // Thử lấy text nodes trực tiếp trong item
        const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
        const texts = [];
        let node;
        while (node = walker.nextNode()) {
          const t = node.textContent.trim();
          if (t.length > 0) texts.push(t);
        }
        if (texts.length >= 2) {
          info[texts[0]] = texts[1];
        }
      }
    });
  }

  // ===== Fallback: quét toàn bộ trang theo pattern label/value =====
  if (Object.keys(info).length <= 1) {
    // Tìm theo alt text của icon images (sbshouse dùng alt mô tả icon)
    const iconAlts = {
      'vị trí': 'Vị trí công trình',
      'số tầng': 'Số tầng',
      'diện tích đất': 'Diện tích đất',
      'diện tích xây dựng': 'Diện tích xây dựng',
      'chi phí': 'Chi phí xây dựng',
    };

    document.querySelectorAll('img').forEach(img => {
      const alt = (img.getAttribute('alt') || '').toLowerCase();
      for (const [keyword, label] of Object.entries(iconAlts)) {
        if (alt.includes(keyword)) {
          // Value thường là sibling hoặc cousin
          const parent = img.parentElement;
          if (parent) {
            const allText = Array.from(parent.querySelectorAll('p, span, div'))
              .filter(el => el.children.length === 0)
              .map(el => el.textContent.trim())
              .filter(t => t.length > 0 && t.length < 100);
            
            // Lọc bỏ label chính, lấy value
            const values = allText.filter(t => !t.toLowerCase().includes(keyword));
            if (values.length > 0 && !info[label]) {
              info[label] = values[0];
            }
          }
        }
      }
    });
  }
}

function extractDescription(data) {
  // Lấy từ div.content_p
  const contentEl = document.querySelector('.content_p');
  if (contentEl) {
    data.description = cleanDescription(contentEl);
    return;
  }

  // Fallback: entry-content / post-content
  const fallbacks = ['.entry-content', '.post-content', 'article .content', '.the-content'];
  for (const sel of fallbacks) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 50) {
      data.description = cleanDescription(el);
      return;
    }
  }
}

function cleanDescription(el) {
  // Clone để không ảnh hưởng DOM thực
  const clone = el.cloneNode(true);

  // Xóa các phần tử cần loại bỏ:
  // 1. Form tư vấn (chứa "NHẬN TƯ VẤN NGAY", "Dịch vụ cần tư vấn", v.v.)
  // 2. Script, style
  // 3. Nút chia sẻ, comment
  const removeSelectors = [
    'form',
    'script',
    'style',
    '.wpcf7',           // Contact Form 7
    '.wpforms',
    '[class*="form"]',
    '[class*="tuvan"]',
    '[class*="tu-van"]',
    '[class*="consult"]',
    '[class*="contact"]',
    '[class*="sidebar"]',
    '[class*="widget"]',
    '[class*="share"]',
    '[class*="social"]',
    '[class*="related"]',
    '[class*="comment"]',
    '.muc-luc',          // Mục lục
    '[class*="toc"]',    // Table of contents
    'nav',
    '.navigation',
  ];

  removeSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });

  // Xóa các đoạn text chứa từ khóa form tư vấn
  const formKeywords = [
    'để lại thông tin',
    'kiến trúc sư sbs house sẽ tư vấn',
    'nhận tư vấn ngay',
    'dịch vụ cần tư vấn',
    'loại hình xây dựng',
    'ngân sách dự kiến',
    'thiết kế kiến trúc\nthiết kế',
    'nhà phố\nbiệt thự',
    '1.8 - 2.3 tỷ',
    'yêu cầu chi tiết',
  ];

  // Xóa các p/div chứa keywords form
  clone.querySelectorAll('p, div, label, li').forEach(el => {
    const text = el.textContent.toLowerCase();
    if (formKeywords.some(kw => text.includes(kw))) {
      // Chỉ xóa nếu element nhỏ (không phải container lớn)
      if (el.querySelectorAll('p').length < 3) {
        el.remove();
      }
    }
  });

  let text = clone.innerText || clone.textContent || '';
  
  // Xử lý text sau khi lấy
  // Xóa các dòng chứa form keywords
  const lines = text.split('\n');
  const cleanLines = [];
  let skipMode = false;
  
  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    
    // Bắt đầu bỏ qua khi gặp section form
    if (
      lower.includes('để lại thông tin') ||
      lower.includes('nhận tư vấn ngay') ||
      lower.includes('dịch vụ cần tư vấn') ||
      lower.includes('loại hình xây dựng') ||
      lower.includes('ngân sách dự kiến') ||
      lower === 'nhà phố' && skipMode ||
      lower.includes('1.8 - 2.3 tỷ') ||
      lower.includes('yêu cầu chi tiết')
    ) {
      skipMode = true;
    }
    
    // Dừng bỏ qua khi gặp dấu phân cách rõ ràng (section mới thực sự)
    if (skipMode && (lower.startsWith('##') || lower.startsWith('thiết kế:') || lower.startsWith('đvtc:'))) {
      skipMode = false;
    }
    
    if (!skipMode) {
      cleanLines.push(line);
    }
  }
  
  return cleanLines.join('\n').trim()
    // Xóa nhiều dòng trắng liên tiếp
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractImages(data) {
  const images = new Set();
  
  // Ưu tiên tìm ảnh trong gallery/lightbox (các link trỏ đến ảnh full size)
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (href && /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(href)) {
      const url = toAbsoluteUrl(href);
      if (url && !isSmallImage(url)) images.add(url);
    }
  });

  // Tìm ảnh srcset (lấy size lớn nhất)
  document.querySelectorAll('img').forEach(img => {
    const src = getBestImageSrc(img);
    if (src && isValidImageUrl(src) && !isSmallImage(src)) images.add(src);
  });

  // Tìm data-src lazy load
  document.querySelectorAll('[data-src],[data-lazy-src],[data-original]').forEach(el => {
    const src = el.getAttribute('data-src') || el.getAttribute('data-lazy-src') || el.getAttribute('data-original');
    if (src && isValidImageUrl(src) && !isSmallImage(src)) images.add(toAbsoluteUrl(src));
  });

  data.images = Array.from(images).filter(url => {
    return !url.includes('logo') &&
           !url.includes('favicon') &&
           !url.includes('icon') &&
           !url.includes('avatar') &&
           !url.includes('gravatar') &&
           !url.includes('dmca') &&
           !url.includes('fb.png') &&
           !url.includes('yt.png') &&
           !url.includes('150x150') &&
           !url.includes('300x') &&
           !url.match(/\d{2,3}x\d{2,3}\.(jpg|png|webp)/i); // thumbnail nhỏ
  });

  // Loại bỏ duplicate (scaled vs normal)
  // Ưu tiên URL có "-scaled" (full size)
  const deduped = [];
  const seen = new Set();
  for (const url of data.images) {
    // Chuẩn hóa: bỏ -scaled, -NNNxMMM để so sánh
    const base = url.replace(/-scaled/, '').replace(/-\d+x\d+(\.\w+)$/, '$1');
    if (!seen.has(base)) {
      seen.add(base);
      deduped.push(url);
    }
  }
  data.images = deduped;
}

function getBestImageSrc(img) {
  const srcset = img.getAttribute('srcset');
  if (srcset) {
    const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length > 0) {
      const largest = parts[parts.length - 1];
      const url = largest.split(/\s+/)[0];
      if (url) return toAbsoluteUrl(url);
    }
  }
  const dataSrc = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original');
  if (dataSrc) return toAbsoluteUrl(dataSrc);
  const src = img.getAttribute('src');
  if (src && !src.startsWith('data:')) return toAbsoluteUrl(src);
  return null;
}

function isSmallImage(url) {
  // Bỏ thumbnail nhỏ (150x150, 300x200, v.v.)
  return /[_-]\d{2,3}x\d{2,3}\.(jpg|jpeg|png|webp|gif)/i.test(url);
}

function toAbsoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return window.location.origin + url;
  return window.location.href.replace(/\/[^\/]*$/, '/') + url;
}

function isValidImageUrl(url) {
  if (!url) return false;
  return /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url) ||
         url.includes('/uploads/') ||
         url.includes('/wp-content/') ||
         url.includes('media.sbshouse');
}

// Lắng nghe message từ popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractData') {
    try {
      const data = extractProjectData();
      sendResponse({ success: true, data });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }
  return true;
});
