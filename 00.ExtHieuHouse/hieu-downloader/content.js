// Content script cho hieuhouse.vn

function extractProjectData() {
  const data = {
    url: window.location.href,
    slug: getSlugFromUrl(window.location.href),
    projectInfo: {},
    shortDesc: '',
    description: '',
    images: []
  };

  extractProjectInfo(data);
  extractShortDesc(data);
  extractDescription(data);
  extractImages(data);
  return data;
}

function getSlugFromUrl(url) {
  try {
    const path = new URL(url).pathname.replace(/^\/|\/$/g, '');
    const parts = path.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'unknown';
  } catch (e) { return 'unknown'; }
}

// ===== Thông tin chi tiết =====
function extractProjectInfo(data) {
  const info = data.projectInfo;

  // Tên dự án từ h1
  const h1 = document.querySelector('h1, .entry-title, .post-title');
  if (h1) info['Tên dự án'] = h1.textContent.trim();

  // Container chính: elementor-element-9328649
  const container = document.querySelector('.elementor-element-9328649');
  if (container) {
    // Lấy tất cả text node lá (element không có con chứa text)
    // Cấu trúc thực tế: label và value là 2 text elements liên tiếp
    // VD: "Diện tích" rồi "200m2", "Địa điểm" rồi "Ninh Bình"
    const leafTexts = [];

    const walk = (el) => {
      // Bỏ qua tiêu đề "THÔNG TIN CÔNG TRÌNH"
      if (el.tagName && ['SCRIPT','STYLE','NAV'].includes(el.tagName)) return;

      const children = Array.from(el.children);
      if (children.length === 0) {
        // Leaf node
        const t = el.textContent.trim();
        if (t.length > 0 && t.length < 200) leafTexts.push(t);
      } else {
        children.forEach(walk);
      }
    };
    walk(container);

    // Lọc bỏ dòng tiêu đề section
    const filtered = leafTexts.filter(t =>
      t.toUpperCase() !== t || t.length < 5  // bỏ dòng ALL CAPS dài (tiêu đề)
    ).filter(t =>
      !['THÔNG TIN CÔNG TRÌNH', 'THÔNG TIN DỰ ÁN'].includes(t.toUpperCase())
    );

    // Ghép cặp: các label thông tin là những từ khóa biết trước
    const knownLabels = [
      'diện tích', 'địa điểm', 'vị trí', 'kiểu nhà', 'phong cách',
      'số tầng', 'năm hoàn thành', 'chi phí', 'diện tích xây dựng',
      'loại công trình', 'chủ đầu tư', 'kiến trúc sư', 'team thiết kế'
    ];

    // Duyệt từng cặp liên tiếp
    for (let i = 0; i < filtered.length; i++) {
      const t = filtered[i];
      const lower = t.toLowerCase().trim();

      // Nếu t là 1 label đã biết
      const isLabel = knownLabels.some(kw => lower === kw || lower.startsWith(kw));
      if (isLabel) {
        // Value là element tiếp theo (nếu không phải label khác)
        const nextT = filtered[i + 1];
        if (nextT) {
          const nextLower = nextT.toLowerCase().trim();
          const nextIsLabel = knownLabels.some(kw => nextLower === kw || nextLower.startsWith(kw));
          if (!nextIsLabel) {
            info[t] = nextT;
            i++; // skip value
          } else {
            // Value rỗng (Kiểu nhà không có giá trị)
            info[t] = '';
          }
        } else {
          info[t] = '';
        }
      }
    }

    // Nếu vẫn không lấy được → thử parse theo kiểu từng p/span liên tiếp
    if (Object.keys(info).length <= 1) {
      parsePairElements(container, info);
    }
  }

  // Fallback tên từ og:title
  if (!info['Tên dự án']) {
    const og = document.querySelector('meta[property="og:title"]');
    if (og) info['Tên dự án'] = og.getAttribute('content');
  }
}

function parsePairElements(container, info) {
  // Lấy tất cả các element chỉ chứa text (không có child element)
  const els = Array.from(container.querySelectorAll('p, span, h2, h3, h4, h5, div'))
    .filter(el => {
      if (el.children.length > 0) return false;
      const t = el.textContent.trim();
      return t.length > 0 && t.length < 150;
    });

  const knownLabels = [
    'diện tích', 'địa điểm', 'vị trí', 'kiểu nhà', 'phong cách',
    'số tầng', 'năm hoàn thành', 'chi phí', 'diện tích xây dựng',
    'loại công trình', 'chủ đầu tư', 'kiến trúc sư'
  ];

  for (let i = 0; i < els.length; i++) {
    const label = els[i].textContent.trim();
    const lower = label.toLowerCase();
    const isLabel = knownLabels.some(kw => lower === kw || lower.startsWith(kw));

    if (isLabel && !info[label]) {
      const next = els[i + 1];
      if (next) {
        const nextT = next.textContent.trim();
        const nextLower = nextT.toLowerCase();
        const nextIsLabel = knownLabels.some(kw => nextLower === kw || nextLower.startsWith(kw));
        info[label] = nextIsLabel ? '' : nextT;
        if (!nextIsLabel) i++;
      }
    }
  }
}

