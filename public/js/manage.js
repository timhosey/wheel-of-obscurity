(function () {
  const form = document.getElementById('game-form');
  const formTitle = document.getElementById('form-title');
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

  function loadGames() {
    const played = filterPlayed ? filterPlayed.value : '';
    const path = played ? `/api/games?played=${played}` : '/api/games';
    api(path)
      .then((list) => {
        tbody.innerHTML = '';
        if (list.length === 0) {
          emptyMessage.classList.remove('hidden');
          return;
        }
        emptyMessage.classList.add('hidden');
        list.forEach((g) => {
          const tr = document.createElement('tr');
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

  function setFormMode(mode, game = null) {
    if (mode === 'edit' && game) {
      formTitle.textContent = 'Edit game';
      gameId.value = game.id;
      gameName.value = game.name;
      gamePlatform.value = game.platform;
      submitBtn.textContent = 'Save';
      cancelBtn.hidden = false;
    } else {
      formTitle.textContent = 'Add game';
      gameId.value = '';
      gameName.value = '';
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
      .then(() => loadGames())
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
    const id = gameId.value ? Number(gameId.value) : null;
    const name = gameName.value.trim();
    const platform = gamePlatform.value.trim();
    if (!name || !platform) return;
    const body = JSON.stringify({ name, platform });
    if (id) {
      api(`/api/games/${id}`, { method: 'PUT', body })
        .then(() => {
          setFormMode('add');
          loadGames();
        })
        .catch((err) => alert(err.message));
    } else {
      api('/api/games', { method: 'POST', body })
        .then(() => {
          form.reset();
          gameId.value = '';
          loadGames();
        })
        .catch((err) => alert(err.message));
    }
  });

  cancelBtn.addEventListener('click', () => setFormMode('add'));

  if (filterPlayed) {
    filterPlayed.addEventListener('change', () => loadGames());
  }

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

  loadGames();
})();
