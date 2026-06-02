/* ============================================================
   refs-system.js v2.0 — Sistema de Referencias y Visor PDF
   Para candidatos-colombia-2026
   
   ✅ Tooltips responsivos (position: fixed)
   ✅ Visor PDF mobile-first
   ✅ Manejo robusto de errores
   ✅ Touch events optimizados
   ============================================================ */

(function() {
  'use strict';

  const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  
  let refRegistry = null;
  let pdfjsLib = null;
  let currentPdfDoc = null;
  let currentPageNum = 1;
  let currentRefId = null;
  let isPdfReady = false;

  // ===== CUSTOM ERROR =====
  class PageOutOfRangeError extends Error {
    constructor(msg) {
      super(msg);
      this.name = 'PageOutOfRangeError';
    }
  }

  const state = {
    viewerOpen: false,
    loadingPdf: false,
    tooltipVisible: false,
  };

  // ===== LOAD REGISTRY =====
  async function loadRegistry() {
    try {
      const resp = await fetch('/refs/registry.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      refRegistry = await resp.json();
      return true;
    } catch (e) {
      if (window.__REFS_DATA__) {
        refRegistry = window.__REFS_DATA__;
        return true;
      }
      console.warn('[Refs] No registry available');
      return false;
    }
  }

  // ===== GET REF =====
  function getRef(refId) {
    if (!refRegistry || !refId) return null;
    for (const [candKey, cand] of Object.entries(refRegistry.candidates)) {
      for (const sec of Object.values(cand.sections)) {
        const found = sec.refs.find(r => r.id === refId);
        if (found) return { ...found, candidateKey: candKey, candidate: cand };
      }
    }
    return null;
  }

  // ===== LOAD PDF.JS =====
  function loadPdfJs() {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) { pdfjsLib = window.pdfjsLib; resolve(); return; }
      const script = document.createElement('script');
      script.src = PDFJS_CDN;
      script.onload = () => {
        pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve();
      };
      script.onerror = () => reject(new Error('No se pudo cargar PDF.js'));
      document.head.appendChild(script);
    });
  }

  // ===== RENDER PDF PAGE con soporte retina/HiDPI =====
  async function renderPdfPage(pageNum) {
    const canvas = document.getElementById('pdf-canvas');
    const body = document.getElementById('pdf-body');
    if (!canvas || !body || !currentPdfDoc) return;
    
    const ctx = canvas.getContext('2d');
    try {
      const page = await currentPdfDoc.getPage(pageNum);
      const vp = page.getViewport({ scale: 1 });
      
      // Calcular escala base para que quepa en el ancho del contenedor
      const maxWidth = Math.min(body.clientWidth - 8, 900);
      const baseScale = maxWidth / vp.width;
      
      // Aplicar devicePixelRatio para nitidez en pantallas retina
      const dpr = window.devicePixelRatio || 1;
      const svp = page.getViewport({ scale: baseScale * dpr });
      
      // Canvas interno: tamaño real (para renderizado nítido)
      canvas.width = svp.width;
      canvas.height = svp.height;
      // Canvas visual: tamaño reducido (para que quepa en el contenedor)
      canvas.style.width = (svp.width / dpr) + 'px';
      canvas.style.height = (svp.height / dpr) + 'px';
      canvas.style.display = 'block';
      
      await page.render({ canvasContext: ctx, viewport: svp }).promise;
      
      currentPageNum = pageNum;
      
      const input = document.getElementById('pdf-page-input');
      const total = document.getElementById('pdf-total-pages');
      if (input) input.value = pageNum;
      if (total) total.textContent = currentPdfDoc.numPages;
      
      // Scroll to top of viewer
      body.scrollTop = 0;
      
    } catch (e) {
      console.warn('[Refs] Render error:', e.message);
      showUnavailable(currentRefId, 'No se pudo renderizar esta página del PDF.');
    }
  }

  // ===== TOGGLE VIEWER LOADING STATE =====
  function showLoader() {
    hideAllStates();
    const el = document.getElementById('pdf-loader');
    if (el) el.style.display = 'block';
    const controls = document.querySelector('.pdf-controls-row');
    if (controls) controls.classList.remove('visible');
  }

  function hideAllStates() {
    ['pdf-loader', 'pdf-error', 'pdf-unavailable'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const canvas = document.getElementById('pdf-canvas');
    if (canvas) canvas.style.display = 'none';
  }

  function showUnavailable(refId, customMsg) {
    hideAllStates();
    const ref = refId ? getRef(refId) : null;
    const unavailable = document.getElementById('pdf-unavailable');
    const controls = document.querySelector('.pdf-controls-row');
    if (controls) controls.classList.remove('visible');
    if (!unavailable) return;
    
    unavailable.style.display = 'block';
    
    // Always show: referncia completa y estado del PDF
    const meta = document.getElementById('pdf-ref-meta');
    if (meta && ref) {
      meta.innerHTML = `
        <span class="meta-label">📍 UBICACIÓN EXACTA EN EL DOCUMENTO</span>
        <strong>Documento:</strong> ${ref.candidate.pdfLabel || 'Plan de Gobierno'}<br>
        ${ref.chapter ? `<strong>Capítulo:</strong> ${ref.chapter}<br>` : ''}
        ${ref.section ? `<strong>Sección:</strong> ${ref.section}<br>` : ''}
        ${ref.subtitle ? `<strong>Subtítulo:</strong> ${ref.subtitle}<br>` : ''}
        <strong>Página:</strong> ${ref.page || '—'}<br>
        ${ref.paragraph ? `<strong>Párrafo:</strong> ${ref.paragraph}<br>` : ''}
        <br>
        <span class="quote-text">💬 "${(ref.context || ref.text || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}"</span>
      `;
    } else if (meta) {
      meta.innerHTML = `<span class="meta-label">⚠️ REFERENCIA</span><p>Referencia no encontrada en el registro.</p>`;
    }
    
    const btn = document.getElementById('pdf-external-btn');
    if (btn && ref) {
      btn.style.display = 'inline-flex';
      const url = ref.candidate.pdfUrl;
      if (url) {
        btn.textContent = '🔗 Ver PDF externo →';
        btn.onclick = () => window.open(url, '_blank');
      } else {
        btn.textContent = '📄 Buscar en el PDF original (pág. ' + ref.page + ')';
        btn.onclick = null;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'default';
      }
    } else if (btn) {
      btn.style.display = 'none';
    }
    
    // Custom message override
    if (customMsg) {
      const msgEl = document.querySelector('.pdf-unavailable p');
      if (msgEl) msgEl.textContent = customMsg;
    }
  }

  // ===== OPEN PDF VIEWER =====
  async function openPdfViewer(refId) {
    const ref = getRef(refId);
    if (!ref) {
      alert('Referencia no encontrada en el registro.');
      return;
    }
    
    currentRefId = refId;
    const overlay = document.getElementById('pdf-modal-overlay');
    if (!overlay) return;
    
    // Set title
    const titleEl = document.getElementById('pdf-modal-title');
    if (titleEl) titleEl.textContent = ref.candidate.pdfLabel || 'Plan de Gobierno';
    
    overlay.classList.add('open');
    state.viewerOpen = true;
    document.body.style.overflow = 'hidden';
    
    showLoader();
    
    // Try loading PDF
    try {
      if (!pdfjsLib) await loadPdfJs();
      
      const pdfPath = ref.candidate.pdf;
      if (!pdfPath) {
        throw new Error('PDF_NO_PATH');
      }
      
      const loadingTask = pdfjsLib.getDocument(pdfPath);
      currentPdfDoc = await loadingTask.promise;
      
      hideAllStates();
      const canvas = document.getElementById('pdf-canvas');
      if (canvas) canvas.style.display = 'block';
      
      const controls = document.querySelector('.pdf-controls-row');
      if (controls) controls.classList.add('visible');
      isPdfReady = true;
      
      // Navigate to ref's page
      const page = parseInt(ref.page) || 1;
      
      // Validar que la página solicitada exista en el documento
      const totalPages = currentPdfDoc.numPages;
      if (page > totalPages) {
        hideAllStates();
        const canvas = document.getElementById('pdf-canvas');
        if (canvas) canvas.style.display = 'none';
        const controls = document.querySelector('.pdf-controls-row');
        if (controls) controls.classList.remove('visible');
        
        throw new PageOutOfRangeError(
          'La página ' + page + ' no existe en el PDF actual (' + totalPages + ' págs.). ' +
          'La referencia apunta a un anexo o sección que pudo haber sido eliminada o ' +
          'corresponde a una versión extendida del documento.'
        );
      }
      
      await renderPdfPage(page);
      
    } catch (e) {
      console.error('[Refs] PDF load failed:', e.name, e.message);
      
      // Mostrar error específico según la causa
      if (e instanceof PageOutOfRangeError) {
        showUnavailable(refId, e.message);
        // Habilitar botón para abrir PDF externo
        const btn = document.getElementById('pdf-external-btn');
        if (btn && ref) {
          btn.style.display = 'inline-flex';
          btn.textContent = '📄 Abrir PDF completo (pág. ' + ref.page + ' no existe)';
          btn.style.opacity = '0.6';
          btn.style.cursor = 'default';
        }
      } else if (e.message === 'PDF_NO_PATH') {
        showUnavailable(refId, 'El PDF no ha sido agregado al repositorio. Consulta la referencia manualmente usando los datos de ubicación exacta.');
      } else if (e.name === 'MissingPDFException') {
        showUnavailable(refId, 'El archivo PDF no se encuentra en la ruta especificada. Verifica que el archivo exista en el servidor.');
      } else {
        // Error genérico de carga/renderizado
        const errorDetail = e.message ? ' (' + e.message.substring(0, 80) + ')' : '';
        showUnavailable(refId, 'No se pudo cargar el PDF.' + errorDetail + ' Consulta la referencia manualmente.');
      }
      
      console.log('[Refs] Para diagnóstico, coloca el PDF real en: ' + (ref.candidate.pdf || 'pdfs/'));
    }
  }

  // ===== CLOSE PDF VIEWER =====
  function closePdfViewer() {
    const overlay = document.getElementById('pdf-modal-overlay');
    if (overlay) overlay.classList.remove('open');
    state.viewerOpen = false;
    isPdfReady = false;
    currentPdfDoc = null;
    document.body.style.overflow = '';
  }

  // ===== NAVIGATE =====
  async function goToPage(pageNum) {
    if (!currentPdfDoc) return;
    const max = currentPdfDoc.numPages;
    pageNum = Math.max(1, Math.min(max, pageNum));
    await renderPdfPage(pageNum);
  }

  // ===== TOOLTIP =====
  function showTooltipForBadge(badgeEl) {
    // Close existing tooltip
    const existing = document.querySelector('.ref-tooltip');
    if (existing) existing.remove();
    
    const refId = badgeEl.dataset.refId;
    const refData = getRef(refId);
    
    if (!refData) {
      badgeEl.style.borderColor = '#ff6b6b';
      setTimeout(() => { badgeEl.style.borderColor = ''; }, 1500);
      return;
    }
    
    const tooltip = document.createElement('div');
    tooltip.className = 'ref-tooltip';
    const isAbel = refData.candidateKey === 'abelardo';
    
    tooltip.innerHTML = `
      <span class="ref-source">📄 ${refData.candidate.pdfLabel || 'Plan de Gobierno'}</span>
      <span class="ref-context">${refData.context || '—'}</span>
      <div style="font-size:0.72rem;color:#888;margin-bottom:6px;">
        ${refData.chapter ? `📖 ${refData.chapter}` : ''}
        ${refData.section ? ` › ${refData.section}` : ''}
        · Pág. ${refData.page || '—'}
      </div>
      <div class="ref-actions">
        <button class="ref-view-btn ${isAbel ? 'abel-btn' : ''}" data-ref-id="${refData.id}">
          🔍 Ver en el plan de gobierno
        </button>
      </div>
    `;
    
    tooltip.querySelector('.ref-view-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      tooltip.remove();
      state.tooltipVisible = false;
      openPdfViewer(this.dataset.refId);
    });
    
    document.body.appendChild(tooltip);
    
    // Position tooltip
    const brect = badgeEl.getBoundingClientRect();
    const isMobile = window.innerWidth < 480;
    
    if (isMobile) {
      // Full-width tooltip below badge
      tooltip.style.position = 'fixed';
      tooltip.style.top = (brect.bottom + 6) + 'px';
      tooltip.style.left = '12px';
      tooltip.style.right = '12px';
      tooltip.style.width = 'auto';
      tooltip.style.maxWidth = 'none';
      
      // If off-screen bottom, show above
      if (brect.bottom + tooltip.offsetHeight + 20 > window.innerHeight) {
        tooltip.style.top = '';
        tooltip.style.bottom = (window.innerHeight - brect.top + 6) + 'px';
      }
    } else {
      const tw = Math.min(320, window.innerWidth - 40);
      let top = brect.bottom + 8;
      let left = brect.left + brect.width/2 - tw/2;
      
      if (left < 10) left = 10;
      if (left + tw > window.innerWidth - 10) left = window.innerWidth - tw - 10;
      if (top + 220 > window.innerHeight) top = brect.top - 10;
      
      tooltip.style.position = 'fixed';
      tooltip.style.top = top + 'px';
      tooltip.style.left = left + 'px';
      tooltip.style.maxWidth = tw + 'px';
    }
    
    tooltip.classList.add('visible');
    state.tooltipVisible = true;
  }

  // ===== CLOSE TOOLTIPS =====
  function closeAllTooltips() {
    document.querySelectorAll('.ref-tooltip').forEach(el => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 200);
    });
    state.tooltipVisible = false;
  }

  // ===== CREATE REFERENCE BADGE =====
  function createRefBadge(refData) {
    const badge = document.createElement('span');
    badge.className = `ref-badge ${(refData.candidateKey === 'abelardo') ? 'abel' : 'cep'}`;
    badge.dataset.refId = refData.id;
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('aria-label', refData.context || 'Ver referencia');
    badge.textContent = `📄 p.${refData.page || '?'}`;
    
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      showTooltipForBadge(this);
    });
    
    badge.addEventListener('touchstart', function(e) {
      // On mobile, just mark for click - don't interfere with scroll
      this.dataset.touched = 'true';
    }, { passive: true });
    
    badge.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
    
    return badge;
  }

  // ===== ADD BADGES TO DOM =====
  function addReferenceBadges() {
    if (!refRegistry) return;
    const elements = document.querySelectorAll('[data-ref]');
    let badgesAdded = 0;
    let badgesSkipped = 0;
    
    elements.forEach(el => {
      const refId = el.dataset.ref;
      if (!refId) return;
      
      const refData = getRef(refId);
      if (!refData) {
        badgesSkipped++;
        return;
      }
      
      const badge = createRefBadge(refData);
      el.appendChild(badge);
      badgesAdded++;
    });
    
    console.log(`[Refs] Badges: ${badgesAdded} added, ${badgesSkipped} skipped (not in registry)`);
  }

  // ===== BUILD PDF MODAL DOM =====
  function injectPdfViewer() {
    if (document.getElementById('pdf-modal-overlay')) return;
    
    const div = document.createElement('div');
    div.id = 'pdf-modal-overlay';
    div.className = 'pdf-modal-overlay';
    div.innerHTML = `
      <div class="pdf-modal-box">
        <!-- Header -->
        <div class="pdf-modal-header">
          <span class="pdf-modal-title" id="pdf-modal-title">Visor de Plan de Gobierno</span>
          <button class="pdf-modal-close-btn" id="pdf-close-btn" aria-label="Cerrar">✕</button>
        </div>
        
        <!-- Body -->
        <div class="pdf-modal-body" id="pdf-body">
          <div class="pdf-loader" id="pdf-loader">
            <div class="spinner"></div>
            <p>Cargando plan de gobierno...</p>
          </div>
          
          <div class="pdf-error" id="pdf-error" style="display:none;"></div>
          
          <canvas id="pdf-canvas" style="display:none;"></canvas>
          
          <div class="pdf-unavailable" id="pdf-unavailable" style="display:none;">
            <span class="big-icon">📄</span>
            <h3>Plan de Gobierno no disponible en el visor</h3>
            <p>El PDF aún no ha sido agregado al repositorio. Puedes buscar la referencia manualmente usando los datos de ubicación exacta.</p>
            <div class="ref-meta" id="pdf-ref-meta"></div>
            <button class="external-btn" id="pdf-external-btn" style="display:none;">
              🔗 Ver fuente externa →
            </button>
          </div>
        </div>
        
        <!-- Controls -->
        <div class="pdf-controls-row" id="pdf-controls-row">
          <button class="nav-btn" id="pdf-prev-btn" aria-label="Página anterior">◀</button>
          <input type="number" class="pdf-page-input" id="pdf-page-input" value="1" min="1" aria-label="Número de página">
          <span class="page-label">de <span id="pdf-total-pages">—</span></span>
          <button class="nav-btn" id="pdf-next-btn" aria-label="Página siguiente">▶</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(div);
    
    // Bind events
    document.getElementById('pdf-close-btn').addEventListener('click', closePdfViewer);
    document.getElementById('pdf-prev-btn').addEventListener('click', () => goToPage(currentPageNum - 1));
    document.getElementById('pdf-next-btn').addEventListener('click', () => goToPage(currentPageNum + 1));
    document.getElementById('pdf-page-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const v = parseInt(e.target.value);
        if (!isNaN(v)) goToPage(v);
      }
    });
    
    // Close on backdrop click (desktop only)
    div.addEventListener('click', (e) => {
      if (e.target === div) closePdfViewer();
    });
    
    // Global keyboard
    document.addEventListener('keydown', (e) => {
      if (!state.viewerOpen) return;
      if (e.key === 'Escape') { closePdfViewer(); return; }
      if (!isPdfReady) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPage(currentPageNum - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goToPage(currentPageNum + 1); }
    });
    
    // Resize handler
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        if (state.viewerOpen && currentPdfDoc) renderPdfPage(currentPageNum);
      }, 300);
    });
  }

  // ===== GLOBAL CLICK =====
  document.addEventListener('click', (e) => {
    if (state.tooltipVisible && 
        !e.target.closest('.ref-tooltip') && 
        !e.target.closest('.ref-badge')) {
      closeAllTooltips();
    }
  });

  // ===== INIT =====
  async function init() {
    console.log('[Refs] Initializing...');
    const loaded = await loadRegistry();
    if (!loaded) {
      console.warn('[Refs] No reference data. System disabled.');
      return;
    }
    injectPdfViewer();
    addReferenceBadges();
    console.log('[Refs] System ready.');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  window.__RefsSystem = { getRef, openPdfViewer, closePdfViewer, goToPage, state };

})();
