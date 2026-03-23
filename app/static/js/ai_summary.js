/**
 * ai_summary.js — Async AI Summary loader for Whoogle Search
 * Redesigned for the "AI Overview" UI.
 */

(function () {
  'use strict';

  // Source badge labels
  const SOURCE_LABELS = {
    ollama: '🏠 Local · Llama 3',
    gemini: '☁️ Cloud · Gemini',
    cache:  '⚡ Cached',
    error:  '⚠️ Unavailable',
  };

  // ── Shimmer / Skeleton Loader ─────────────────────────────────────────────── //
  const SHIMMER = `
    <div class="ai-shimmer-wrapper" style="padding: 10px 0;">
      <div class="ai-shimmer-line" style="height: 14px; width: 95%; margin-bottom: 12px; border-radius: 4px; background: linear-gradient(90deg, #f0f2f5 25%, #e6e8eb 50%, #f0f2f5 75%); background-size: 200% 100%; animation: ai-shimmer 1.5s infinite linear;"></div>
      <div class="ai-shimmer-line" style="height: 14px; width: 85%; margin-bottom: 12px; border-radius: 4px; background: linear-gradient(90deg, #f0f2f5 25%, #e6e8eb 50%, #f0f2f5 75%); background-size: 200% 100%; animation: ai-shimmer 1.5s infinite linear;"></div>
      <div class="ai-shimmer-line" style="height: 14px; width: 60%; margin-bottom: 12px; border-radius: 4px; background: linear-gradient(90deg, #f0f2f5 25%, #e6e8eb 50%, #f0f2f5 75%); background-size: 200% 100%; animation: ai-shimmer 1.5s infinite linear;"></div>
      <div class="ai-shimmer-line" style="height: 14px; width: 75%; border-radius: 4px; background: linear-gradient(90deg, #f0f2f5 25%, #e6e8eb 50%, #f0f2f5 75%); background-size: 200% 100%; animation: ai-shimmer 1.5s infinite linear;"></div>
    </div>`;

  // ── Add keyframe animation once ─────────────────────────────────────────── //
  if (!document.getElementById('ai-shimmer-style')) {
    const style = document.createElement('style');
    style.id = 'ai-shimmer-style';
    style.textContent = `
      @keyframes ai-shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      .ai-summary-expanded::after {
        opacity: 0 !important;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Render markdown-lite: **bold**, bullet lines ─────────────────────────  //
  function renderText(text) {
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g,     '<em>$1</em>');

    const lines = html.split('\n');
    let output = '';
    let inList = false;
    let isFirstParagraph = true;

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) {
        if (inList) { output += '</ul>'; inList = false; }
        continue;
      }
      if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
        if (!inList) { output += '<ul style="margin:8px 0 8px 18px;padding:0;list-style-type:disc;color:#202124;">'; inList = true; }
        output += `<li style="margin-bottom:6px;">${line.replace(/^[-•*]\s*/, '')}</li>`;
      } else {
        if (inList) { output += '</ul>'; inList = false; }
        // Make the first sentence slightly larger as a main takeaway quote
        if (isFirstParagraph) {
          output += `<p style="margin:0 0 12px 0; font-size:15px; color:#202124;">${line}</p>`;
          isFirstParagraph = false;
        } else {
          output += `<p style="margin:0 0 8px 0; color:#3c4043;">${line}</p>`;
        }
      }
    }
    if (inList) output += '</ul>';
    return output;
  }

  // ── Expand/Collapse logic ────────────────────────────────────────────────  //
  function checkExpandable(bodyWrapper, expandBtn) {
    const bodyEl = document.getElementById('ai-summary-body');
    // If content is tall, show expand button
    if (bodyEl.scrollHeight > 140) {
      bodyWrapper.style.maxHeight = '140px';
      
      // Add gradient mask if not expanded
      if (!bodyWrapper.querySelector('.ai-fade')) {
        const fade = document.createElement('div');
        fade.className = 'ai-fade';
        fade.style.position = 'absolute';
        fade.style.bottom = '0';
        fade.style.left = '0';
        fade.style.width = '100%';
        fade.style.height = '40px';
        fade.style.background = 'linear-gradient(transparent, rgba(255,255,255,0.9))';
        fade.style.pointerEvents = 'none';
        fade.style.transition = 'opacity 0.3s';
        bodyWrapper.appendChild(fade);
      } else {
        bodyWrapper.querySelector('.ai-fade').style.opacity = '1';
      }
      
      expandBtn.style.display = 'inline-flex';
      expandBtn.innerHTML = 'Show more <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    } else {
      bodyWrapper.style.maxHeight = 'none';
      expandBtn.style.display = 'none';
      const fade = bodyWrapper.querySelector('.ai-fade');
      if (fade) fade.style.opacity = '0';
    }
  }

  // ── Core fetch function ──────────────────────────────────────────────────  //
  function fetchSummary(query, encodedResults, bodyEl, footerEl, refreshBtn, bodyWrapper, expandBtn) {
    bodyEl.innerHTML = SHIMMER;
    bodyWrapper.style.maxHeight = 'none';
    if (bodyWrapper.querySelector('.ai-fade')) bodyWrapper.querySelector('.ai-fade').style.opacity = '0';
    expandBtn.style.display = 'none';
    if (refreshBtn) refreshBtn.style.display = 'none';

    const url = `/ai_summary?q=${encodeURIComponent(query)}&results=${encodedResults}`;

    fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        const summary = data.summary || 'No summary available.';
        const source  = data.source  || 'error';
        const label   = SOURCE_LABELS[source] || source;

        // Animate content appearance subtly
        bodyEl.style.opacity = '0';
        bodyEl.innerHTML = renderText(summary);
        
        // Let browser render before measuring height
        setTimeout(() => {
          bodyEl.style.transition = 'opacity 0.4s ease-in';
          bodyEl.style.opacity = '1';
          checkExpandable(bodyWrapper, expandBtn);
        }, 50);

        footerEl.innerHTML = `<span style="font-weight:500;">${label}</span>`;

        if (refreshBtn) {
            refreshBtn.style.display = 'flex';
            refreshBtn.style.opacity = '1';
        }
      })
      .catch(function (err) {
        bodyEl.innerHTML = `<span style="color:#e05252;">⚠️ Could not load summary — ${err.message}</span>`;
        footerEl.innerHTML = SOURCE_LABELS.error;
        if (refreshBtn) refreshBtn.style.display = 'flex';
      });
  }

  // ── Init ─────────────────────────────────────────────────────────────────  //
  document.addEventListener('DOMContentLoaded', function () {
    const card = document.getElementById('ai-summary-card');
    if (!card) return;

    const query          = card.dataset.query || '';
    const encodedResults = card.dataset.results || encodeURIComponent('[]');
    const bodyEl         = document.getElementById('ai-summary-body');
    const footerEl       = document.getElementById('ai-summary-footer');
    const generateBtn    = document.getElementById('ai-generate-btn');
    const bodyWrapper    = document.getElementById('ai-summary-body-wrapper');
    const expandBtn      = document.getElementById('ai-expand-btn');

    if (!query || !bodyEl || !footerEl) return;

    // Expand button logic
    if (expandBtn && bodyWrapper) {
      expandBtn.addEventListener('click', function () {
        const isExpanded = bodyWrapper.classList.contains('ai-summary-expanded');
        if (isExpanded) {
          // Collapse
          bodyWrapper.classList.remove('ai-summary-expanded');
          bodyWrapper.style.maxHeight = '140px';
          if (bodyWrapper.querySelector('.ai-fade')) bodyWrapper.querySelector('.ai-fade').style.opacity = '1';
          expandBtn.innerHTML = 'Show more <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><polyline points="6 9 12 15 18 9"></polyline></svg>';
        } else {
          // Expand
          bodyWrapper.classList.add('ai-summary-expanded');
          bodyWrapper.style.maxHeight = bodyEl.scrollHeight + 40 + 'px'; // Expand to full scroll height
          if (bodyWrapper.querySelector('.ai-fade')) bodyWrapper.querySelector('.ai-fade').style.opacity = '0';
          expandBtn.innerHTML = 'Show less <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><polyline points="18 15 12 9 6 15"></polyline></svg>';
        }
      });
    }

    // Generate button click
    if (generateBtn) {
      generateBtn.addEventListener('click', function () {
        generateBtn.style.display = 'none';
        document.getElementById('ai-summary-content').style.display = 'block';
        fetchSummary(query, encodedResults, bodyEl, footerEl, refreshBtn, bodyWrapper, expandBtn);
      });
    }

    // Refresh button click
    const refreshBtn = document.getElementById('ai-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        // Force bypass cache via timestamp param
        const url = `/ai_summary?q=${encodeURIComponent(query)}&results=${encodedResults}&refresh=1`;
        bodyEl.innerHTML = SHIMMER;
        bodyWrapper.style.maxHeight = 'none';
        if (bodyWrapper.querySelector('.ai-fade')) bodyWrapper.querySelector('.ai-fade').style.opacity = '0';
        expandBtn.style.display = 'none';
        refreshBtn.style.display = 'none';
        
        fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } })
          .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
          .then(function (data) {
            const summary = data.summary || 'No summary available.';
            const source  = data.source  || 'error';
            bodyEl.style.opacity = '0';
            bodyEl.innerHTML = renderText(summary);
            
            setTimeout(() => {
              bodyEl.style.transition = 'opacity 0.4s ease-in';
              bodyEl.style.opacity = '1';
              checkExpandable(bodyWrapper, expandBtn);
            }, 50);

            footerEl.innerHTML = `<span style="font-weight:500;">${SOURCE_LABELS[source] || source}</span>`;
            refreshBtn.style.display = 'flex';
          })
          .catch(function (err) {
            bodyEl.innerHTML = `<span style="color:#e05252;">⚠️ ${err.message}</span>`;
            refreshBtn.style.display = 'flex';
          });
      });
    }
  });
})();