// ===== Mô tả ngắn: elementor-element-85d69c9 =====
function extractShortDesc(data) {
  const el = document.querySelector('.elementor-element-85d69c9');
  if (el) data.shortDesc = (el.innerText || el.textContent || '').trim();
}

// ===== Mô tả đầy đủ: elementor-element-2fe4c171 =====
function extractDescription(data) {
  const el = document.querySelector('.elementor-element-2fe4c171');
  if (el) { data.description = cleanText(el); return; }

  // Fallback .content_p
  const cp = document.querySelector('.content_p');
  if (cp) { data.description = cleanText(cp); return; }

  for (const s of ['.entry-content', '.post-content', '.elementor-widget-theme-post-content']) {
    const fb = document.querySelector(s);
    if (fb && fb.innerText.trim().length > 50) { data.description = cleanText(fb); return; }
  }
}

function cleanText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('form, script, style, .wpcf7, [class*="form"], nav, [class*="share"], [class*="social"], [class*="comment"]').forEach(e => e.remove());
  const formKws = ['đặt lịch tư vấn', 'đăng ký tư vấn', 'lựa chọn dịch vụ', 'họ tên', 'số điện thoại', 'để lại thông tin', 'nhận tư vấn'];
  clone.querySelectorAll('p, div, li, h2, h3').forEach(e => {
    if (formKws.some(kw => e.textContent.toLowerCase().includes(kw)) && e.querySelectorAll('p').length < 3) e.remove();
  });
  return (clone.innerText || clone.textContent || '')
    .split('\n').filter(line => !formKws.some(kw => line.toLowerCase().includes(kw)))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ===== Lấy ảnh =====
function extractImages(data) {
  const images = new Set();

  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (href && /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(href)) {
      const url = toAbs(href);
      if (url && !isSmall(url)) images.add(url);
    }
  });

  document.querySelectorAll('img').forEach(img => {
    const src = bestSrc(img);
    if (src && isValidImg(src) && !isSmall(src)) images.add(src);
  });

  document.querySelectorAll('[data-background],[data-bg],[data-src],[data-lazy-src],[data-original]').forEach(el => {
    const src = el.getAttribute('data-background') || el.getAttribute('data-bg') ||
                el.getAttribute('data-src') || el.getAttribute('data-lazy-src') || el.getAttribute('data-original');
    if (src && isValidImg(src) && !isSmall(src)) images.add(toAbs(src));
  });

  document.querySelectorAll('[style*="background-image"]').forEach(el => {
    const m = el.getAttribute('style').match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
    if (m && isValidImg(m[1])) images.add(toAbs(m[1]));
  });

  data.images = Array.from(images).filter(url =>
    !url.includes('logo') && !url.includes('favicon') && !url.includes('icon') &&
    !url.includes('avatar') && !url.includes('dmca') && !url.includes('banner-menu') &&
    !url.match(/-(150x150|100x100|50x50)\./i)
  );

  const seen = new Set();
  data.images = data.images.filter(url => {
    const base = url.replace(/-scaled/, '').replace(/-\d+x\d+(\.\w+)$/, '$1');
    if (seen.has(base)) return false;
    seen.add(base);
    return true;
  });
}

function bestSrc(img) {
  const srcset = img.getAttribute('srcset');
  if (srcset) {
    const parts = srcset.split(',').map(s => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) { const u = last.split(/\s+/)[0]; if (u) return toAbs(u); }
  }
  const ds = img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-original');
  if (ds) return toAbs(ds);
  const src = img.getAttribute('src');
  if (src && !src.startsWith('data:')) return toAbs(src);
  return null;
}

function isSmall(url) { return /[_-]\d{2,3}x\d{2,3}\.(jpg|jpeg|png|webp|gif)/i.test(url); }
function toAbs(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return location.origin + url;
  return location.href.replace(/\/[^\/]*$/, '/') + url;
}
function isValidImg(url) {
  if (!url) return false;
  return /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url) ||
         url.includes('/uploads/') || url.includes('/wp-content/') || url.includes('/images/');
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractData') {
    try { sendResponse({ success: true, data: extractProjectData() }); }
    catch (e) { sendResponse({ success: false, error: e.message }); }
  }
  return true;
});
