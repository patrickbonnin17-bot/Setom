(function () {
  'use strict';

  const attachmentCache = new Map();
  const signedUrlCache = new Map();
  const originalFetch = window.fetch.bind(window);

  function isSupabaseApi(url) {
    return typeof url === 'string' && /\/rest\/v1\/attachments/.test(url);
  }

  function isStorageSign(url) {
    return typeof url === 'string' && /\/storage\/v1\/object\/sign\/setom-files\//.test(url);
  }

  function parseWorkOrderId(url) {
    try {
      const u = new URL(url, window.location.origin);
      const raw = u.searchParams.get('work_order_id');
      return raw ? raw.replace(/^eq\./, '') : null;
    } catch (_) { return null; }
  }

  function parseStoragePath(url) {
    try {
      const u = new URL(url, window.location.origin);
      const marker = '/storage/v1/object/sign/setom-files/';
      const i = u.pathname.indexOf(marker);
      return i >= 0 ? decodeURIComponent(u.pathname.slice(i + marker.length)) : null;
    } catch (_) { return null; }
  }

  window.fetch = async function (input, init) {
    const requestUrl = typeof input === 'string' ? input : (input && input.url) || '';
    const response = await originalFetch(input, init);

    try {
      if (isSupabaseApi(requestUrl) && response.ok) {
        const clone = response.clone();
        const rows = await clone.json();
        const workOrderId = parseWorkOrderId(requestUrl);
        if (workOrderId && Array.isArray(rows)) {
          attachmentCache.set(workOrderId, rows);
          window.dispatchEvent(new CustomEvent('setom-attachments-updated'));
        }
      } else if (isStorageSign(requestUrl) && response.ok) {
        const clone = response.clone();
        const payload = await clone.json();
        const path = parseStoragePath(requestUrl);
        const signed = payload && (payload.signedURL || payload.signedUrl || payload.url);
        if (path && signed) {
          signedUrlCache.set(path, signed);
          window.dispatchEvent(new CustomEvent('setom-attachments-updated'));
        }
      }
    } catch (_) {}

    return response;
  };

  function getConstatSection() {
    const headings = Array.from(document.querySelectorAll('h3'));
    const heading = headings.find((el) => (el.textContent || '').trim() === 'Constat de facturation');
    return heading ? heading.closest('.os-section') : null;
  }

  function getCurrentWorkOrderId() {
    const rows = Array.from(attachmentCache.entries());
    return rows.length ? rows[rows.length - 1][0] : null;
  }

  function renderGallery() {
    const section = getConstatSection();
    if (!section) return;

    let container = section.querySelector('[data-setom-work-gallery]');
    const workOrderId = getCurrentWorkOrderId();
    const attachments = workOrderId ? (attachmentCache.get(workOrderId) || []) : [];
    const photos = attachments.filter((f) => f && f.category === 'travaux_realises' && /^image\//i.test(f.mime_type || '') && f.storage_path && signedUrlCache.has(f.storage_path));

    if (!container) {
      container = document.createElement('div');
      container.dataset.setomWorkGallery = 'true';
      container.style.cssText = 'margin:18px 0;padding:16px;border:1px solid #d9e0e7;border-radius:12px;background:#f8fafc;';
      const insertBefore = section.querySelector('.os-info-grid') || section.firstElementChild;
      if (insertBefore) insertBefore.parentNode.insertBefore(container, insertBefore);
      else section.appendChild(container);
    }

    container.innerHTML = '';

    const title = document.createElement('h4');
    title.textContent = '📷 Photos des travaux réalisés';
    title.style.margin = '0 0 10px';
    container.appendChild(title);

    const note = document.createElement('div');
    note.textContent = 'Photos reprises automatiquement depuis les travaux réalisés — aucun nouvel envoi nécessaire.';
    note.style.cssText = 'font-size:13px;color:#5f6b76;margin-bottom:12px;';
    container.appendChild(note);

    if (!photos.length) {
      const empty = document.createElement('div');
      empty.textContent = 'Aucune photo des travaux réalisés enregistrée pour cet OS.';
      empty.style.cssText = 'font-size:14px;color:#667085;padding:10px 0;';
      container.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;';

    photos.forEach((file) => {
      const url = signedUrlCache.get(file.storage_path);
      const card = document.createElement('button');
      card.type = 'button';
      card.style.cssText = 'border:1px solid #d0d5dd;background:#fff;border-radius:10px;padding:4px;cursor:pointer;text-align:left;overflow:hidden;';
      const img = document.createElement('img');
      img.src = url;
      img.alt = file.file_name || 'Photo des travaux réalisés';
      img.style.cssText = 'display:block;width:100%;height:110px;object-fit:cover;border-radius:7px;';
      card.appendChild(img);
      const caption = document.createElement('div');
      caption.textContent = file.file_name || 'Photo';
      caption.style.cssText = 'font-size:11px;padding:5px 3px 2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#475467;';
      card.appendChild(caption);
      card.addEventListener('click', function () {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
        const large = document.createElement('img');
        large.src = url;
        large.alt = img.alt;
        large.style.cssText = 'max-width:95vw;max-height:90vh;object-fit:contain;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.4);';
        overlay.appendChild(large);
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = '×';
        close.style.cssText = 'position:fixed;top:18px;right:20px;width:42px;height:42px;border:0;border-radius:50%;font-size:30px;line-height:1;background:#fff;color:#111;cursor:pointer;';
        close.addEventListener('click', function () { overlay.remove(); });
        overlay.appendChild(close);
        document.body.appendChild(overlay);
      });
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  let renderTimer = null;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderGallery, 120);
  }

  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('setom-attachments-updated', scheduleRender);
  window.addEventListener('load', scheduleRender);
  setInterval(scheduleRender, 1200);
})();
