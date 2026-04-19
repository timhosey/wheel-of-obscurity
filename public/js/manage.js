(function () {
  const form = document.getElementById('game-form');
  const formTitle = document.getElementById('form-title');
  const formError = document.getElementById('form-error');
  const gameId = document.getElementById('game-id');
  const gameName = document.getElementById('game-name');
  const gamePlatform = document.getElementById('game-platform');
  const submitBtn = document.getElementById('submit-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const tbody = document.getElementById('games-tbody');
  const emptyMessage = document.getElementById('empty-message');
  const spinBtn = document.getElementById('spin-btn');
  const spinFeedback = document.getElementById('spin-feedback');
  const resetUnplayedBtn = document.getElementById('reset-unplayed-btn');
  const resetPlayedBtn = document.getElementById('reset-played-btn');
  const resetFeedback = document.getElementById('reset-feedback');
  const filterPlayed = document.getElementById('filter-played');
  const filterPlatform = document.getElementById('filter-platform');
  const filterSearch = document.getElementById('filter-search');

  let gamesList = [];
  let sortBy = 'name';
  let sortDir = 'asc';

  function clearFormError() {
    if (formError) {
      formError.textContent = '';
      formError.classList.add('hidden');
    }
  }

  const api = (path, options = {}) => {
    const base = '';
    return fetch(`${base}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    }).then((r) => {
      if (r.status === 204) return null;
      const j = r.json().catch(() => ({}));
      if (!r.ok) return j.then((d) => Promise.reject(new Error(d.error || r.statusText)));
      return j;
    });
  };

  function formatPlayed(selectedAt) {
    if (!selectedAt) return '—';
    const d = new Date(selectedAt);
    return isNaN(d.getTime()) ? selectedAt : d.toLocaleDateString(undefined, { dateStyle: 'short' });
  }

  function loadPlatforms() {
    return api('/api/platforms')
      .then((platforms) => {
        if (!filterPlatform) return;
        const current = filterPlatform.value;
        filterPlatform.innerHTML = '<option value="">All</option>' + platforms.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
        if (platforms.includes(current)) filterPlatform.value = current;
      })
      .catch(() => {});
  }

  function compareGames(a, b) {
    let va = a[sortBy];
    let vb = b[sortBy];
    if (sortBy === 'played') {
      va = a.selected_at || '';
      vb = b.selected_at || '';
    } else if (sortBy === 'name' || sortBy === 'platform') {
      va = (va || '').toLowerCase();
      vb = (vb || '').toLowerCase();
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  }

  function renderGames() {
    tbody.innerHTML = '';
    document.querySelectorAll('.row-highlight').forEach((el) => el.classList.remove('row-highlight'));
    const searchRaw = filterSearch ? filterSearch.value.trim() : '';
    const searchLower = searchRaw.toLowerCase();
    const toShow = searchLower
      ? gamesList.filter(
          (g) =>
            (g.name || '').toLowerCase().includes(searchLower) ||
            (g.platform || '').toLowerCase().includes(searchLower)
        )
      : gamesList;
    const sorted = [...toShow].sort(compareGames);
    if (sorted.length === 0) {
      emptyMessage.classList.remove('hidden');
      return;
    }
    emptyMessage.classList.add('hidden');
    sorted.forEach((g) => {
      const tr = document.createElement('tr');
      tr.dataset.id = String(g.id);
      tr.innerHTML = `
        <td>${escapeHtml(g.name)}</td>
        <td>${escapeHtml(g.platform)}</td>
        <td class="played-cell">${escapeHtml(formatPlayed(g.selected_at))}</td>
        <td class="actions-cell">
          <button type="button" data-action="edit" data-id="${g.id}">Edit</button>
          ${g.selected_at ? `<button type="button" data-action="unplay" data-id="${g.id}">Mark unplayed</button>` : ''}
          <button type="button" data-action="delete" data-id="${g.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('[data-action=edit]').forEach((btn) => {
      btn.addEventListener('click', () => editGame(Number(btn.dataset.id)));
    });
    tbody.querySelectorAll('[data-action=unplay]').forEach((btn) => {
      btn.addEventListener('click', () => unplayGame(Number(btn.dataset.id)));
    });
    tbody.querySelectorAll('[data-action=delete]').forEach((btn) => {
      btn.addEventListener('click', () => deleteGame(Number(btn.dataset.id)));
    });
  }

  function loadGames() {
    const played = filterPlayed ? filterPlayed.value : '';
    const platform = filterPlatform ? filterPlatform.value : '';
    const params = new URLSearchParams();
    if (played) params.set('played', played);
    if (platform) params.set('platform', platform);
    const path = params.toString() ? `/api/games?${params}` : '/api/games';
    api(path)
      .then((list) => {
        gamesList = list;
        renderGames();
      })
      .catch((err) => {
        emptyMessage.textContent = 'Failed to load games: ' + err.message;
        emptyMessage.classList.remove('hidden');
      });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  const PLATFORMS = ['PS', 'PS2', 'N64', 'SNES', 'PC', 'DOS'];

  function setFormMode(mode, game = null) {
    clearFormError();
    if (mode === 'edit' && game) {
      formTitle.textContent = 'Edit game';
      gameId.value = game.id;
      gameName.value = game.name;
      if (game.platform && !PLATFORMS.includes(game.platform)) {
        const opt = document.createElement('option');
        opt.value = game.platform;
        opt.textContent = game.platform;
        gamePlatform.appendChild(opt);
      }
      gamePlatform.value = game.platform;
      submitBtn.textContent = 'Save';
      cancelBtn.hidden = false;
    } else {
      formTitle.textContent = 'Add game';
      gameId.value = '';
      gameName.value = '';
      gamePlatform.innerHTML =
        '<option value="">Select platform</option>' +
        PLATFORMS.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
      gamePlatform.value = '';
      submitBtn.textContent = 'Add';
      cancelBtn.hidden = true;
    }
  }

  function editGame(id) {
    api(`/api/games/${id}`)
      .then((game) => setFormMode('edit', game))
      .catch((err) => alert(err.message));
  }

  function deleteGame(id) {
    if (!confirm('Delete this game?')) return;
    api(`/api/games/${id}`, { method: 'DELETE' })
      .then(() => {
        loadPlatforms();
        loadGames();
      })
      .catch((err) => alert(err.message));
  }

  function unplayGame(id) {
    api(`/api/games/${id}/unplay`, { method: 'PUT' })
      .then(() => loadGames())
      .catch((err) => alert(err.message));
  }

  function resetWheel(filter) {
    resetFeedback.textContent = '';
    resetFeedback.classList.remove('error', 'success');
    api('/api/wheel/reset', { method: 'POST', body: JSON.stringify({ filter }) })
      .then(() => {
        resetFeedback.textContent = `Wheel reset with ${filter} games.`;
        resetFeedback.classList.add('success');
      })
      .catch((err) => {
        resetFeedback.textContent = err.message;
        resetFeedback.classList.add('error');
      });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearFormError();
    document.querySelectorAll('#games-tbody tr.row-highlight').forEach((tr) => tr.classList.remove('row-highlight'));
    const id = gameId.value ? Number(gameId.value) : null;
    const name = gameName.value.trim();
    const platform = gamePlatform.value;
    if (!name || !platform) return;
    const body = JSON.stringify({ name, platform });
    if (id) {
      api(`/api/games/${id}`, { method: 'PUT', body })
        .then(() => {
          setFormMode('add');
          loadPlatforms();
          loadGames();
        })
        .catch((err) => alert(err.message));
    } else {
      api('/api/games')
        .then((all) => {
          const dupe = all.find((g) => g.name.toLowerCase() === name.toLowerCase() && g.platform === platform);
          if (dupe) {
            formError.textContent = 'This game and platform combination already exists.';
            formError.classList.remove('hidden');
            const row = tbody.querySelector(`tr[data-id="${dupe.id}"]`);
            if (row) row.classList.add('row-highlight');
            return;
          }
          return api('/api/games', { method: 'POST', body });
        })
        .then((result) => {
          if (!result) return;
          gameId.value = '';
          gameName.value = '';
          gameName.focus();
          loadPlatforms();
          loadGames();
        })
        .catch((err) => alert(err.message));
    }
  });

  cancelBtn.addEventListener('click', () => setFormMode('add'));

  if (filterPlayed) filterPlayed.addEventListener('change', () => loadGames());
  if (filterPlatform) filterPlatform.addEventListener('change', () => loadGames());
  if (filterSearch) filterSearch.addEventListener('input', () => renderGames());

  function updateSortIndicator() {
    document.querySelectorAll('.sortable').forEach((h) => {
      h.removeAttribute('aria-sort');
      if (h.dataset.sort === sortBy) h.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
    });
  }

  document.querySelectorAll('.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (!key) return;
      if (sortBy === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      else sortBy = key;
      updateSortIndicator();
      renderGames();
    });
  });

  loadPlatforms().then(() => {
    loadGames();
  });

  (function initSortIndicator() {
    updateSortIndicator();
  })();

  spinBtn.addEventListener('click', () => {
    spinFeedback.textContent = '';
    spinFeedback.classList.remove('error', 'success');
    api('/api/spin', { method: 'POST' })
      .then((data) => {
        spinFeedback.textContent = `Landed on: ${data.game.name} (${data.game.platform})`;
        spinFeedback.classList.add('success');
        loadGames();
      })
      .catch((err) => {
        spinFeedback.textContent = err.message;
        spinFeedback.classList.add('error');
      });
  });

  resetUnplayedBtn.addEventListener('click', () => resetWheel('unplayed'));
  resetPlayedBtn.addEventListener('click', () => resetWheel('played'));
})();
