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

// Baileys WhatsApp Imports
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const qrcodeTerm = require('qrcode-terminal');

const APP_PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'transactions.json');
const AUTH_DIR = path.join(__dirname, 'wa_auth_info');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

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
  if (fs.existsSync(DATA_FILE)) {
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
  saveDataLocal();
}

function saveDataLocal() {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ transactions, settings }, null, 2));
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
        console.log('⚡ Saved to Supabase Cloud DB (fallback):', tx.title);
      } else if (!error) {
        console.log('⚡ Transaction saved to Supabase Cloud DB:', tx.title);
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

// Dynamic Summary Calculator + Dynamic Wallet Balances
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

// ==========================================
// 2. DYNAMIC CONTEXTUAL AI NATURAL LANGUAGE PARSER
// ==========================================
function parseNLText(inputStr) {
  if (!inputStr) return null;
  let cleaned = inputStr.trim();

  // Strip prefix !y: or !y if present
  if (cleaned.toLowerCase().startsWith('!y:')) {
    cleaned = cleaned.slice(3).trim();
  } else if (cleaned.toLowerCase().startsWith('!y')) {
    cleaned = cleaned.slice(2).trim();
  }
  
  // 1. Dynamic Wallet Detection
  let wallet = 'CASH';
  const lower = cleaned.toLowerCase();
  const activeWallets = settings.wallets || ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'];

  for (const w of activeWallets) {
    const reg = new RegExp(`\\b(${w.toLowerCase()})\\b`, 'i');
    if (reg.test(lower)) {
      wallet = w.toUpperCase();
      break;
    }
  }

  // 2. Amount Extraction
  let amount = 0;
  const amountRegex = /(\d+[\.,]?\d*)\s*(jt|juta|rb|ribu|k)?/i;
  const match = cleaned.match(amountRegex);

  if (match) {
    let numRaw = match[1].replace(',', '.');
    let numVal = parseFloat(numRaw);
    let suffix = (match[2] || '').toLowerCase();

    if (suffix === 'jt' || suffix === 'juta') amount = numVal * 1000000;
    else if (suffix === 'rb' || suffix === 'ribu' || suffix === 'k') amount = numVal * 1000;
    else amount = numVal;
  }

  if (!amount || isNaN(amount)) amount = 25000;

  // 3. Smart Contextual Type Detection (INCOME vs EXPENSE)
  const incomeKeywords = [
    'gaji', 'dapat', 'dapet', 'terima', 'transferan', 'masuk', 'inflow', 'bonus', 
    'transfer', 'freelance', 'income', 'hasil', 'profit', 'untung', 'cair', 
    'dikasih', 'nemu', 'deviden', 'gajian', 'thr', 'dapat duit', 'masuk rekening'
  ];

  const isIncome = incomeKeywords.some(kw => lower.includes(kw));
  const type = isIncome ? 'INCOME' : 'EXPENSE';

  // 4. Category Classification
  let category = 'FOOD';
  if (isIncome) {
    category = 'SALARY';
  } else if (/bensin|gojek|grab|e-toll|parkir|transport|servis|angkot|busway|pertamax|pertalite/i.test(lower)) {
    category = 'TRANSPORT';
  } else if (/listrik|wifi|pulsa|air|pdam|kos|kontrakan|tagihan|pln|indihome|token/i.test(lower)) {
    category = 'BILLS';
  } else if (/baju|sepatu|nonton|bioskop|shopee|tokopedia|game|skin|gadget|shopping|liburan|traktir/i.test(lower)) {
    category = 'SHOPPING';
  } else if (/investasi|saham|reksadana|crypto|tabung|emas|deposito/i.test(lower)) {
    category = 'INVESTMENT';
  } else {
    category = 'FOOD';
  }

  // 5. Clean Title Extraction
  const walletPattern = activeWallets.join('|');
  const walletRegex = new RegExp(`\\b(${walletPattern})\\b`, 'gi');

  let title = cleaned
    .replace(amountRegex, '')
    .replace(walletRegex, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title || title.length < 2) title = isIncome ? 'Pemasukan' : 'Pengeluaran Harian';
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    title, amount: Math.round(amount), type, category, wallet,
    date: new Date().toISOString()
  };
}

