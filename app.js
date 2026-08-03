/**
 * WEALTH RADAR // ID — CLIENT APP (!y: CONTEXT AI + CSV EXPORTER + REST FALLBACK)
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
  let state = { transactions: [], summary: {}, settings: { wallets: ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'] } };

  const formatRp = (num) => 'Rp ' + Number(num || 0).toLocaleString('id-ID');

  // ==========================================
  // 1. REST API FALLBACK FOR CLOUD VERCEL
  // ==========================================
  function fetchRestData() {
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => {
        if (data.transactions) state.transactions = data.transactions;
        if (data.summary) state.summary = data.summary;
        if (data.settings) state.settings = data.settings;
        statusDot.style.backgroundColor = 'var(--accent-emerald)';
        statusText.textContent = 'SUPABASE CLOUD ONLINE';
        renderDashboard();
      })
      .catch(err => console.log('REST fetch error:', err));
  }

  fetchRestData();

  // ==========================================
  // 2. WEBSOCKET REALTIME CONNECTION (LOCAL)
  // ==========================================
  try {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host || 'localhost:3000';
    const socket = new WebSocket(`${wsProtocol}//${wsHost}`);

    socket.onopen = () => console.log('⚡ WebSocket Connected to Server');

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === 'INIT_STATE' || data.event === 'STATE_UPDATE') {
        if (data.payload.transactions) state.transactions = data.payload.transactions;
        if (data.payload.summary) state.summary = data.payload.summary;
        if (data.payload.settings) state.settings = data.payload.settings;
        if (data.payload.waStatus) updateWaStatusUI(data.payload.waStatus);
        if (data.payload.qrCode) updateQrCodeUI(data.payload.qrCode);
        renderDashboard();
      } else if (data.event === 'WA_STATUS') {
        updateWaStatusUI(data.payload.status);
        if (data.payload.qr) updateQrCodeUI(data.payload.qr);
      }
    };
  } catch (e) {
    console.log('WebSocket not available, using Supabase REST API');
  }

  function updateWaStatusUI(status) {
    if (status === 'CONNECTED' || status === 'VERCEL_CLOUD_ONLINE') {
      statusDot.style.backgroundColor = 'var(--accent-emerald)';
      statusText.textContent = status === 'CONNECTED' ? 'WA BOT CONNECTED' : 'SUPABASE CLOUD ONLINE';
      qrStatusMsg.textContent = '✅ System Berhasil Terkoneksi!';
      qrStatusMsg.style.color = 'var(--accent-emerald)';
    } else if (status === 'SCAN_QR_REQUIRED') {
      statusDot.style.backgroundColor = 'var(--accent-amber)';
      statusText.textContent = 'SCAN WA QR';
    } else {
      statusDot.style.backgroundColor = 'var(--accent-emerald)';
      statusText.textContent = 'SUPABASE CLOUD ONLINE';
    }
    feather.replace();
  }

  function updateQrCodeUI(qrText) {
    qrCodeContainer.innerHTML = '';
    if (qrText && window.QRCode) {
      new QRCode(qrCodeContainer, {
        text: qrText,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff'
      });
      qrStatusMsg.textContent = 'Scan QR Code di atas menggunakan WhatsApp di HP kamu!';
      qrStatusMsg.style.color = 'var(--accent-amber)';
    }
  }

  // ==========================================
  // 3. DASHBOARD RENDERER & DYNAMIC WALLETS
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
      const matchSearch = !searchVal || t.title.toLowerCase().includes(searchVal) || (t.wallet || '').toLowerCase().includes(searchVal);
      return matchCat && matchSearch;
    });

    transactionList.innerHTML = '';

    if (filtered.length === 0) {
      transactionList.appendChild(emptyState);
      emptyState.style.display = 'flex';
      return;
    }

    emptyState.style.display = 'none';

    filtered.forEach(tx => {
      const item = document.createElement('div');
      item.className = 'tx-item';
      const isIncome = tx.type === 'INCOME';
      const iconName = isIncome ? 'arrow-down-left' : 'arrow-up-right';
      const dateFormatted = new Date(tx.date).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      });

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
              <span class="cat-badge" style="color: var(--accent-cyan);">${tx.wallet || 'CASH'}</span>
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
        state.transactions = state.transactions.filter(t => t.id !== tx.id);
        renderDashboard();
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

  // Buttons & Modals Handlers
  btnWaQr.addEventListener('click', () => waQrModal.showModal());
  closeWaQr.addEventListener('click', () => waQrModal.close());

  btnWaShare.addEventListener('click', () => {
    const summary = state.summary || {};
    const text = `*📊 LAPORAN WEALTH RADAR ID*\nNet Worth: ${formatRp(summary.netWorth)}\nHealth Score: ${summary.score}/100`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  });

  btnWaSim.addEventListener('click', () => waSimModal.showModal());
  closeWaSim.addEventListener('click', () => waSimModal.close());

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

    if (!title || !amount) return;

    state.transactions.unshift({
      id: 'tx_' + Date.now(), title, amount, wallet, type, category, date: new Date().toISOString()
    });

    renderDashboard();
    manualAddModal.close();
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
