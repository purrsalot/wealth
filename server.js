const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Load .env if present
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    envLines.forEach(line => {
      const [key, val] = line.split('=');
      if (key && val) process.env[key.trim()] = val.trim();
    });
  }
} catch (e) {}

// Supabase Import
const { createClient } = require('@supabase/supabase-js');

const APP_PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'transactions.json');
const AUTH_DIR = path.join(__dirname, 'wa_auth_info');

const app = express();
app.use(cors());
app.use(express.json());

// Serve Static Frontend Assets
app.use(express.static(__dirname));

// ==========================================
// 1. SUPABASE CLIENT & REALTIME ENGINE
// ==========================================
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://alpxljvkcwtjywskyzie.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFscHhsanZrY3d0anl3c2t5emllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NzM4NDAsImV4cCI6MjEwMTM0OTg0MH0.du58Vf0d20u2g7eqxLFP8NPGlN5KGATU3LH7vTNN0Uc';

let supabase = null;
let supabaseConnected = false;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabaseConnected = true;
    console.log('⚡ SUPABASE REALTIME DATABASE CONNECTED:', SUPABASE_URL);
  } catch (e) {
    console.warn('Supabase client error:', e);
  }
}

// ==========================================
// HUMAN READABLE INTERNAL LOG FORMATTER
// ==========================================
function internalLog(message) {
  const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  console.log(`## [INTERNAL - ${time}] ${message}`);
}

// Data Store (Hybrid Supabase + File Backup)
let transactions = [];
let settings = { 
  targetIncome: 10000000,
  wallets: ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH']
};

async function loadData() {
  if (!process.env.VERCEL && fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.settings) {
        settings = { ...settings, ...parsed.settings };
        if (!settings.wallets || !Array.isArray(settings.wallets)) {
          settings.wallets = ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'];
        }
      }
    } catch (e) {}
  }

  if (supabaseConnected && supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      if (!error && data) {
        const walletList = ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'];
        transactions = data.map(t => {
          if (!t.wallet || t.wallet === 'CASH') {
            const titleLower = (t.title || '').toLowerCase();
            const catLower = (t.category || '').toLowerCase();
            const found = walletList.find(w => titleLower.includes(w.toLowerCase()) || catLower.includes(w.toLowerCase()));
            if (found) t.wallet = found;
            else if (!t.wallet) t.wallet = 'CASH';
          }
          return t;
        });
        internalLog(`📦 Memuat ${transactions.length} transaksi dari Supabase Cloud DB`);
        return;
      }
    } catch (e) {
      console.warn('Failed loading from Supabase:', e);
    }
  }

  // Initial Seed Demo Data
  transactions = [
    { id: 'tx_seed_1', title: 'Gaji Bulanan Utama', amount: 12000000, type: 'INCOME', category: 'SALARY', wallet: 'BCA', date: new Date(Date.now() - 86400000 * 5).toISOString() },
    { id: 'tx_seed_2', title: 'Project Freelance UI/UX', amount: 3500000, type: 'INCOME', category: 'SALARY', wallet: 'MANDIRI', date: new Date(Date.now() - 86400000 * 3).toISOString() },
    { id: 'tx_seed_3', title: 'Makan Siang Warteg', amount: 35000, type: 'EXPENSE', category: 'FOOD', wallet: 'GOPAY', date: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'tx_seed_4', title: 'Bensin Motor Pertamax', amount: 50000, type: 'EXPENSE', category: 'TRANSPORT', wallet: 'OVO', date: new Date(Date.now() - 86400000 * 2).toISOString() },
    { id: 'tx_seed_5', title: 'Bayar WiFi Indihome', amount: 450000, type: 'EXPENSE', category: 'BILLS', wallet: 'BCA', date: new Date(Date.now() - 86400000 * 1).toISOString() }
  ];
}

function saveDataLocal() {
  if (process.env.VERCEL) return;
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ transactions, settings }, null, 2));
  } catch (e) {}
}

async function addTransaction(tx) {
  if (!tx.wallet) tx.wallet = 'CASH';
  transactions.unshift(tx);
  saveDataLocal();
  internalLog(`💾 Menyimpan transaksi baru: "${tx.title}" (Rp ${Number(tx.amount).toLocaleString('id-ID')})`);

  if (supabaseConnected && supabase) {
    try {
      const { error } = await supabase.from('transactions').insert([tx]);
      if (error && error.message.includes('wallet')) {
        const { id, title, amount, type, category, date } = tx;
        await supabase.from('transactions').insert([{ id, title, amount, type, category, date }]);
      }
    } catch (e) {
      console.error('Supabase Insert Error:', e);
    }
  }

  broadcast('STATE_UPDATE', { transactions, summary: getSummary(), settings });
}

