/**
 * WEALTH RADAR // ID — CLIENT APP (!y: CONTEXT AI + CSV EXPORTER)
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const statusText = document.getElementById('statusText');
  const statusDot = document.getElementById('statusDot');

  const loggerForm = document.getElementById('loggerForm');
  const loggerInput = document.getElementById('loggerInput');
  const btnMic = document.getElementById('btnMic');
  const listeningIndicator = document.getElementById('listeningIndicator');
  const transcriptLive = document.getElementById('transcriptLive');

  const healthScoreEl = document.getElementById('healthScore');
  const healthBadgeEl = document.getElementById('healthBadge');
  const healthDescEl = document.getElementById('healthDesc');
  const gaugeProgress = document.getElementById('gaugeProgress');

  const netWorthDisplay = document.getElementById('netWorthDisplay');
  const totalIncomeDisplay = document.getElementById('totalIncomeDisplay');
  const totalExpenseDisplay = document.getElementById('totalExpenseDisplay');

  const needsBar = document.getElementById('needsBar');
  const needsPct = document.getElementById('needsPct');
  const needsSpent = document.getElementById('needsSpent');
  const needsLimit = document.getElementById('needsLimit');

  const wantsBar = document.getElementById('wantsBar');
  const wantsPct = document.getElementById('wantsPct');
  const wantsSpent = document.getElementById('wantsSpent');
  const wantsLimit = document.getElementById('wantsLimit');

  const savingsBar = document.getElementById('savingsBar');
  const savingsPct = document.getElementById('savingsPct');
  const savingsSpent = document.getElementById('savingsSpent');
  const savingsLimit = document.getElementById('savingsLimit');

  const walletListGrid = document.getElementById('walletListGrid');
  const btnEditWallets = document.getElementById('btnEditWallets');
  const walletModal = document.getElementById('walletModal');
  const closeWalletModal = document.getElementById('closeWalletModal');
  const addWalletForm = document.getElementById('addWalletForm');
  const newWalletInput = document.getElementById('newWalletInput');
  const activeWalletChips = document.getElementById('activeWalletChips');

  const transactionList = document.getElementById('transactionList');
  const emptyState = document.getElementById('emptyState');

  const btnWaQr = document.getElementById('btnWaQr');
  const btnWaShare = document.getElementById('btnWaShare');
  const btnWaSim = document.getElementById('btnWaSim');
  const btnSettings = document.getElementById('btnSettings');
  const btnManualAdd = document.getElementById('btnManualAdd');

  const waQrModal = document.getElementById('waQrModal');
  const closeWaQr = document.getElementById('closeWaQr');
  const qrCodeContainer = document.getElementById('qrCodeContainer');
  const qrStatusMsg = document.getElementById('qrStatusMsg');

  const waSimModal = document.getElementById('waSimModal');
  const closeWaSim = document.getElementById('closeWaSim');
  const waSimForm = document.getElementById('waSimForm');
  const waSimInput = document.getElementById('waSimInput');
  const waChatBody = document.getElementById('waChatBody');

  const settingsModal = document.getElementById('settingsModal');
  const closeSettings = document.getElementById('closeSettings');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnExportJson = document.getElementById('btnExportJson');

  const manualAddModal = document.getElementById('manualAddModal');
  const closeManualAdd = document.getElementById('closeManualAdd');
  const manualAddForm = document.getElementById('manualAddForm');
  const manualWalletSelect = document.getElementById('manualWallet');

  const searchInput = document.getElementById('searchInput');
  const categoryTabs = document.getElementById('categoryTabs');

  let currentCategoryFilter = 'ALL';
  let currentWalletFilter = 'ALL';
  let state = { transactions: [], summary: {}, settings: { wallets: ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'] } };

  const formatRp = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID');

  // ==========================================
  // 1. DATA CONNECTION (HTTP API → Supabase)
  // ==========================================
  async function fetchData() {
    try {
      statusText.textContent = 'LOADING...';
      const res = await window.fetch('/api/transactions');
      const data = await res.json();
      if (data.transactions) state.transactions = data.transactions;
      if (data.summary) state.summary = data.summary;
      if (data.settings) state.settings = data.settings;
      statusDot.style.backgroundColor = 'var(--accent-emerald)';
      statusText.textContent = 'SUPABASE CONNECTED';
      renderDashboard();
      console.log('📡 Data loaded from Supabase via API');
    } catch (e) {
      statusDot.style.backgroundColor = 'var(--accent-rose)';
      statusText.textContent = 'OFFLINE';
      console.warn('Fetch failed:', e);
    }
  }

  async function apiAddTransaction(payload) {
    try {
      const res = await window.fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.transactions) state.transactions = data.transactions;
      if (data.summary) state.summary = data.summary;
      renderDashboard();
      return data;
    } catch (e) {
      console.error('Add transaction failed:', e);
      alert('Gagal menambah transaksi: ' + e.message);
    }
  }

  async function apiDeleteTransaction(id) {
    try {
      const res = await window.fetch('/api/transactions?id=' + encodeURIComponent(id), {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.transactions) state.transactions = data.transactions;
      if (data.summary) state.summary = data.summary;
      renderDashboard();
      return data;
    } catch (e) {
      console.error('Delete transaction failed:', e);
      alert('Gagal menghapus transaksi: ' + e.message);
    }
  }

  // Load data on page load
  fetchData();

  function updateWaStatusUI(status) {
    if (status === 'CONNECTED') {
      statusDot.style.backgroundColor = 'var(--accent-emerald)';
      statusText.textContent = 'WA BOT CONNECTED';
      qrStatusMsg.textContent = '✅ WhatsApp Berhasil Terkoneksi!';
      qrStatusMsg.style.color = 'var(--accent-emerald)';
    } else if (status === 'SCAN_QR_REQUIRED') {
      statusDot.style.backgroundColor = 'var(--accent-amber)';
      statusText.textContent = 'SCAN WA QR';
    } else {
      statusDot.style.backgroundColor = 'var(--accent-rose)';
      statusText.textContent = 'WA DISCONNECTED';
    }
    feather.replace();
  }

  function updateQrCodeUI(qrText) {
    qrCodeContainer.innerHTML = '';
    if (qrText) {
      try {
        if (window.QRCode) {
          new QRCode(qrCodeContainer, {
            text: qrText,
            width: 200,
            height: 200,
            colorDark: '#000000',
            colorLight: '#ffffff'
          });
        } else {
          qrCodeContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrText)}" width="200" height="200" style="border-radius:12px; border:2px solid var(--accent-cyan);" />`;
        }
      } catch (e) {
        qrCodeContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrText)}" width="200" height="200" style="border-radius:12px; border:2px solid var(--accent-cyan);" />`;
      }
      qrStatusMsg.textContent = 'Scan QR Code di atas menggunakan WhatsApp di HP kamu!';
      qrStatusMsg.style.color = 'var(--accent-amber)';
    }
  }

  async function fetchWaQr() {
    try {
      const res = await window.fetch('/api/wa-qr');
      const data = await res.json();
      if (data.status) updateWaStatusUI(data.status);
      if (data.qr) {
        updateQrCodeUI(data.qr);
      } else if (data.status === 'CONNECTED') {
        qrStatusMsg.textContent = '✅ WhatsApp Berhasil Terkoneksi!';
        qrStatusMsg.style.color = 'var(--accent-emerald)';
      }
    } catch (e) {}
  }

  // Realtime WebSocket for WA QR & Status on Localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = window.location.host || 'localhost:3000';
      const socket = new WebSocket(`${wsProtocol}//${wsHost}`);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const payload = data.payload || {};
          if (data.event === 'WA_STATUS' || data.event === 'INIT_STATE') {
            if (payload.waStatus) updateWaStatusUI(payload.waStatus);
            if (payload.status) updateWaStatusUI(payload.status);
            if (payload.qrCode) updateQrCodeUI(payload.qrCode);
            if (payload.qr) updateQrCodeUI(payload.qr);
          }
        } catch (e) {}
      };
    } catch (e) {}
  }

  // ==========================================
  // 2. DASHBOARD RENDERER & DYNAMIC WALLETS
  // ==========================================
  function renderDashboard() {
    const summary = state.summary || {};
    const wallets = (state.settings && state.settings.wallets) || ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'];

    healthScoreEl.textContent = summary.score || 85;
    healthBadgeEl.textContent = summary.healthBadge || 'EXCELLENT';

    const score = summary.score || 85;
    const offset = 440 - (440 * score) / 100;
    gaugeProgress.style.strokeDashoffset = offset;

    if (score < 50) {
      gaugeProgress.style.stroke = 'var(--accent-rose)';
      healthBadgeEl.style.background = 'rgba(244, 63, 94, 0.2)';
      healthBadgeEl.style.color = 'var(--accent-rose)';
    } else if (score < 75) {
      gaugeProgress.style.stroke = 'var(--accent-amber)';
      healthBadgeEl.style.background = 'rgba(245, 158, 11, 0.2)';
      healthBadgeEl.style.color = 'var(--accent-amber)';
    } else {
      gaugeProgress.style.stroke = 'var(--accent-emerald)';
      healthBadgeEl.style.background = 'rgba(16, 185, 129, 0.2)';
      healthBadgeEl.style.color = 'var(--accent-emerald)';
    }

    netWorthDisplay.textContent = Number(summary.netWorth || 0).toLocaleString('id-ID');
    totalIncomeDisplay.textContent = formatRp(summary.totalIncome);
    totalExpenseDisplay.textContent = formatRp(summary.totalExpense);

    needsPct.textContent = (summary.needsPct || 0) + '%';
    needsBar.style.width = Math.min(100, summary.needsPct || 0) + '%';
    needsSpent.textContent = `${formatRp(summary.needsSpent)} spent`;
    needsLimit.textContent = `Target: ${formatRp(summary.needsLimit)}`;

    wantsPct.textContent = (summary.wantsPct || 0) + '%';
    wantsBar.style.width = Math.min(100, summary.wantsPct || 0) + '%';
    wantsSpent.textContent = `${formatRp(summary.wantsSpent)} spent`;
    wantsLimit.textContent = `Target: ${formatRp(summary.wantsLimit)}`;

    savingsPct.textContent = (summary.savingsPct || 0) + '%';
    savingsBar.style.width = Math.min(100, summary.savingsPct || 0) + '%';
    savingsSpent.textContent = `${formatRp(summary.savingsSpent)} saved`;
    savingsLimit.textContent = `Target: ${formatRp(summary.savingsLimit)}`;

    // Render Dynamic Wallet Chips in Card 04
    walletListGrid.innerHTML = '';
    const wb = summary.walletBalances || {};

    wallets.forEach(w => {
      const chip = document.createElement('div');
      chip.className = 'wallet-chip';
      chip.innerHTML = `<span class="w-name">${w}</span><span class="w-val">${formatRp(wb[w] || 0)}</span>`;
      walletListGrid.appendChild(chip);
    });

    // Populate Manual Add Wallet Select
    manualWalletSelect.innerHTML = '';
    wallets.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w;
      opt.textContent = w;
      manualWalletSelect.appendChild(opt);
    });

    renderWalletEditorChips(wallets);
    renderTransactionFeed();
  }

  function renderWalletEditorChips(wallets) {
    activeWalletChips.innerHTML = '';
    wallets.forEach(w => {
      const chip = document.createElement('div');
      chip.style.cssText = 'background: rgba(6, 182, 212, 0.15); border: 1px solid var(--accent-cyan); padding: 4px 10px; border-radius: 16px; display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--accent-cyan);';
      chip.innerHTML = `<span>${w}</span><button type="button" class="btn-del-wallet" data-wallet="${w}" style="background: none; border: none; color: var(--accent-rose); cursor: pointer; font-size: 14px; font-weight: 900;">&times;</button>`;
      
      chip.querySelector('.btn-del-wallet').addEventListener('click', () => {
        const updated = wallets.filter(item => item !== w);
        state.settings.wallets = updated;
        renderDashboard();
      });

      activeWalletChips.appendChild(chip);
    });
  }

  function renderTransactionFeed() {
    const searchVal = searchInput.value.toLowerCase().trim();
    let filtered = (state.transactions || []).filter(t => {
      const matchCat = currentCategoryFilter === 'ALL' || t.category === currentCategoryFilter;
      const matchWallet = currentWalletFilter === 'ALL' || (t.wallet || 'CASH').toUpperCase() === currentWalletFilter;
      const matchSearch = !searchVal || t.title.toLowerCase().includes(searchVal) || (t.wallet || '').toLowerCase().includes(searchVal);
      return matchCat && matchWallet && matchSearch;
    });

    transactionList.innerHTML = '';

    if (filtered.length === 0) {
      transactionList.appendChild(emptyState);
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';

    const walletStyles = {
      BCA: { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.4)' },
      MANDIRI: { bg: 'rgba(234, 179, 8, 0.15)', color: '#facc15', border: 'rgba(234, 179, 8, 0.4)' },
      GOPAY: { bg: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee', border: 'rgba(6, 182, 212, 0.4)' },
      OVO: { bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: 'rgba(168, 85, 247, 0.4)' },
      SHOPEEPAY: { bg: 'rgba(249, 115, 22, 0.15)', color: '#fb923c', border: 'rgba(249, 115, 22, 0.4)' },
      DANA: { bg: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: 'rgba(2, 132, 199, 0.4)' },
      CASH: { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'rgba(16, 185, 129, 0.4)' }
    };

    filtered.forEach(tx => {
      const item = document.createElement('div');
      item.className = 'tx-item';
      const isIncome = tx.type === 'INCOME';
      const iconName = isIncome ? 'arrow-down-left' : 'arrow-up-right';
      const dateFormatted = new Date(tx.date).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });

      const wName = (tx.wallet || 'CASH').toUpperCase();
      const ws = walletStyles[wName] || { bg: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1', border: 'rgba(148, 163, 184, 0.4)' };

      item.innerHTML = `
        <div class="tx-left">
          <div class="tx-icon ${tx.type}">
            <i data-feather="${iconName}"></i>
          </div>
          <div class="tx-info">
            <span class="tx-title">${tx.title}</span>
            <div class="tx-meta">
              <span>${dateFormatted}</span>
              <span class="cat-badge">${tx.category}</span>
              <span class="cat-badge" style="background: ${ws.bg}; color: ${ws.color}; border: 1px solid ${ws.border}; font-weight: 800;">${wName}</span>
            </div>
          </div>
        </div>
        <div class="tx-right">
          <span class="tx-amount ${tx.type}">${isIncome ? '+' : '-'}${formatRp(tx.amount)}</span>
          <button class="btn-del-tx" data-id="${tx.id}" title="Hapus Transaksi">
            <i data-feather="trash-2"></i>
          </button>
        </div>
      `;

      item.querySelector('.btn-del-tx').addEventListener('click', () => {
        apiDeleteTransaction(tx.id);
      });

      transactionList.appendChild(item);
    });

    feather.replace();
  }

  // Export CSV Functionality
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      const txs = state.transactions || [];
      if (txs.length === 0) return alert('Belum ada transaksi untuk di-export.');

      let csv = 'ID,Tanggal,Judul Transaksi,Nominal (IDR),Tipe,Kategori,Dompet/Bank\n';
      txs.forEach(t => {
        const dateStr = new Date(t.date).toLocaleString('id-ID');
        const titleClean = `"${(t.title || '').replace(/"/g, '""')}"`;
        csv += `${t.id},"${dateStr}",${titleClean},${t.amount},${t.type},${t.category},${t.wallet || 'CASH'}\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `wealth_radar_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `wealth_radar_backup_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });
  }

  // Edit Wallets Handlers
  btnEditWallets.addEventListener('click', () => walletModal.showModal());
  closeWalletModal.addEventListener('click', () => walletModal.close());

  addWalletForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = newWalletInput.value.trim().toUpperCase();
    if (!val) return;

    const currentWallets = (state.settings && state.settings.wallets) || ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'];
    if (!currentWallets.includes(val)) {
      currentWallets.push(val);
      state.settings.wallets = currentWallets;
      renderDashboard();
    }

    newWalletInput.value = '';
  });

  // Voice Speech Recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let isRecording = false;
  let recognition = null;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      isRecording = true;
      btnMic.classList.add('recording');
      listeningIndicator.classList.remove('hidden');
      transcriptLive.textContent = 'Mendengarkan suara kamu... Bicara sekarang!';
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      transcriptLive.textContent = transcript;
      if (event.results[0].isFinal) {
        loggerInput.value = transcript;
        apiAddTransaction({ rawText: '!y: ' + transcript });
        loggerInput.value = '';
      }
    };

    recognition.onend = () => {
      isRecording = false;
      btnMic.classList.remove('recording');
      listeningIndicator.classList.add('hidden');
    };
  }

  btnMic.addEventListener('click', () => {
    if (!recognition) return alert('Web Speech API tidak didukung browser ini.');
    if (isRecording) recognition.stop();
    else recognition.start();
  });

  loggerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = loggerInput.value.trim();
    if (!text) return;
    const formattedText = text.toLowerCase().startsWith('!y') ? text : '!y: ' + text;
    apiAddTransaction({ rawText: formattedText });
    loggerInput.value = '';
  });

  // Buttons & Modals Handlers
  btnWaQr.addEventListener('click', () => {
    fetchWaQr();
    waQrModal.showModal();
  });
  closeWaQr.addEventListener('click', () => waQrModal.close());

  btnWaShare.addEventListener('click', () => {
    const summary = state.summary || {};
    const text = `*📊 LAPORAN WEALTH RADAR ID*\nNet Worth: ${formatRp(summary.netWorth)}\nHealth Score: ${summary.score}/100`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  });

  btnWaSim.addEventListener('click', () => waSimModal.showModal());
  closeWaSim.addEventListener('click', () => waSimModal.close());

  waSimForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = waSimInput.value.trim();
    if (!msg) return;

    const userBubble = document.createElement('div');
    userBubble.className = 'chat-bubble user-bubble';
    userBubble.innerHTML = `<p>${msg}</p><span class="chat-time">Now</span>`;
    waChatBody.appendChild(userBubble);
    waSimInput.value = '';

    const formattedMsg = msg.toLowerCase().startsWith('!y') ? msg : '!y: ' + msg;
    apiAddTransaction({ rawText: formattedMsg });

    setTimeout(() => {
      const botBubble = document.createElement('div');
      botBubble.className = 'chat-bubble bot-bubble';
      botBubble.innerHTML = `<p>✅ Transaksi terdeteksi & berhasil dicatat ke Supabase/Node.js Server!</p><span class="chat-time">Now</span>`;
      waChatBody.appendChild(botBubble);
      waChatBody.scrollTop = waChatBody.scrollHeight;
    }, 400);
  });

  btnSettings.addEventListener('click', () => settingsModal.showModal());
  closeSettings.addEventListener('click', () => settingsModal.close());

  btnManualAdd.addEventListener('click', () => manualAddModal.showModal());
  closeManualAdd.addEventListener('click', () => manualAddModal.close());

  manualAddForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('manualTitle').value.trim();
    const amount = Number(document.getElementById('manualAmount').value) || 0;
    const wallet = manualWalletSelect.value || 'CASH';
    const type = document.getElementById('manualType').value;
    const category = document.getElementById('manualCategory').value;

    manualAddModal.close();
    manualAddForm.reset();
  });

  // Wallet Tabs Filter Listener
  const walletTabs = document.getElementById('walletTabs');
  if (walletTabs) {
    walletTabs.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        walletTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentWalletFilter = btn.dataset.wallet;
        renderTransactionFeed();
      });
    });
  }
    manualAddForm.reset();
  });

  categoryTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      currentCategoryFilter = e.target.dataset.cat;
      renderTransactionFeed();
    }
  });

  searchInput.addEventListener('input', () => renderTransactionFeed());
});
