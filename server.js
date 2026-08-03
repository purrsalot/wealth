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
app.use(express.static(__dirname));

// Express Root Route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

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

// WebSocket Server (For local environment)
let wss = null;
let server = null;

if (!process.env.VERCEL) {
  server = http.createServer(app);
  wss = new WebSocket.Server({ server });

  function broadcast(event, payload) {
    if (!wss) return;
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
      payload: { transactions, settings, summary: getSummary(), supabaseConnected }
    }));
  });

  // Start WhatsApp Bot locally
  try {
    const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
    const qrcodeTerm = require('qrcode-terminal');

    async function startWhatsAppBot() {
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const waSocket = makeWASocket({ auth: state, printQRInTerminal: false });
      waSocket.ev.on('creds.update', saveCreds);
      waSocket.ev.on('connection.update', (update) => {
        if (update.qr) qrcodeTerm.generate(update.qr, { small: true });
        if (update.connection === 'open') console.log('✅ WHATSAPP BOT CONNECTED LOCAL!');
      });
    }

    loadData().then(() => {
      server.listen(APP_PORT, () => {
        console.log(`🚀 WEALTH RADAR ID SERVER AT http://localhost:${APP_PORT}`);
        startWhatsAppBot().catch(e => console.warn('WA Bot notice:', e.message));
      });
    });
  } catch (e) {
    console.warn('Baileys skipped locally or missing:', e.message);
  }
} else {
  // Pre-load data for serverless invocations
  loadData();
}

function broadcast(event, payload) {}

module.exports = app;