async function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveDataLocal();
  internalLog(`🗑️ Menghapus transaksi (ID: ${id}) dari Supabase Cloud DB`);

  if (supabaseConnected && supabase) {
    try {
      await supabase.from('transactions').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase Delete Error:', e);
    }
  }

  broadcast('STATE_UPDATE', { transactions, summary: getSummary(), settings });
}

// Dynamic Summary Calculator
function getSummary() {
  let totalIncome = 0;
  let totalExpense = 0;
  let needsSpent = 0;
  let wantsSpent = 0;
  let savingsSpent = 0;

  const walletBalances = {};
  (settings.wallets || ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH']).forEach(w => {
    walletBalances[w.toUpperCase()] = 0;
  });

  transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    const w = (t.wallet || 'CASH').toUpperCase();

    if (!walletBalances.hasOwnProperty(w)) {
      walletBalances[w] = 0;
    }

    if (t.type === 'INCOME') {
      totalIncome += amt;
      walletBalances[w] += amt;
    } else {
      totalExpense += amt;
      walletBalances[w] -= amt;

      if (['FOOD', 'TRANSPORT', 'BILLS'].includes(t.category)) {
        needsSpent += amt;
      } else if (t.category === 'SHOPPING') {
        wantsSpent += amt;
      } else if (t.category === 'INVESTMENT') {
        savingsSpent += amt;
      } else {
        needsSpent += amt;
      }
    }
  });

  const netWorth = totalIncome - totalExpense;
  const baseTarget = settings.targetIncome || 10000000;
  const needsLimit = baseTarget * 0.50;
  const wantsLimit = baseTarget * 0.30;
  const savingsLimit = baseTarget * 0.20;

  const needsPct = Math.min(100, Math.round((needsSpent / needsLimit) * 100)) || 0;
  const wantsPct = Math.min(100, Math.round((wantsSpent / wantsLimit) * 100)) || 0;
  const savingsPct = Math.min(100, Math.round(((savingsSpent + Math.max(0, netWorth)) / savingsLimit) * 100)) || 0;

  let score = 100;
  if (needsPct > 100) score -= Math.min(30, (needsPct - 100) * 0.5);
  if (wantsPct > 100) score -= Math.min(35, (wantsPct - 100) * 0.7);
  if (totalExpense > totalIncome && totalIncome > 0) score -= 30;
  if (savingsPct < 50) score -= 15;
  score = Math.max(10, Math.min(100, Math.round(score)));

  let healthBadge = 'EXCELLENT';
  if (score < 50) healthBadge = 'CRITICAL DANGER';
  else if (score < 75) healthBadge = 'MODERATE';

  return {
    totalIncome, totalExpense, netWorth,
    needsSpent, needsLimit, needsPct,
    wantsSpent, wantsLimit, wantsPct,
    savingsSpent, savingsLimit, savingsPct,
    score, healthBadge, walletBalances
  };
}

// REST API
app.get('/api/transactions', async (req, res) => {
  await loadData();
  res.json({ transactions, summary: getSummary(), settings, supabaseConnected });
});