function broadcast(event, payload) {
  const msg = JSON.stringify({ event, payload });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    event: 'INIT_STATE',
    payload: {
      transactions,
      settings,
      summary: getSummary(),
      waStatus: waConnectionStatus,
      qrCode: currentQrCode,
      supabaseConnected
    }
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      if (data.event === 'ADD_TRANSACTION') {
        await addTransaction(data.payload);
      } else if (data.event === 'DELETE_TRANSACTION') {
        await deleteTransaction(data.payload);
      } else if (data.event === 'UPDATE_WALLETS') {
        if (Array.isArray(data.payload)) {
          settings.wallets = data.payload.map(w => w.toUpperCase().trim()).filter(Boolean);
          saveDataLocal();
          broadcast('STATE_UPDATE', { transactions, summary: getSummary(), settings });
        }
      } else if (data.event === 'PARSE_TEXT') {
        let text = data.payload || '';
        const tx = parseNLText(text);
        if (tx) await addTransaction(tx);
      }
    } catch (e) {
      console.error('WS Message error:', e);
    }
  });
});

// ==========================================
// 3. BAILEYS WHATSAPP BOT ENGINE & OCR SCANNER
// ==========================================
let waSocket = null;
let waConnectionStatus = 'DISCONNECTED';
let currentQrCode = null;

