(() => {
  'use strict';

  const body = document.body;
  const page = body.dataset.page;
  const menuToggle = document.getElementById('menuToggle');
  const navLinks = document.getElementById('navLinks');
  menuToggle?.addEventListener('click', () => navLinks?.classList.toggle('open'));
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
      const old = button.textContent;
      button.textContent = '✓ copied';
      setTimeout(() => { button.textContent = old; }, 1400);
    } catch {
      button.textContent = 'copy gagal';
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-copy]');
    if (button) copyText(button.dataset.copy, button);
  });

  async function loadCatalog() {
    const response = await fetch(body.dataset.commands || 'commands.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  function renderPreview(catalog) {
    const target = document.getElementById('commandPreview');
    if (!target) return;
    const preferred = ['tcash', 'thunt', 'tbattle', 'tpet', 'tmarket', 'tboss'];
    const commands = catalog.categories.flatMap((category) => category.commands);
    const selected = preferred.map((name) => commands.find((command) => command.name === name)).filter(Boolean);
    target.innerHTML = selected.map((command) => `
      <a class="cmd-card" href="help/#${esc(command.name.slice(1))}">
        <div class="cmd-name">${esc(command.name)}</div>
        <p>${esc(command.summary)}</p>
      </a>`).join('');
  }

  function helpCard(command, category) {
    const id = command.name.slice(1);
    const subcommands = (command.subcommands || []).slice(0, 8);
    return `
      <article class="help-card" id="${esc(id)}">
        <div class="help-card-head">
          <div><h2>${esc(command.name)}</h2><div class="cat">${esc(category.emoji)} ${esc(category.label)}</div></div>
          <button class="copy-btn" data-copy="${esc(command.name)}">copy</button>
        </div>
        <p class="summary">${esc(command.summary)}</p>
        <code class="usage">${esc(command.usage)}</code>
        ${subcommands.length ? `<ul>${subcommands.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>` : ''}
        ${command.note ? `<p class="note">${esc(command.note)}</p>` : ''}
      </article>`;
  }

  function renderHelp(catalog) {
    const grid = document.getElementById('helpGrid');
    const chips = document.getElementById('categoryChips');
    const count = document.getElementById('helpCount');
    const search = document.getElementById('searchInput');
    if (!grid || !chips || !count || !search) return;

    const all = catalog.categories.flatMap((category) => category.commands.map((command) => ({ command, category })));
    let activeCategory = 'all';
    let query = new URLSearchParams(location.search).get('q') || '';
    search.value = query;

    function draw() {
      const term = query.trim().toLowerCase();
      const filtered = all.filter(({ command, category }) => {
        const matchesCategory = activeCategory === 'all' || category.id === activeCategory;
        const haystack = [command.name, command.summary, command.usage, ...(command.aliases || []), ...(command.subcommands || [])].join(' ').toLowerCase();
        return matchesCategory && (!term || haystack.includes(term));
      });
      count.textContent = `${filtered.length} command ditemukan${activeCategory === 'all' ? '' : ` di ${catalog.categories.find((c) => c.id === activeCategory)?.label}`}`;
      grid.innerHTML = filtered.length
        ? filtered.map(({ command, category }) => helpCard(command, category)).join('')
        : '<div class="empty">Tidak ada command yang cocok. Coba kata kunci lain atau pilih kategori lain.</div>';
    }

    chips.innerHTML = `<button class="chip active" data-category="all">Semua (${all.length})</button>` + catalog.categories.map((category) => `
      <button class="chip" data-category="${esc(category.id)}">${esc(category.emoji)} ${esc(category.label)} (${category.commands.length})</button>`).join('');

    chips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-category]');
      if (!chip) return;
      activeCategory = chip.dataset.category;
      chips.querySelectorAll('.chip').forEach((item) => item.classList.toggle('active', item === chip));
      draw();
    });

    let timer;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        query = search.value;
        const url = new URL(location.href);
        if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
        history.replaceState(null, '', url);
        draw();
      }, 120);
    });

    draw();
    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }

  loadCatalog().then((catalog) => {
    if (page === 'home') renderPreview(catalog);
    if (page === 'help') renderHelp(catalog);
  }).catch((error) => {
    const count = document.getElementById('helpCount');
    if (count) count.textContent = `Dokumentasi belum bisa dimuat (${error.message}). Jalankan npm run web:build.`;
    const target = document.getElementById('commandPreview');
    if (target && !target.children.length) target.innerHTML = '<div class="empty">Dokumentasi belum tersedia.</div>';
  });
})();
