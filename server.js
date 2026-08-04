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
        transactions = data;
        console.log(`📦 Loaded ${data.length} transactions from Supabase Cloud DB!`);
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

  // ==========================================
  // PARSE NATURAL LANGUAGE (!y: text)
  // ==========================================
  function parseTransactionFromText(text) {
    const walletPatterns = ['bca', 'mandiri', 'gopay', 'ovo', 'shopeepay', 'dana', 'cash'];
    const incomeKeywords = ['dapat', 'terima', 'gaji', 'bonus', 'transfer masuk', 'freelance', 'salary'];
    const categoryMap = {
      FOOD: ['makan', 'kopi', 'ayam', 'nasi', 'snack', 'jajan', 'warteg', 'bakso', 'mie', 'pizza', 'burger', 'starbucks', 'indomie', 'gorengan', 'sate', 'soto'],
      TRANSPORT: ['grab', 'gojek', 'bensin', 'pertamax', 'parkir', 'tol', 'ojol', 'taxi', 'bus', 'kereta'],
      BILLS: ['listrik', 'pln', 'wifi', 'indihome', 'pulsa', 'internet', 'air', 'pdam', 'gas', 'sewa', 'kos'],
      SHOPPING: ['beli', 'baju', 'celana', 'sepatu', 'tas', 'gadget', 'hp', 'laptop', 'shopee', 'tokped'],
      INVESTMENT: ['invest', 'saham', 'reksadana', 'crypto', 'tabung', 'deposito', 'emas', 'nabung']
    };

    const lower = text.toLowerCase().replace(/!y:\s*/i, '').trim();
    if (!lower) return null;

    let wallet = 'CASH';
    for (const w of walletPatterns) {
      if (lower.includes(w)) { wallet = w.toUpperCase(); break; }
    }

    let amount = 0;
    const amtMatch = lower.match(/(\d+[\.,]?\d*)\s*(rb|ribu|k|jt|juta|m)?/i);
    if (amtMatch) {
      amount = parseFloat(amtMatch[1].replace(',', '.'));
      const unit = (amtMatch[2] || '').toLowerCase();
      if (unit === 'rb' || unit === 'ribu' || unit === 'k') amount *= 1000;
      else if (unit === 'jt' || unit === 'juta' || unit === 'm') amount *= 1000000;
    }

    let type = 'EXPENSE';
    for (const kw of incomeKeywords) {
      if (lower.includes(kw)) { type = 'INCOME'; break; }
    }

    let category = type === 'INCOME' ? 'SALARY' : 'FOOD';
    for (const [cat, keywords] of Object.entries(categoryMap)) {
      for (const kw of keywords) {
        if (lower.includes(kw)) { category = cat; break; }
      }
    }

    let title = lower
      .replace(/(\d+[\.,]?\d*)\s*(rb|ribu|k|jt|juta|m)?/gi, '')
      .replace(new RegExp(walletPatterns.join('|'), 'gi'), '')
      .replace(/!y:?\s*/gi, '')
      .trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);
    if (!title) title = type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran';

    return {
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      title, amount, type, category, wallet,
      date: new Date().toISOString()
    };
  }

  // ==========================================
  // WHATSAPP BAILEYS BOT
  // ==========================================
  try {
    const { default: makeWASocket, useMultiFileAuthState, Browsers, DisconnectReason } = require('@whiskeysockets/baileys');
    const qrcodeTerm = require('qrcode-terminal');

    async function startWhatsAppBot() {
      const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const waSocket = makeWASocket({
        auth: authState,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Desktop'),
        syncFullHistory: false,
        markOnlineOnConnect: true,
        generateHighQualityLinkPreview: true
      });

      waSocket.ev.on('creds.update', saveCreds);

      waSocket.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('\n==================================================');
          console.log('📱 SCAN KODE QR WHATSAPP DI BAWAH INI (DARI TERMINAL):');
          console.log('==================================================\n');
          qrcodeTerm.generate(qr, { small: true });
          console.log('\n📱 Buka WhatsApp di HP -> Perangkat Tertaut -> Scan QR\n');

          currentQrCode = qr;
          currentWaStatus = 'SCAN_QR_REQUIRED';
          broadcast('WA_STATUS', { status: 'SCAN_QR_REQUIRED', qr: qr });
        }

        if (connection === 'open') {
          currentQrCode = null;
          currentWaStatus = 'CONNECTED';
          console.log('\n==================================================');
          console.log('✅ WHATSAPP BOT CONNECTED & SESI TERSEDIA PERMANEN!');
          console.log('==================================================\n');
          broadcast('WA_STATUS', { status: 'CONNECTED' });
        }

        if (connection === 'close') {
          currentQrCode = null;
          currentWaStatus = 'DISCONNECTED';
          broadcast('WA_STATUS', { status: 'DISCONNECTED' });

          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;

          console.log(`⚠️ WA Disconnected (Code: ${statusCode || 'Unknown'}). Reconnecting in 3s...`);

          if (isLoggedOut) {
            console.log('🚪 Sesi Logged Out. Menghapus folder auth...');
            try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
          }

          setTimeout(() => {
            startWhatsAppBot().catch(err => console.warn('Re-start WA error:', err.message));
          }, 3000);
        }
      });

      // ==========================================
      // HANDLE INCOMING WA MESSAGES
      // ==========================================
      waSocket.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = msg.message.conversation
          || msg.message.extendedTextMessage?.text
          || '';

        const jid = msg.key.remoteJid;
        const lower = text.toLowerCase().trim();

        // Only process !y commands
        if (!lower.startsWith('!y')) return;

        console.log(`📩 WA Message: "${text}"`);

        // !y help
        if (lower === '!y help' || lower === '!y') {
          await waSocket.sendMessage(jid, { text:
            `*📊 WEALTH RADAR // ID - COMMAND LIST*\n\n` +
            `*!y: [dompet] [nominal] [keterangan]*\n→ Catat transaksi\n→ Contoh: !y: bca 50k makan siang\n\n` +
            `*!y total* → Cek total saldo\n` +
            `*!y undo* → Hapus transaksi terakhir\n` +
            `*!y bulan* → Rekap bulan ini\n` +
            `*!y cat* → Breakdown per kategori\n` +
            `*!y [nama dompet]* → Cek saldo dompet\n→ Contoh: !y bca, !y gopay`
          });
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

        // !y: [transaction] - record transaction
        if (lower.startsWith('!y:')) {
          const tx = parseTransactionFromText(text);
          if (tx && tx.amount > 0) {
            await addTransaction(tx);
            const emoji = tx.type === 'INCOME' ? '📈' : '📉';
            await waSocket.sendMessage(jid, { text:
              `${emoji} *${tx.type === 'INCOME' ? 'PEMASUKAN' : 'PENGELUARAN'} TERCATAT!*\n\n` +
              `📝 ${tx.title}\n` +
              `💰 Rp ${Number(tx.amount).toLocaleString('id-ID')}\n` +
              `💳 ${tx.wallet} | 📂 ${tx.category}\n` +
              `⚡ Tersimpan ke Supabase Cloud DB!`
            });
          } else {
            await waSocket.sendMessage(jid, { text: '❌ Format tidak valid. Contoh: !y: bca 50k makan siang' });
          }
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