app.get('/api/reset-wa', async (req, res) => {
  try {
    currentQrCode = null;
    currentWaStatus = 'DISCONNECTED';
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
    res.json({ success: true, message: 'WhatsApp auth session reset! Server will generate a fresh QR code.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/wa-qr', (req, res) => {
  res.json({ status: currentWaStatus, qr: currentQrCode });
});

// Explicit index.html Root Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Wildcard Fallback Route for Single Page App
app.get('*', (req, res) => {
  const filePath = path.join(__dirname, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

let wss = null;
let server = null;
let currentWaStatus = 'DISCONNECTED';
let currentQrCode = null;

function broadcast(event, payload) {
  if (!wss) return;
  const msg = JSON.stringify({ event, payload });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// ==========================================
// LOCAL SERVER + WHATSAPP BOT
// ==========================================
if (require.main === module && !process.env.VERCEL) {
  server = http.createServer(app);
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({
      event: 'INIT_STATE',
      payload: { transactions, settings, summary: getSummary(), supabaseConnected, waStatus: currentWaStatus }
    }));

    // Handle incoming WebSocket messages from browser
    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw);

        if (msg.event === 'PARSE_TEXT') {
          const text = msg.payload || '';
          const tx = parseTransactionFromText(text);
          if (tx) await addTransaction(tx);
        }

        if (msg.event === 'ADD_TRANSACTION') {
          await addTransaction(msg.payload);
        }

        if (msg.event === 'DELETE_TRANSACTION') {
          await deleteTransaction(msg.payload);
        }

        if (msg.event === 'UPDATE_WALLETS') {
          settings.wallets = msg.payload;
          saveDataLocal();
          broadcast('STATE_UPDATE', { transactions, summary: getSummary(), settings });
        }
      } catch (e) {
        console.error('WS message error:', e);
      }
    });
  });

  function isDuplicateTransaction(tx) {
    return transactions.some(t => {
      const isSameTitle = (t.title || '').toLowerCase().trim() === (tx.title || '').toLowerCase().trim();
      const isSameAmount = Number(t.amount) === Number(tx.amount);
      const isSameWallet = (t.wallet || 'CASH').toUpperCase() === (tx.wallet || 'CASH').toUpperCase();
      const dateDiff = Math.abs(new Date(t.date).getTime() - new Date(tx.date).getTime());
      return isSameTitle && isSameAmount && isSameWallet && dateDiff < 86400000;
    });
  }

  // ==========================================
  // ORDER-INDEPENDENT SMART AI PARSER
  // ==========================================
  function parseTransactionFromText(text, msgTimestamp) {
    const walletPatterns = ['bca', 'mandiri', 'gopay', 'ovo', 'shopeepay', 'dana', 'cash'];
    const incomeKeywords = [
      'dapat', 'terima', 'diterima', 'gaji', 'gajian', 'bonus', 'transfer masuk', 'freelance', 'salary',
      'masuk', 'cair', 'diberi', 'jual', 'laku', 'hasil', 'komisi', 'refund', 'cashback', 'kembalian',
      'untung', 'omset', 'inflow', 'pemasukan', 'dikirim', 'dikirimin', 'kiriman', 'transferan', 'dari',
      'pemberian', 'dikasih', 'kasih', 'ngasih', 'dikasihin', 'memberi', 'amplop', 'sangu', 'pesangon',
      'hibah', 'titipan', 'hadiah', 'diselipin', 'nambah', 'nambahin', 'dapet', 'dapetin', 'klaim',
      'pencairan', 'cairan', 'rejeki', 'rezeki', 'setoran', 'setor', 'pembayaran', 'dibayar', 'pelunasan',
      'lunas', 'dividen', 'bunga', 'royalti', 'vouchers', 'poin'
    ];

    const expenseExplicitKeywords = [
      'kirim ke', 'dikirimin ke', 'transfer ke', 'bayar ke', 'bayarin', 'traktir', 'kasih ke',
      'ngasih ke', 'transfer keluar', 'bayar', 'beli', 'dibeli', 'keluar'
    ];

    const categoryMap = {
      FAMILY: ['mama', 'papa', 'ortu', 'orang tua', 'kakak', 'kaka', 'adik', 'anak', 'keluarga', 'family', 'sangu'],
      GIFT: ['dikirim', 'dikirimin', 'kiriman', 'dikasih', 'kasih', 'ngasih', 'pemberian', 'amplop', 'kado', 'hadiah', 'hibah'],
      DEBT: ['utang', 'hutang', 'bayar utang', 'pelunasan', 'cicilan', 'pinjaman', 'pinjam', 'talangan'],
      FOOD: ['makan', 'minum', 'kopi', 'ayam', 'nasi', 'snack', 'jajan', 'warteg', 'bakso', 'mie', 'pizza', 'burger', 'starbucks', 'indomie', 'gorengan', 'sate', 'soto', 'resto', 'kafe', 'cafe', 'es', 'kuliner'],
      TRANSPORT: ['grab', 'gojek', 'bensin', 'pertamax', 'parkir', 'tol', 'ojol', 'taxi', 'bus', 'kereta', 'mrt', 'service', 'oli', 'ban', 'tambal', 'angkot'],
      BILLS: ['listrik', 'pln', 'wifi', 'indihome', 'pulsa', 'internet', 'air', 'pdam', 'gas', 'sewa', 'kos', 'bpjs', 'pajak', 'asuransi', 'langganan', 'tagihan'],
      SHOPPING: ['beli', 'baju', 'celana', 'sepatu', 'tas', 'gadget', 'hp', 'laptop', 'shopee', 'tokped', 'tokopedia', 'lazada', 'blibli', 'buku', 'belanja', 'supermarket'],
      INVESTMENT: ['invest', 'saham', 'reksadana', 'crypto', 'tabung', 'deposito', 'emas', 'nabung', 'bibit', 'pintu', 'sekuritas'],
      SALARY: ['gaji', 'salary', 'freelance', 'bonus', 'thr', 'proyek', 'gajian'],
      ENTERTAINMENT: ['nonton', 'bioskop', 'game', 'steam', 'netflix', 'spotify', 'youtube', 'konser', 'tiket', 'rekreasi', 'liburan'],
      HEALTH: ['obat', 'dokter', 'apotek', 'rs', 'rumah sakit', 'vitamin', 'gym', 'sehat', 'fitnes']
    };

    const lower = text.toLowerCase().replace(/!y:\s*/i, '').trim();
    if (!lower) return null;

    // 1. Order-Independent Amount Detection
    let amount = 0;
    let amountRawMatch = '';
    const amtMatch = lower.match(/(\d+[\.,]?\d*)\s*(rb|ribu|k|jt|juta|m)?/i);
    if (amtMatch) {
      amountRawMatch = amtMatch[0];
      amount = parseFloat(amtMatch[1].replace(',', '.'));
      const unit = (amtMatch[2] || '').toLowerCase();
      if (unit === 'rb' || unit === 'ribu' || unit === 'k') amount *= 1000;
      else if (unit === 'jt' || unit === 'juta' || unit === 'm') amount *= 1000000;
    }

    // 2. Order-Independent Wallet Detection
    let wallet = 'CASH';
    let matchedWalletWord = '';
    for (const w of walletPatterns) {
      const wRegex = new RegExp(`\\b${w}\\b`, 'i');
      if (wRegex.test(lower)) {
        wallet = w.toUpperCase();
        matchedWalletWord = w;
        break;
      }
    }

    // 3. Smart Type Detection (Grammar Rules for "bayar": "bayar kevin" = EXPENSE vs "kevin bayar" = INCOME)
    let type = 'EXPENSE';

    const isSubjectBayarIncome = (/\b[a-z]{3,}\s+bayar\b/i.test(lower) || /\b[a-z]{3,}\s+membayar\b/i.test(lower)) && !lower.startsWith('bayar');
    const isBayarSubjectExpense = /^(bayar|membayar|bayarin|bayar ke)\b/i.test(lower) || /\bbayar ke\b/i.test(lower);

    if (isSubjectBayarIncome && !isBayarSubjectExpense) {
      type = 'INCOME';
    } else {
      const isExplicitOutflow = expenseExplicitKeywords.some(kw => lower.includes(kw));

      if (!isExplicitOutflow) {
        for (const kw of incomeKeywords) {
          if (lower.includes(kw)) {
            type = 'INCOME';
            break;
          }
        }
      }
    }

    // 4. Order-Independent Category Detection (Preset or Dynamic)
    let category = null;
    for (const [cat, keywords] of Object.entries(categoryMap)) {
      for (const kw of keywords) {
        const catRegex = new RegExp(`\\b${kw}\\b`, 'i');
        if (catRegex.test(lower)) { category = cat; break; }
      }
      if (category) break;
    }

    // 5. Clean Title & Natural Human Context Polishing
    let titleClean = lower;
    if (amountRawMatch) {
      titleClean = titleClean.replace(amountRawMatch, '');
    }
    if (matchedWalletWord) {
      titleClean = titleClean.replace(new RegExp(`\\b${matchedWalletWord}\\b`, 'gi'), '');
    }

    const noiseWords = ['!y:', '!y', 'di', 'ke', 'pada', 'untuk', 'yang', 'dengan', 'dan', 'sama', 'via', 'pakai', 'lewat'];
    noiseWords.forEach(nw => {
      titleClean = titleClean.replace(new RegExp(`\\b${nw}\\b`, 'gi'), '');
    });

    titleClean = titleClean.replace(/\s+/g, ' ').trim();

    // If still no preset category, dynamically generate Category from first meaningful word!
    if (!category) {
      const words = titleClean.split(/\s+/).filter(w => w.length > 2);
      if (words.length > 0) {
        category = words[0].toUpperCase().replace(/[^A-Z]/g, '');
      }
      if (!category || category.length < 2) category = type === 'INCOME' ? 'SALARY' : 'MISC';
    }

    // Human Context Title Formatting
    let title = titleClean.charAt(0).toUpperCase() + titleClean.slice(1);

    if (type === 'INCOME') {
      if ((lower.includes('mama') || lower.includes('papa') || lower.includes('ortu')) && !title.toLowerCase().includes('kiriman')) {
        title = 'Kiriman ' + title;
      } else if ((lower.includes('bayar') || lower.includes('utang')) && !title.toLowerCase().includes('pelunasan')) {
        title = 'Pelunasan Utang ' + title;
      }
    }

    if (!title || title.length < 2) title = type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran';

    const txDate = msgTimestamp ? new Date(Number(msgTimestamp) * 1000).toISOString() : new Date().toISOString();

    return {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title, amount, type, category, wallet,
      date: txDate
    };
  }

  // ==========================================
  // WHATSAPP BAILEYS BOT
  // ==========================================
  try {
    const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
    const qrcodeTerm = require('qrcode-terminal');
    const P = require('pino');

    let isReconnecting = false;

    async function startWhatsAppBot() {
      if (isReconnecting) return;
      isReconnecting = true;

      const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const waSocket = makeWASocket({
        auth: authState,
        logger: P({ level: 'silent' }),
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Desktop'),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000
      });

      // Mac Sleep & Network Wakeup Watchdog
      let lastPingTime = Date.now();
      if (global._waSleepInterval) clearInterval(global._waSleepInterval);
      global._waSleepInterval = setInterval(() => {
        const now = Date.now();
        const gap = now - lastPingTime;
        lastPingTime = now;

        // Gap > 10 seconds means Mac was in SLEEP mode!
        if (gap > 10000) {
          internalLog(`🌙 Mac terdeteksi BANGUN DARI SLEEP (${(gap / 1000).toFixed(1)}s gap). Melakukan Auto-Reconnect WA Bot...`);
          global._wasInSleep = true;
          currentWaStatus = 'DISCONNECTED';
          broadcast('WA_STATUS', { status: 'DISCONNECTED' });
          isReconnecting = false;
          try { waSocket.end(new Error('Mac Wakeup')); } catch (e) {}
          setTimeout(() => startWhatsAppBot(), 2000);
        }
      }, 4000);

      waSocket.ev.on('creds.update', () => {
        saveCreds();
        internalLog('🔑 Menyimpan & memperbarui kunci sesi autentikasi (creds)...');
      });

      waSocket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          internalLog('📱 Kode QR baru berhasil dibuat & dikirim ke browser / terminal');
          qrcodeTerm.generate(qr, { small: true });

          currentQrCode = qr;
          currentWaStatus = 'SCAN_QR_REQUIRED';
          broadcast('WA_STATUS', { status: 'SCAN_QR_REQUIRED', qr: qr });
        }

        if (connection === 'open') {
          isReconnecting = false;
          currentQrCode = null;
          currentWaStatus = 'CONNECTED';
          internalLog('✅ Koneksi WhatsApp terhubung & siap menerima perintah!');
          broadcast('WA_STATUS', { status: 'CONNECTED' });

          // Auto Sync & Send notification when waking up from Sleep
          if (global._wasInSleep && lastUserJid) {
            global._wasInSleep = false;
            try {
              const nowStr = new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
              await waSocket.sendMessage(lastUserJid, { text:
                `🌙 *AUTO-SYNC: LAPTOP MAC BANGUN DARI SLEEP!*\n\n` +
                `🕒 Waktu Bangun: ${nowStr}\n` +
                `🟢 Status: Server PM2 & Bot WA Kembali *ONLINE*\n` +
                `⚡ *Auto-Sync Aktif*: Semua transaksi pending yang kamu kirim saat laptop sleep otomatis dicatat lengkap dengan tanggal & jam aslinya!`
              });
            } catch (e) {
              console.warn('Sleep notification error:', e.message);
            }
          }
        }

        if (connection === 'close') {
          isReconnecting = false;
          currentQrCode = null;
          currentWaStatus = 'DISCONNECTED';
          broadcast('WA_STATUS', { status: 'DISCONNECTED' });

          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

          internalLog(`⚠️ WA Disconnected (Status Code: ${statusCode || 'Unknown'}). Reconnecting in 3s...`);

          if (isLoggedOut) {
            internalLog('🚪 Sesi Logged Out. Menghapus folder auth...');
            try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
          }

          setTimeout(() => {
            startWhatsAppBot().catch(err => console.warn('Re-start WA error:', err.message));
          }, 3000);
        }
      });

      let lastUserJid = null;

      // Handle process shutdown (pm2 stop / exit)
      const handleShutdown = async (signal) => {
        console.log(`\n🛑 Server received ${signal}, sending WhatsApp shutdown alert...`);
        if (waSocket && lastUserJid) {
          try {
            const nowStr = new Date().toLocaleString('id-ID');
            await waSocket.sendMessage(lastUserJid, { text:
              `⚠️ *PERINGATAN: SERVER PM2 DIHENTIKAN!*\n\n` +
              `🕒 Waktu: ${nowStr}\n` +
              `🛑 Status: OFFLINE (${signal})\n` +
              `💡 _Nyalakan kembali dengan: pm2 restart wealth-bot_`
            });
          } catch (e) {
            console.warn('Failed to send shutdown WA alert:', e.message);
          }
        }
        process.exit(0);
      };
      process.once('SIGINT', () => handleShutdown('SIGINT'));
      process.once('SIGTERM', () => handleShutdown('SIGTERM'));

      // ==========================================
      // HANDLE INCOMING WA MESSAGES (OWNER ONLY FILTER)
      // ==========================================
      waSocket.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg || !msg.message) return;

        const text = msg.message.conversation
          || msg.message.extendedTextMessage?.text
          || '';

        const jid = msg.key.remoteJid;
        const lower = text.toLowerCase().trim();

        // Check if message starts with !y OR contains a natural transaction pattern (e.g. bca 50k makan, 100rb gaji)
        const hasNominalPattern = /(\d+[\.,]?\d*)\s*(rb|ribu|k|jt|juta|m)\b/i.test(lower) || /\b\d{4,9}\b/.test(lower);
        const hasWalletOrKeyword = ['bca', 'mandiri', 'gopay', 'ovo', 'shopeepay', 'dana', 'cash', 'makan', 'bensin', 'gaji', 'dapat', 'bayar', 'beli', 'kopi', 'warteg', 'pulsa', 'wifi', 'listrik'].some(w => lower.includes(w));
        const isTransactionFormat = lower.startsWith('!y') || (hasNominalPattern && hasWalletOrKeyword);

        if (!isTransactionFormat) return;

        // Owner Security Check: Only allow commands from owner's linked number / self
        const ownerJid = waSocket.user?.id ? waSocket.user.id.split(':')[0].split('@')[0] : '';
        const senderJid = (msg.key.participant || msg.key.remoteJid || '').split(':')[0].split('@')[0];
        const isOwner = msg.key.fromMe || (ownerJid && (senderJid === ownerJid || jid.startsWith(ownerJid)));

        if (!isOwner) {
          internalLog(`🛡️ Pesan "${text}" DIABAIKAN karena dikirim dari nomor lain (${senderJid})`);
          return;
        }

        lastUserJid = jid;
        internalLog(`📩 Pesan WA diterima dari Owner (${senderJid}): "${text}"`);

        // !y help
        if (lower === '!y help' || lower === '!y') {
          await waSocket.sendMessage(jid, { text:
            `*📊 WEALTH RADAR // ID - COMMAND LIST*\n\n` +
            `*Catat Bebas* → Ketik biasa, contoh: _bca 50k makan siang_ atau _someone kasih 100k gopay_\n\n` +
            `*!y edit [nominal]* → Revisi nominal transaksi terakhir\n` +
            `*!y sisa / !y budget* → Hitung budget harian aman s/d akhir bulan\n` +
            `*!y report* → Laporan ringkas keuangan\n` +
            `*!y piutang* → Daftar catatan utang/piutang\n` +
            `*!y status* → Cek status server & database\n` +
            `*!y sync* → Sinkronisasi pesan pending\n` +
            `*!y total* → Total saldo Net Worth\n` +
            `*!y undo* → Hapus transaksi terakhir\n` +
            `*!y bulan* → Rekap transaksi bulan ini\n` +
            `*!y cat* → Breakdown per kategori\n` +
            `*!y [dompet]* → Cek saldo spesifik (contoh: _!y bca_)`
          });
          return;
        }

        // !y status
        if (lower === '!y status') {
          const uptimeSec = Math.floor(process.uptime());
          const hrs = Math.floor(uptimeSec / 3600);
          const mins = Math.floor((uptimeSec % 3600) / 60);
          const secs = uptimeSec % 60;
          const uptimeStr = `${hrs > 0 ? hrs + 'j ' : ''}${mins}m ${secs}d`;

          const memMb = (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);
          const dbStatus = supabaseConnected ? '🟢 Connected (Supabase Cloud)' : '🟡 Local Storage Mode';
          const walletList = (settings.wallets || ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH']).join(', ');

          await waSocket.sendMessage(jid, { text:
            `🤖 *WEALTH RADAR // ID - BOT SYSTEM STATUS*\n\n` +
            `🟢 *PM2 Status*: ONLINE (Active Background Daemon)\n` +
            `⏱️ *Uptime Server*: ${uptimeStr}\n` +
            `💻 *Penggunaan RAM*: ${memMb} MB\n` +
            `⚡ *Database*: ${dbStatus}\n` +
            `💳 *Dompet Aktif*: ${walletList}\n` +
            `📊 *Total Transaksi*: ${transactions.length} item\n\n` +
            `_Ketik *!y help* untuk melihat daftar perintah._`
          });
          return;
        }

        // !y sync
        if (lower === '!y sync') {
          let addedCount = 0;
          let skippedCount = 0;

          for (const item of (m.messages || [])) {
            const itemText = item.message?.conversation || item.message?.extendedTextMessage?.text || '';
            if (itemText.toLowerCase().trim().startsWith('!y:')) {
              const tx = parseTransactionFromText(itemText, item.messageTimestamp);
              if (tx && tx.amount > 0) {
                if (isDuplicateTransaction(tx)) {
                  skippedCount++;
                } else {
                  await addTransaction(tx);
                  addedCount++;
                }
              }
            }
          }

          await waSocket.sendMessage(jid, { text:
            `✅ *SINKRONISASI SELESAI!*\n\n` +
            `➕ *${addedCount}* Transaksi baru ditambahkan!\n` +
            `⏭️ *${skippedCount}* Transaksi dilewati (sudah ada/duplikat).\n` +
            `📅 Tanggal & Jam disesuaikan otomatis dengan waktu kirim WA!`
          });
          return;
        }

        // !y edit [nominal]
        if (lower.startsWith('!y edit') || lower.startsWith('!y revisi')) {
          if (transactions.length === 0) {
            await waSocket.sendMessage(jid, { text: '❌ Tidak ada transaksi untuk di-edit.' });
            return;
          }
          const amtMatch = lower.match(/(\d+[\.,]?\d*)\s*(rb|ribu|k|jt|juta|m)?/i);
          if (!amtMatch) {
            await waSocket.sendMessage(jid, { text: '❌ Sertakan nominal baru. Contoh: !y edit 75k' });
            return;
          }
          let newAmt = parseFloat(amtMatch[1].replace(',', '.'));
          const unit = (amtMatch[2] || '').toLowerCase();
          if (unit === 'rb' || unit === 'ribu' || unit === 'k') newAmt *= 1000;
          else if (unit === 'jt' || unit === 'juta' || unit === 'm') newAmt *= 1000000;

          const lastTx = transactions[0];
          const oldAmt = lastTx.amount;
          lastTx.amount = newAmt;

          if (supabaseConnected && supabase) {
            try { await supabase.from('transactions').update({ amount: newAmt }).eq('id', lastTx.id); } catch (e) {}
          }
          saveDataLocal();
          broadcast('STATE_UPDATE', { transactions, summary: getSummary(), settings });

          await waSocket.sendMessage(jid, { text:
            `✏️ *TRANSAKSI BERHASIL DIREVISI!*\n\n` +
            `📝 ${lastTx.title}\n` +
            `💰 Nominal Lama: Rp ${Number(oldAmt).toLocaleString('id-ID')}\n` +
            `✨ Nominal Baru: Rp ${Number(newAmt).toLocaleString('id-ID')}\n` +
            `✅ Success`
          });
          return;
        }

        // !y budget / !y sisa - Kalkulator Sisa Uang Aman per Hari
        if (lower === '!y budget' || lower === '!y sisa') {
          const now = new Date();
          const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          const remainingDays = Math.max(1, lastDayOfMonth - now.getDate() + 1);

          const monthTx = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          });
          const inc = monthTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
          const exp = monthTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
          const remainingMoney = inc - exp;
          const safeDaily = Math.max(0, Math.floor(remainingMoney / remainingDays));

          await waSocket.sendMessage(jid, { text:
            `*🧮 KALKULATOR BUDGET BULANAN*\n\n` +
            `💰 Sisa Uang Bulan Ini: Rp ${remainingMoney.toLocaleString('id-ID')}\n` +
            `📅 Sisa Hari: ${remainingDays} hari lagi\n` +
            `🛡️ *Budget Aman per Hari*: Rp ${safeDaily.toLocaleString('id-ID')}/hari\n\n` +
            `💡 _Jaga pengeluaranmu di bawah Rp ${safeDaily.toLocaleString('id-ID')}/hari agar saldomu tetap positif sampai akhir bulan!_`
          });
          return;
        }

        // !y report - Laporan Rekap Ringkas
        if (lower === '!y report') {
          const s = getSummary();
          const now = new Date();
          const monthTx = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          });
          const inc = monthTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
          const exp = monthTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);

          await waSocket.sendMessage(jid, { text:
            `*📊 LAPORAN KEUANGAN WEALTH RADAR*\n\n` +
            `💰 *Net Worth Total*: Rp ${Number(s.netWorth).toLocaleString('id-ID')}\n` +
            `📈 Total Pemasukan Bulan Ini: Rp ${inc.toLocaleString('id-ID')}\n` +
            `📉 Total Pengeluaran Bulan Ini: Rp ${exp.toLocaleString('id-ID')}\n` +
            `💵 Sisa Net Financial: Rp ${(inc - exp).toLocaleString('id-ID')}\n` +
            `❤️ Skor Kesehatan Keuangan: ${s.score}/100 (${s.healthBadge})\n\n` +
            `✅ Laporan Siap`
          });
          return;
        }

        // !y piutang - Daftar Orang yang Masih Memiliki Utang/Pinjaman
        if (lower === '!y piutang' || lower === '!y utang') {
          const debtTx = transactions.filter(t => t.category === 'DEBT');
          if (debtTx.length === 0) {
            await waSocket.sendMessage(jid, { text: '🎉 *Bersih!* Tidak ada catatan piutang / utang saat ini.' });
            return;
          }
          let debtMsg = '*📋 DAFTAR CATATAN PIUTANG / UTANG*\n\n';
          debtTx.slice(0, 10).forEach(t => {
            const emoji = t.type === 'INCOME' ? '🟢 Lunas/Terima' : '🔴 Belum Lunas';
            debtMsg += `• ${t.title}: Rp ${Number(t.amount).toLocaleString('id-ID')} (${emoji})\n`;
          });
          await waSocket.sendMessage(jid, { text: debtMsg });
          return;
        }

        // !y total
        if (lower === '!y total') {
          const s = getSummary();
          await waSocket.sendMessage(jid, { text:
            `*💰 NET WORTH: Rp ${Number(s.netWorth).toLocaleString('id-ID')}*\n\n` +
            `📈 Income: Rp ${Number(s.totalIncome).toLocaleString('id-ID')}\n` +
            `📉 Expense: Rp ${Number(s.totalExpense).toLocaleString('id-ID')}\n` +
            `❤️ Health Score: ${s.score}/100 (${s.healthBadge})`
          });
          return;
        }

        // !y undo
        if (lower === '!y undo') {
          if (transactions.length > 0) {
            const removed = transactions[0];
            await deleteTransaction(removed.id);
            await waSocket.sendMessage(jid, { text: `🗑️ Dihapus: "${removed.title}" (Rp ${Number(removed.amount).toLocaleString('id-ID')})` });
          } else {
            await waSocket.sendMessage(jid, { text: '❌ Tidak ada transaksi untuk di-undo.' });
          }
          return;
        }

        // !y bulan
        if (lower === '!y bulan') {
          const now = new Date();
          const monthTx = transactions.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          });
          const inc = monthTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount), 0);
          const exp = monthTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount), 0);
          await waSocket.sendMessage(jid, { text:
            `*📅 REKAP BULAN INI*\n\n` +
            `📊 Total Transaksi: ${monthTx.length}\n` +
            `📈 Pemasukan: Rp ${inc.toLocaleString('id-ID')}\n` +
            `📉 Pengeluaran: Rp ${exp.toLocaleString('id-ID')}\n` +
            `💰 Sisa: Rp ${(inc - exp).toLocaleString('id-ID')}`
          });
          return;
        }

        // !y cat
        if (lower === '!y cat') {
          const cats = {};
          transactions.filter(t => t.type === 'EXPENSE').forEach(t => {
            cats[t.category] = (cats[t.category] || 0) + Number(t.amount);
          });
          let catText = '*📂 BREAKDOWN KATEGORI*\n\n';
          Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([cat, total]) => {
            catText += `• ${cat}: Rp ${total.toLocaleString('id-ID')}\n`;
          });
          if (Object.keys(cats).length === 0) catText += 'Belum ada pengeluaran.';
          await waSocket.sendMessage(jid, { text: catText });
          return;
        }

        // !y [wallet name] - check specific wallet
        const walletCheck = lower.replace('!y ', '').trim().toUpperCase();
        const wallets = (settings.wallets || []).map(w => w.toUpperCase());
        if (wallets.includes(walletCheck)) {
          const s = getSummary();
          const bal = s.walletBalances[walletCheck] || 0;
          await waSocket.sendMessage(jid, { text: `*💳 ${walletCheck}*\nSaldo: Rp ${bal.toLocaleString('id-ID')}` });
          return;
        }

        // Record transaction (supports with or without !y: prefix)
        const tx = parseTransactionFromText(text, msg.messageTimestamp);
        if (tx && tx.amount > 0) {
          if (isDuplicateTransaction(tx)) {
            await waSocket.sendMessage(jid, { text: `⏭️ Transaksi "${tx.title}" (Rp ${Number(tx.amount).toLocaleString('id-ID')}) sudah pernah dicatat sebelumnya.` });
            return;
          }
          await addTransaction(tx);
          const emoji = tx.type === 'INCOME' ? '📈' : '📉';
          const dateStr = new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
          await waSocket.sendMessage(jid, { text:
            `${emoji} *${tx.type === 'INCOME' ? 'PEMASUKAN' : 'PENGELUARAN'} TERCATAT!*\n\n` +
            `📝 ${tx.title}\n` +
            `💰 Rp ${Number(tx.amount).toLocaleString('id-ID')}\n` +
            `💳 ${tx.wallet} | 📂 ${tx.category}\n` +
            `🕒 Waktu: ${dateStr}\n` +
            `✅ Success`
          });
          return;
        } else if (lower.startsWith('!y:')) {
          await waSocket.sendMessage(jid, { text: '❌ Format tidak valid. Contoh: bca 50k makan siang atau !y: mandiri 2jt gaji' });
          return;
        }
      });
    }

    loadData().then(() => {
      server.listen(APP_PORT, () => {
        console.log(`\n🚀 WEALTH RADAR ID SERVER AT http://localhost:${APP_PORT}`);
        console.log(`📱 Buka http://localhost:${APP_PORT} → klik SCAN WA QR untuk pairing WhatsApp\n`);
        startWhatsAppBot().catch(e => console.warn('WA Bot notice:', e.message));
      });
    });
  } catch (e) {
    loadData().then(() => {
      server.listen(APP_PORT, () => {
        console.log(`🚀 WEALTH RADAR ID SERVER AT http://localhost:${APP_PORT} (tanpa WA Bot)`);
      });
    });
  }
} else {
  loadData();
}

module.exports = app;

