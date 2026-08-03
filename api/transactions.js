const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://alpxljvkcwtjywskyzie.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFscHhsanZrY3d0anl3c2t5emllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NzM4NDAsImV4cCI6MjEwMTM0OTg0MH0.du58Vf0d20u2g7eqxLFP8NPGlN5KGATU3LH7vTNN0Uc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// HELPER: Calculate summary from transactions
// ==========================================
function calcSummary(transactions) {
  let totalIncome = 0, totalExpense = 0;
  let needsSpent = 0, wantsSpent = 0, savingsSpent = 0;
  const walletBalances = { BCA: 0, MANDIRI: 0, GOPAY: 0, OVO: 0, SHOPEEPAY: 0, DANA: 0, CASH: 0 };

  transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    const w = (t.wallet || 'CASH').toUpperCase();
    if (!walletBalances.hasOwnProperty(w)) walletBalances[w] = 0;

    if (t.type === 'INCOME') {
      totalIncome += amt;
      walletBalances[w] += amt;
    } else {
      totalExpense += amt;
      walletBalances[w] -= amt;
      if (['FOOD', 'TRANSPORT', 'BILLS'].includes(t.category)) needsSpent += amt;
      else if (t.category === 'SHOPPING') wantsSpent += amt;
      else if (t.category === 'INVESTMENT') savingsSpent += amt;
      else needsSpent += amt;
    }
  });

  const netWorth = totalIncome - totalExpense;
  const baseTarget = 10000000;
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
// HELPER: Parse natural language input (!y:)
// ==========================================
function parseTransaction(text) {
  const walletPatterns = ['bca', 'mandiri', 'gopay', 'ovo', 'shopeepay', 'dana', 'cash'];
  const incomeKeywords = ['dapat', 'terima', 'gaji', 'bonus', 'transfer masuk', 'freelance', 'salary'];
  const categoryMap = {
    FOOD: ['makan', 'kopi', 'ayam', 'nasi', 'snack', 'jajan', 'warteg', 'bakso', 'mie', 'pizza', 'burger', 'starbucks', 'chatime', 'indomie', 'gorengan', 'sate', 'soto', 'rendang'],
    TRANSPORT: ['grab', 'gojek', 'bensin', 'pertamax', 'parkir', 'tol', 'ojol', 'taxi', 'bus', 'kereta', 'mrt', 'lrt'],
    BILLS: ['listrik', 'pln', 'wifi', 'indihome', 'pulsa', 'internet', 'air', 'pdam', 'gas', 'iuran', 'sewa', 'kos'],
    SHOPPING: ['beli', 'baju', 'celana', 'sepatu', 'tas', 'gadget', 'hp', 'laptop', 'elektronik', 'shopee', 'tokped', 'lazada'],
    INVESTMENT: ['invest', 'saham', 'reksadana', 'crypto', 'bitcoin', 'tabung', 'deposito', 'emas', 'nabung']
  };

  const lower = text.toLowerCase().replace(/!y:\s*/i, '').trim();

  // Extract wallet
  let wallet = 'CASH';
  for (const w of walletPatterns) {
    if (lower.includes(w)) { wallet = w.toUpperCase(); break; }
  }

  // Extract amount
  let amount = 0;
  const amtMatch = lower.match(/(\d+[\.,]?\d*)\s*(rb|ribu|k|jt|juta|m)?/i);
  if (amtMatch) {
    amount = parseFloat(amtMatch[1].replace(',', '.'));
    const unit = (amtMatch[2] || '').toLowerCase();
    if (unit === 'rb' || unit === 'ribu' || unit === 'k') amount *= 1000;
    else if (unit === 'jt' || unit === 'juta' || unit === 'm') amount *= 1000000;
  }

  // Detect type
  let type = 'EXPENSE';
  for (const kw of incomeKeywords) {
    if (lower.includes(kw)) { type = 'INCOME'; break; }
  }

  // Detect category
  let category = type === 'INCOME' ? 'SALARY' : 'FOOD';
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) { category = cat; break; }
    }
  }

  // Build title
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
// MAIN HANDLER: GET / POST / DELETE
// ==========================================
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // ========== GET: Read all transactions ==========
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      const transactions = (data && data.length > 0) ? data : [];

      return res.status(200).json({
        transactions,
        summary: calcSummary(transactions),
        settings: { wallets: ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'] },
        supabaseConnected: true
      });
    }

    // ========== POST: Create transaction ==========
    if (req.method === 'POST') {
      const body = req.body || {};

      let tx;
      if (body.rawText) {
        // Natural language parse (like !y: bca 50k ayam)
        tx = parseTransaction(body.rawText);
      } else {
        // Direct transaction object
        tx = {
          id: body.id || 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          title: body.title || 'Transaksi',
          amount: Number(body.amount) || 0,
          type: body.type || 'EXPENSE',
          category: body.category || 'FOOD',
          wallet: (body.wallet || 'CASH').toUpperCase(),
          date: body.date || new Date().toISOString()
        };
      }

      // Insert to Supabase
      const { error } = await supabase.from('transactions').insert([tx]);
      if (error) {
        // Retry without wallet column if it doesn't exist
        const { id, title, amount, type, category, date } = tx;
        await supabase.from('transactions').insert([{ id, title, amount, type, category, date }]);
      }

      // Re-fetch all transactions
      const { data: allData } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      const transactions = allData || [];

      return res.status(201).json({
        success: true,
        created: tx,
        transactions,
        summary: calcSummary(transactions),
        settings: { wallets: ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'] },
        supabaseConnected: true
      });
    }

    // ========== DELETE: Remove transaction ==========
    if (req.method === 'DELETE') {
      const id = req.query.id || (req.body && req.body.id);
      if (!id) return res.status(400).json({ error: 'Missing transaction id' });

      await supabase.from('transactions').delete().eq('id', id);

      // Re-fetch all transactions
      const { data: allData } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false });

      const transactions = allData || [];

      return res.status(200).json({
        success: true,
        deleted: id,
        transactions,
        summary: calcSummary(transactions),
        settings: { wallets: ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'] },
        supabaseConnected: true
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
