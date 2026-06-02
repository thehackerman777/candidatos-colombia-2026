/* ============================================================
   refs-system.js — Sistema de Referencias y Visor PDF
   Para candidatos-colombia-2026
   
   Dependencias: PDF.js (CDN) — cargado dinámicamente
   ============================================================ */

(function() {
  'use strict';

  // ===== CONFIG =====
  const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  
  let refRegistry = null;
  let pdfjsLib = null;
  let currentPdfDoc = null;
  let currentPageNum = 1;
  let currentRefId = null;
  let isPdfReady = false;

  // ===== STATE =====
  const state = {
    viewerOpen: false,
    loadingPdf: false,
    tooltipVisible: false,
  };

  // ===== LOAD REFERENCE REGISTRY =====
  async function loadRegistry() {
    try {
      const resp = await fetch('/refs/registry.json');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      refRegistry = await resp.json();
      console.log(`[Refs] Registry loaded: ${Object.keys(refRegistry.candidates).length} candidates`);
      return true;
    } catch (e) {
      console.warn('[Refs] Could not load registry, using embedded fallback:', e.message);
      // Fallback: try window.__REFS_DATA__ if embedded
      if (window.__REFS_DATA__) {
        refRegistry = window.__REFS_DATA__;
        return true;
      }
      return false;
    }
  }

  // ===== GET REFERENCE BY ID =====
  function getRef(refId) {
    if (!refRegistry) return null;
    for (const [candKey, cand] of Object.entries(refRegistry.candidates)) {
      for (const [secKey, sec] of Object.entries(cand.sections)) {
        const found = sec.refs.find(r => r.id === refId);
        if (found) {
          return { ...found, candidateKey: candKey, candidate: cand, section: sec };
        }
      }
    }
    return null;
  }

  // ===== GET ALL REFS FOR A CANDIDATE =====
  function getCandidateRefs(candidateKey) {
    if (!refRegistry) return [];
    const cand = refRegistry.candidates[candidateKey];
    if (!cand) return [];
    const all = [];
    for (const sec of Object.values(cand.sections)) {
      all.push(...sec.refs.map(r => ({ ...r, candidateKey, candidate: cand, section: sec })));
    }
    return all;
  }

  // ===== LOAD PDF.JS =====
  function loadPdfJs() {
    return new Promise((resolve, reject) => {
      if (window.pdfjsLib) {
        pdfjsLib = window.pdfjsLib;
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = PDFJS_CDN;
      script.onload = () => {
        pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js'));
      document.head.appendChild(script);
    });
  }

  // ===== RENDER PDF PAGE =====
  async function renderPdfPage(pageNum) {
    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');
    const container = document.getElementById('pdf-body');
    
    if (!currentPdfDoc) return;
    
    try {
      const page = await currentPdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      
      // Calculate scale to fit width
      const containerWidth = container.clientWidth - 20;
      const scale = Math.min(containerWidth / viewport.width, 2.0);
      const scaledViewport = page.getViewport({ scale });
      
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      
      await page.render({
        canvasContext: ctx,
        viewport: scaledViewport,
      }).promise;
      
      currentPageNum = pageNum;
      document.getElementById('pdf-current-page').value = pageNum;
      document.getElementById('pdf-total-pages').textContent = currentPdfDoc.numPages;
      
      // Apply highlight if we have a ref
      applyHighlight();
      
    } catch (e) {
      console.error('[Refs] Render error:', e);
    }
  }

  // ===== APPLY HIGHLIGHT =====
  function applyHighlight() {
    // Remove existing highlight
    const existing = document.getElementById('pdf-highlight-overlay');
    if (existing) existing.remove();
    
    if (!currentRefId) return;
    
    const ref = getRef(currentRefId);
    if (!ref || ref.page !== currentPageNum) return;
    
    // Create a subtle highlight indicator
    const container = document.getElementById('pdf-body');
    const highlight = document.createElement('div');
    highlight.id = 'pdf-highlight-overlay';
    highlight.className = 'pdf-highlight';
    highlight.style.top = '10%';
    highlight.style.left = '5%';
    highlight.style.width = '90%';
    highlight.style.height = '15%';
    container.appendChild(highlight);
    
    // Auto-fade after a few seconds
    setTimeout(() => {
      if (highlight.parentNode) {
        highlight.style.opacity = '0.3';
      }
    }, 3000);
  }

  // ===== OPEN PDF VIEWER =====
  async function openPdfViewer(refId) {
    const ref = getRef(refId);
    if (!ref) {
      console.warn(`[Refs] Reference not found: ${refId}`);
      return;
    }
    
    currentRefId = refId;
    
    const overlay = document.getElementById('pdf-modal-overlay');
    if (!overlay) {
      console.error('[Refs] PDF modal overlay not found in DOM');
      return;
    }
    
    // Set title
    const titleEl = document.getElementById('pdf-modal-title');
    if (titleEl) {
      titleEl.textContent = `${ref.candidate.pdfLabel} — ${ref.section.label}`;
    }
    
    // Show loader
    const loader = document.getElementById('pdf-loader');
    const canvas = document.getElementById('pdf-canvas');
    const errorEl = document.getElementById('pdf-error');
    const controls = document.getElementById('pdf-controls');
    const unavailable = document.getElementById('pdf-unavailable');
    
    if (loader) loader.style.display = 'block';
    if (canvas) canvas.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
    if (controls) controls.style.display = 'none';
    if (unavailable) unavailable.style.display = 'none';
    
    // Show ref metadata in unavailable section
    const refMeta = document.getElementById('pdf-unavailable-meta');
    if (refMeta) {
      refMeta.innerHTML = `
        <strong>📍 Ubicación exacta:</strong><br>
        📄 ${ref.candidate.pdfLabel}<br>
        📖 Capítulo: ${ref.chapter || '—'}<br>
        ${ref.section ? `📑 Sección: ${ref.section}<br>` : ''}
        ${ref.subtitle ? `📌 Subtítulo: ${ref.subtitle}<br>` : ''}
        📃 Página: ${ref.page}<br>
        ${ref.paragraph ? `📝 Párrafo: ${ref.paragraph}<br>` : ''}
        <br>
        <span>💬 "${ref.context}"</span>
      `;
    }
    
    overlay.classList.add('open');
    state.viewerOpen = true;
    document.body.style.overflow = 'hidden';
    
    // Try to load PDF
    try {
      if (!pdfjsLib) await loadPdfJs();
      
      const pdfPath = ref.candidate.pdf;
      if (!pdfPath || pdfPath === '/pdfs/placeholder.pdf') {
        throw new Error('PDF_NOT_AVAILABLE');
      }
      
      const loadingTask = pdfjsLib.getDocument(pdfPath);
      currentPdfDoc = await loadingTask.promise;
      
      if (loader) loader.style.display = 'none';
      if (canvas) canvas.style.display = 'block';
      if (controls) controls.style.display = 'flex';
      
      isPdfReady = true;
      
      // Navigate to target page
      await renderPdfPage(ref.page);
      
    } catch (e) {
      console.warn('[Refs] PDF load error:', e.message);
      if (loader) loader.style.display = 'none';
      
      if (e.message === 'PDF_NOT_AVAILABLE' || e.message.includes('404') || e.message.includes('Failed to fetch')) {
        // Show unavailable state
        if (unavailable) {
          unavailable.style.display = 'block';
          unavailable.querySelector('.big-icon').textContent = '📄';
          unavailable.querySelector('h3').textContent = 'Plan de Gobierno no disponible en el visor';
          unavailable.querySelector('p').textContent = 'El PDF del plan de gobierno aún no ha sido agregado al repositorio. Mientras tanto, puedes consultar la referencia de ubicación exacta a la derecha.';
          const goBtn = unavailable.querySelector('.btn-read');
          if (goBtn) {
            goBtn.textContent = '🔗 Ver fuente externa →';
            goBtn.onclick = () => {
              const url = ref.candidate.pdfUrl;
              if (url) window.open(url, '_blank');
            };
          }
        }
      } else {
        if (errorEl) {
          errorEl.style.display = 'block';
          errorEl.textContent = `Error al cargar el PDF: ${e.message}`;
        }
      }
    }
  }

  // ===== CLOSE PDF VIEWER =====
  function closePdfViewer() {
    const overlay = document.getElementById('pdf-modal-overlay');
    if (overlay) overlay.classList.remove('open');
    state.viewerOpen = false;
    document.body.style.overflow = '';
    currentPdfDoc = null;
    currentRefId = null;
    isPdfReady = false;
  }

  // ===== NAVIGATE PDF =====
  async function goToPage(pageNum) {
    if (!currentPdfDoc) return;
    const numPages = currentPdfDoc.numPages;
    if (pageNum < 1) pageNum = 1;
    if (pageNum > numPages) pageNum = numPages;
    await renderPdfPage(pageNum);
  }

  // ===== CREATE REFERENCE BADGE =====
  function createRefBadge(refData) {
    const badge = document.createElement('span');
    badge.className = `ref-badge ${refData.candidateKey === 'abelardo' ? 'abel' : 'cep'}`;
    badge.dataset.refId = refData.id;
    badge.setAttribute('role', 'button');
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('aria-label', `Ver referencia: ${refData.context}`);
    badge.innerHTML = `<span class="ref-icon">📄</span> p.${refData.page}`;
    
    // Click: show tooltip
    badge.addEventListener('click', function(e) {
      e.stopPropagation();
      const tooltip = createTooltip(refData, this);
      showTooltip(tooltip, this);
    });
    
    // Enter key support
    badge.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.click();
      }
    });
    
    return badge;
  }

  // ===== CREATE TOOLTIP =====
  function createTooltip(refData, badgeEl) {
    // Remove any existing tooltip
    const existing = document.querySelector('.ref-tooltip');
    if (existing) existing.remove();
    
    const tooltip = document.createElement('div');
    tooltip.className = 'ref-tooltip';
    
    const isAbel = refData.candidateKey === 'abelardo';
    
    tooltip.innerHTML = `
      <span class="ref-source">📄 ${refData.candidate.pdfLabel}</span>
      <span class="ref-context">${refData.context}</span>
      <div style="font-size:0.7rem;color:#888;margin-bottom:6px;">
        ${refData.chapter ? `📖 ${refData.chapter}` : ''}
        ${refData.section ? ` › ${refData.section}` : ''}
        ${refData.subtitle ? ` › ${refData.subtitle}` : ''}
        · Pág. ${refData.page}
        ${refData.paragraph ? ` · Párr. ${refData.paragraph}` : ''}
      </div>
      <div class="ref-actions">
        <button class="ref-view-btn ${isAbel ? 'abel-btn' : ''}" data-ref-id="${refData.id}">
          🔍 Ver en el plan de gobierno
        </button>
      </div>
    `;
    
    // Bind view button
    tooltip.querySelector('.ref-view-btn').addEventListener('click', function() {
      closeAllTooltips();
      openPdfViewer(this.dataset.refId);
    });
    
    document.body.appendChild(tooltip);
    return tooltip;
  }

  // ===== SHOW TOOLTIP =====
  function showTooltip(tooltip, badgeEl) {
    const badgeRect = badgeEl.getBoundingClientRect();
    const tooltipWidth = Math.min(320, window.innerWidth - 20);
    
    let top = badgeRect.bottom + 8;
    let left = badgeRect.left + (badgeRect.width / 2) - (tooltipWidth / 2);
    
    // Keep tooltip within viewport
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10;
    }
    
    // If tooltip goes below viewport, show above
    if (top + 200 > window.innerHeight) {
      top = badgeRect.top - 8;
      tooltip.style.bottom = 'auto';
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
    tooltip.style.maxWidth = tooltipWidth + 'px';
    tooltip.classList.add('visible');
    state.tooltipVisible = true;
  }

  // ===== CLOSE ALL TOOLTIPS =====
  function closeAllTooltips() {
    document.querySelectorAll('.ref-tooltip').forEach(el => {
      el.classList.remove('visible');
      setTimeout(() => el.remove(), 200);
    });
    state.tooltipVisible = false;
  }

  // ===== ADD REFERENCE BADGES TO DOM =====
  function addReferenceBadges() {
    if (!refRegistry) return;
    
    // Find all elements with data-ref attribute
    document.querySelectorAll('[data-ref]').forEach(el => {
      const refId = el.dataset.ref;
      const refData = getRef(refId);
      if (!refData) return;
      
      const badge = createRefBadge(refData);
      el.appendChild(badge);
    });
  }

  // ===== INJECT PDF VIEWER MODAL =====
  function injectPdfViewer() {
    // Check if already exists
    if (document.getElementById('pdf-modal-overlay')) return;
    
    const modal = document.createElement('div');
    modal.id = 'pdf-modal-overlay';
    modal.className = 'pdf-modal-overlay';
    modal.innerHTML = `
      <div class="pdf-modal-box">
        <div class="pdf-modal-header">
          <span class="pdf-modal-title" id="pdf-modal-title">Visor de Plan de Gobierno</span>
          <div class="pdf-modal-controls" id="pdf-controls" style="display:none;">
            <button id="pdf-prev-page" title="Página anterior">◀</button>
            <input type="number" class="pdf-page-input" id="pdf-current-page" value="1" min="1" aria-label="Ir a página">
            <span style="font-size:0.75rem;color:#888;">de <span id="pdf-total-pages">—</span></button>
            <button id="pdf-next-page" title="Página siguiente">▶</button>
            <button class="pdf-close-btn" id="pdf-close-btn" title="Cerrar visor" aria-label="Cerrar">✕</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;" id="pdf-controls-simple">
            <button class="pdf-close-btn" id="pdf-close-btn-simple" title="Cerrar" aria-label="Cerrar">✕</button>
          </div>
        </div>
        <div class="pdf-modal-body" id="pdf-body">
          <!-- Loader -->
          <div class="pdf-loader" id="pdf-loader">
            <div class="spinner"></div>
            <p>Cargando plan de gobierno...</p>
          </div>
          
          <!-- Error -->
          <div class="pdf-error" id="pdf-error" style="display:none;"></div>
          
          <!-- PDF canvas -->
          <canvas id="pdf-canvas"></canvas>
          
          <!-- Unavailable state -->
          <div class="pdf-unavailable" id="pdf-unavailable" style="display:none;">
            <span class="big-icon">📄</span>
            <h3>Plan de Gobierno no disponible en el visor</h3>
            <p>El PDF del plan de gobierno aún no ha sido agregado al repositorio. La referencia de ubicación exacta está disponible abajo.</p>
            <div class="ref-meta" id="pdf-unavailable-meta"></div>
            <button class="btn-read btn-cep" style="margin-top:10px;" onclick="window.open(this.dataset.url, '_blank')" data-url="">🔗 Ver fuente externa →</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Bind events
    document.getElementById('pdf-close-btn').addEventListener('click', closePdfViewer);
    document.getElementById('pdf-close-btn-simple').addEventListener('click', closePdfViewer);
    
    document.getElementById('pdf-prev-page')?.addEventListener('click', () => {
      goToPage(currentPageNum - 1);
    });
    
    document.getElementById('pdf-next-page')?.addEventListener('click', () => {
      goToPage(currentPageNum + 1);
    });
    
    document.getElementById('pdf-current-page')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = parseInt(e.target.value);
        if (!isNaN(val)) goToPage(val);
      }
    });
    
    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePdfViewer();
    });
    
    // Keyboard: Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && state.viewerOpen) {
        closePdfViewer();
      }
    });
    
    // Keyboard: arrow keys for navigation
    document.addEventListener('keydown', (e) => {
      if (!state.viewerOpen || !isPdfReady) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPage(currentPageNum - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToPage(currentPageNum + 1);
      }
    });
    
    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.viewerOpen && currentPdfDoc) {
          renderPdfPage(currentPageNum);
        }
      }, 300);
    });
  }

  // ===== GLOBAL CLICK TO CLOSE TOOLTIPS =====
  document.addEventListener('click', (e) => {
    if (state.tooltipVisible && !e.target.closest('.ref-badge') && !e.target.closest('.ref-tooltip')) {
      closeAllTooltips();
    }
  });

  // ===== INIT =====
  async function init() {
    const loaded = await loadRegistry();
    if (!loaded) {
      console.warn('[Refs] No reference registry available. References will not be displayed.');
      return;
    }
    
    injectPdfViewer();
    addReferenceBadges();
    
    console.log('[Refs] System initialized successfully');
  }

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging and inline use
  window.__RefsSystem = {
    getRef,
    getCandidateRefs,
    openPdfViewer,
    closePdfViewer,
    goToPage,
    state,
    registry: () => refRegistry,
  };

})();