async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  waSocket = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  waSocket.ev.on('creds.update', saveCreds);

  waSocket.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQrCode = qr;
      waConnectionStatus = 'SCAN_QR_REQUIRED';
      console.log('\n==================================================');
      console.log('📱 SCAN THIS QR CODE IN YOUR WHATSAPP TO CONNECT:');
      qrcodeTerm.generate(qr, { small: true });
      console.log('==================================================\n');
      broadcast('WA_STATUS', { status: waConnectionStatus, qr });
    }

    if (connection === 'open') {
      currentQrCode = null;
      waConnectionStatus = 'CONNECTED';
      console.log('✅ WHATSAPP BOT CONNECTED & READY!');
      broadcast('WA_STATUS', { status: 'CONNECTED' });
    }

    if (connection === 'close') {
      waConnectionStatus = 'DISCONNECTED';
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      broadcast('WA_STATUS', { status: 'DISCONNECTED' });
      if (shouldReconnect) {
        setTimeout(startWhatsAppBot, 3000);
      }
    }
  });

  waSocket.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages[0];
      if (!msg || !msg.message) return;

      const remoteJid = msg.key.remoteJid || '';

      // ⛔ IGNORE ALL WHATSAPP CHANNELS / NEWSLETTERS / ANNOUNCEMENTS
      if (remoteJid.endsWith('@newsletter') || remoteJid.includes('newsletter') || remoteJid.endsWith('@broadcast')) {
        return;
      }

      let conversationText = 
        msg.message.conversation || 
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption;

      if (!conversationText) return;

      const trimmedText = conversationText.trim();
      const lowerTrimmed = trimmedText.toLowerCase();

      // 🔒 MUST START WITH "!y"
      if (!lowerTrimmed.startsWith('!y')) {
        return;
      }

      const hasColon = lowerTrimmed.startsWith('!y:');
      let cleanText = hasColon ? trimmedText.slice(3).trim() : trimmedText.slice(2).trim();
      const lowerClean = cleanText.toLowerCase();

      // 📊 COMMAND 1: "!y total" or "!y summary" (SYSTEM SUMMARY)
      if (!hasColon && (lowerClean === 'total' || lowerClean === 'summary')) {
        const summary = getSummary();
        const formatRp = (num) => 'Rp ' + Number(num).toLocaleString('id-ID');
        const wb = summary.walletBalances || {};

        let walletLines = Object.keys(wb).map(w => `• ${w}: ${formatRp(wb[w])}`).join('\n');

        const summaryCard = 
`📊 *SUMMARY WEALTH RADAR ID*
----------------------------------
💰 *Total Net Worth:* ${formatRp(summary.netWorth)}
📥 *Total Inflow:* ${formatRp(summary.totalIncome)}
📤 *Total Outflow:* ${formatRp(summary.totalExpense)}
💚 *Financial Health Score:* ${summary.score}/100 [${summary.healthBadge}]

🎯 *50/30/20 BUDGET RADAR:*
• *Needs (50%):* ${formatRp(summary.needsSpent)} (${summary.needsPct}%)
• *Wants (30%):* ${formatRp(summary.wantsSpent)} (${summary.wantsPct}%)
• *Savings (20%):* ${formatRp(summary.savingsSpent)} (${summary.savingsPct}%)

💳 *SALDO MULTI-DOMPET:*
${walletLines}
----------------------------------`;

        await waSocket.sendMessage(msg.key.remoteJid, { text: summaryCard });
        return;
      }

      // 💳 COMMAND 2: "!y dompet" or "!y wallet" or "!y saldo" (ALL WALLETS BREAKDOWN)
      if (!hasColon && (lowerClean === 'dompet' || lowerClean === 'dompetku' || lowerClean === 'wallet' || lowerClean === 'saldo')) {
        const summary = getSummary();
        const formatRp = (num) => 'Rp ' + Number(num).toLocaleString('id-ID');
        const wb = summary.walletBalances || {};

        let walletLines = Object.keys(wb).map(w => `• *${w}:* ${formatRp(wb[w])}`).join('\n');

        const walletCard = 
`💳 *RINCIAN SALDO MULTI-DOMPET*
----------------------------------
${walletLines}
----------------------------------
💰 *Total Net Worth:* ${formatRp(summary.netWorth)}
_Wealth Radar ID System_`;

        await waSocket.sendMessage(msg.key.remoteJid, { text: walletCard });
        return;
      }

      // ❓ COMMAND 3: "!y help" or "!y menu" or "!y panduan"
      if (!hasColon && (lowerClean === 'help' || lowerClean === 'menu' || lowerClean === 'panduan' || lowerClean === 'bantuan')) {
        const helpCard = 
`📖 *PANDUAN COMMAND WEALTH RADAR ID*
----------------------------------
✏️ *Catat Transaksi (Wajib pakai :):*
• \`!y: bca Dapat transferan 500rb\` (Inflow)
• \`!y: gopay Beli kopi 25rb\` (Outflow)

📊 *Laporan & Cek Saldo:*
• \`!y total\` ➔ Summary Net Worth & Budget Radar
• \`!y dompet\` ➔ Saldo semua dompet digital & bank
• \`!y bca\` ➔ Cek khusus saldo dompet BCA
• \`!y bulan\` ➔ Rekap pengeluaran bulan ini
• \`!y cat\` ➔ Breakdown pengeluaran per kategori

↩️ *Hapus Transaksi:*
• \`!y undo\` ➔ Batalkan transaksi terakhir
----------------------------------
_Wealth Radar ID System_`;

        await waSocket.sendMessage(msg.key.remoteJid, { text: helpCard });
        return;
      }

      // ↩️ COMMAND 4: "!y undo" or "!y hapus" or "!y batal"
      if (!hasColon && (lowerClean === 'undo' || lowerClean === 'hapus' || lowerClean === 'batal')) {
        if (transactions.length === 0) {
          await waSocket.sendMessage(msg.key.remoteJid, { text: '⚠️ Belum ada transaksi yang bisa dihapus.' });
          return;
        }

        const lastTx = transactions[0];
        await deleteTransaction(lastTx.id);

        const formatRp = (num) => 'Rp ' + Number(num).toLocaleString('id-ID');
        const undoCard = 
`🗑️ *TRANSAKSI TERAKHIR DIBATALKAN!*
----------------------------------
📌 *Item Dihapus:* ${lastTx.title}
💰 *Nominal:* ${formatRp(lastTx.amount)}
💳 *Dompet:* ${lastTx.wallet}
----------------------------------
_Wealth Radar ID System_`;

        await waSocket.sendMessage(msg.key.remoteJid, { text: undoCard });
        return;
      }

      // 📅 COMMAND 5: "!y bulan" or "!y month" or "!y rekap"
      if (!hasColon && (lowerClean === 'bulan' || lowerClean === 'month' || lowerClean === 'rekap')) {
        const summary = getSummary();
        const formatRp = (num) => 'Rp ' + Number(num).toLocaleString('id-ID');

        const catTotals = { FOOD: 0, TRANSPORT: 0, BILLS: 0, SHOPPING: 0, INVESTMENT: 0 };
        transactions.forEach(t => {
          if (t.type === 'EXPENSE' && catTotals.hasOwnProperty(t.category)) {
            catTotals[t.category] += Number(t.amount) || 0;
          }
        });

        let topCat = 'FOOD';
        let topAmt = 0;
        Object.keys(catTotals).forEach(c => {
          if (catTotals[c] > topAmt) {
            topAmt = catTotals[c];
            topCat = c;
          }
        });

        const monthCard = 
`📅 *REKAP BULAN INI*
----------------------------------
📥 *Pemasukan Bulan Ini:* ${formatRp(summary.totalIncome)}
📤 *Pengeluaran Bulan Ini:* ${formatRp(summary.totalExpense)}
💵 *Net Savings:* ${formatRp(summary.netWorth)}

🔥 *Kategori Paling Boros:*
• *${topCat}:* ${formatRp(topAmt)}
----------------------------------
💚 *Health Score:* ${summary.score}/100 [${summary.healthBadge}]`;

        await waSocket.sendMessage(msg.key.remoteJid, { text: monthCard });
        return;
      }

      // 🏷️ COMMAND 6: "!y cat" or "!y kategori" or "!y category"
      if (!hasColon && (lowerClean === 'cat' || lowerClean === 'kategori' || lowerClean === 'category')) {
        const formatRp = (num) => 'Rp ' + Number(num).toLocaleString('id-ID');
        const catTotals = { FOOD: 0, TRANSPORT: 0, BILLS: 0, SHOPPING: 0, INVESTMENT: 0 };

        transactions.forEach(t => {
          if (t.type === 'EXPENSE' && catTotals.hasOwnProperty(t.category)) {
            catTotals[t.category] += Number(t.amount) || 0;
          }
        });

        const catCard = 
`🏷️ *RINCIAN PENGELUARAN PER KATEGORI*
----------------------------------
🍔 *Food & Drink:* ${formatRp(catTotals.FOOD)}
🚗 *Transportasi:* ${formatRp(catTotals.TRANSPORT)}
💡 *Bills & Tagihan:* ${formatRp(catTotals.BILLS)}
🛍️ *Shopping & Gaya Hidup:* ${formatRp(catTotals.SHOPPING)}
📈 *Investasi & Tabungan:* ${formatRp(catTotals.INVESTMENT)}
----------------------------------
_Wealth Radar ID System_`;

        await waSocket.sendMessage(msg.key.remoteJid, { text: catCard });
        return;
      }

      // 💳 COMMAND 7: "!y [NAMA DOMPET]" (TARGETED SPECIFIC WALLET CHECK, e.g. "!y bca", "!y gopay", "!y mandiri")
      const activeWallets = settings.wallets || ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'];
      const matchedWallet = activeWallets.find(w => w.toLowerCase() === lowerClean);

      if (!hasColon && matchedWallet) {
        const targetW = matchedWallet.toUpperCase();
        const summary = getSummary();
        const formatRp = (num) => 'Rp ' + Number(num).toLocaleString('id-ID');
        const currentBalance = summary.walletBalances[targetW] || 0;

        let walletInflow = 0;
        let walletOutflow = 0;
        let walletTxCount = 0;

        transactions.forEach(t => {
          if ((t.wallet || 'CASH').toUpperCase() === targetW) {
            walletTxCount++;
            const amt = Number(t.amount) || 0;
            if (t.type === 'INCOME') walletInflow += amt;
            else walletOutflow += amt;
          }
        });

        const walletSingleCard = 
`💳 *SALDO DOMPET ${targetW}*
----------------------------------
💰 *Saldo Saat Ini:* ${formatRp(currentBalance)}
📥 *Total Inflow:* ${formatRp(walletInflow)}
📤 *Total Outflow:* ${formatRp(walletOutflow)}
📊 *Total Transaksi:* ${walletTxCount} Transaksi
----------------------------------
_Wealth Radar ID System_`;

        await waSocket.sendMessage(msg.key.remoteJid, { text: walletSingleCard });
        return;
      }

      // 🔒 STRICT RULE FOR LOGGING TRANSACTIONS: MUST HAVE COLON (`!y:`)
      const isImage = Boolean(msg.message.imageMessage);
      if (!hasColon && !isImage) {
        return; // Ignore transaction logging attempts that do not use `!y:`
      }

      if (!cleanText && !isImage) return;

      console.log(`📩 WA Transaction Logging Received (!y:): "${cleanText}"`);

      const tx = parseNLText(cleanText);
      if (tx) {
        if (isImage) tx.title = '[OCR Struk] ' + tx.title;

        await addTransaction(tx);
        const summary = getSummary();
        const formatRp = (num) => 'Rp ' + Number(num).toLocaleString('id-ID');

        let alertSection = '';
        if (tx.type === 'EXPENSE') {
          if (summary.wantsPct >= 100) {
            alertSection = `\n🚨 *BUDGET OVERLIMIT!* Budget WANTS melebih 100%! (${formatRp(summary.wantsSpent)} / ${formatRp(summary.wantsLimit)})`;
          } else if (summary.wantsPct >= 80) {
            alertSection = `\n⚠️ *PERINGATAN BUDGET!* Budget WANTS mencapai ${summary.wantsPct}%! (${formatRp(summary.wantsSpent)} / ${formatRp(summary.wantsLimit)})`;
          }
        }

        const typeIcon = tx.type === 'INCOME' ? '📥 PEMASUKAN' : '📤 PENGELUARAN';

        const replyMessage = 
`✅ *TRANSAKSI DICATAT (${typeIcon})!*
----------------------------------
📌 *Item:* ${tx.title}
💰 *Nominal:* ${formatRp(tx.amount)}
💳 *Dompet/Bank:* ${tx.wallet}
🏷️ *Kategori:* ${tx.category} (${tx.type})
${alertSection}
📊 *Status Net Worth:* ${formatRp(summary.netWorth)}
💚 *Financial Health Score:* ${summary.score}/100 [${summary.healthBadge}]
----------------------------------
_Wealth Radar ID System_`;

        await waSocket.sendMessage(msg.key.remoteJid, { text: replyMessage });
      }
    } catch (e) {
      console.error('Error handling WA message:', e);
    }
  });
}

// REST API
app.get('/api/transactions', async (req, res) => {
  res.json({ transactions, summary: getSummary(), settings, waStatus: waConnectionStatus, supabaseConnected });
});

loadData().then(() => {
  server.listen(APP_PORT, () => {
    console.log(`\n🚀 WEALTH RADAR ID SERVER (ALL 4 NEW WA COMMANDS ADDED) AT http://localhost:${APP_PORT}`);
    startWhatsAppBot().catch(err => console.error('Failed to launch WA Bot:', err));
  });
});
