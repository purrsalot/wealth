const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://alpxljvkcwtjywskyzie.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFscHhsanZrY3d0anl3c2t5emllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NzM4NDAsImV4cCI6MjEwMTM0OTg0MH0.du58Vf0d20u2g7eqxLFP8NPGlN5KGATU3LH7vTNN0Uc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8313537990:AAG3GqhS4Lj3yQQfSSGButWG3X-Xz3BZE3E';

// ==========================================
// PARSER & SUMMARY HELPERS
// ==========================================
function parseTransactionFromText(text) {
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
    FOOD: ['makan', 'mkn', 'minum', 'mnm', 'kopi', 'ngopi', 'ayam', 'nasi', 'snack', 'jajan', 'ngemil', 'warteg', 'bakso', 'bso', 'mie', 'pizza', 'burger', 'starbucks', 'indomie', 'gorengan', 'sate', 'soto', 'resto', 'kafe', 'cafe', 'es', 'kuliner', 'seblak', 'boba', 'martabak', 'geprek'],
    TRANSPORT: ['grab', 'gojek', 'bensin', 'bsn', 'pertamax', 'pertalite', 'parkir', 'parkiran', 'tol', 'ojol', 'taxi', 'bus', 'kereta', 'mrt', 'lrt', 'service', 'servis', 'oli', 'ban', 'tambal', 'angkot', 'maxim', 'indrive'],
    BILLS: ['listrik', 'pln', 'wifi', 'indihome', 'biznet', 'myrepublic', 'pulsa', 'internet', 'air', 'pdam', 'gas', 'sewa', 'kos', 'kost', 'kontrakan', 'bpjs', 'pajak', 'asuransi', 'langganan', 'tagihan', 'laundry'],
    SHOPPING: ['beli', 'baju', 'kaos', 'jaket', 'celana', 'sepatu', 'tas', 'gadget', 'hp', 'laptop', 'shopee', 'tokped', 'tokopedia', 'lazada', 'blibli', 'buku', 'belanja', 'supermarket', 'skincare', 'makeup', 'helm', 'helem'],
    INVESTMENT: ['invest', 'saham', 'reksadana', 'crypto', 'tabung', 'deposito', 'emas', 'nabung', 'bibit', 'pintu', 'sekuritas'],
    SALARY: ['gaji', 'salary', 'freelance', 'bonus', 'thr', 'proyek', 'gajian'],
    ENTERTAINMENT: ['nonton', 'bioskop', 'game', 'steam', 'netflix', 'spotify', 'youtube', 'konser', 'tiket', 'rekreasi', 'liburan'],
    HEALTH: ['obat', 'dokter', 'apotek', 'rs', 'rumah sakit', 'vitamin', 'gym', 'sehat', 'fitnes']
  };

  const lower = text.toLowerCase().replace(/!y:\s*/i, '').trim();
  if (!lower) return null;

  let amount = 0;
  let amountRawMatch = '';
  const amtMatch = lower.match(/(\d+(?:[\.,]\d+)*)\s*(rb|ribu|rbn|k|jt|juta|m|miliar|milyar|b)?/i);
  if (amtMatch) {
    amountRawMatch = amtMatch[0];
    let numStr = amtMatch[1];
    if (numStr.includes('.') && numStr.includes(',')) {
      numStr = numStr.replace(/\./g, '').replace(',', '.');
    } else if (numStr.includes('.')) {
      const parts = numStr.split('.');
      if (parts.every((p, idx) => idx === 0 || p.length === 3)) {
        numStr = numStr.replace(/\./g, '');
      }
    } else if (numStr.includes(',')) {
      numStr = numStr.replace(',', '.');
    }
    amount = Math.round(parseFloat(numStr) || 0);
    const unit = (amtMatch[2] || '').toLowerCase();
    if (unit === 'rb' || unit === 'ribu' || unit === 'rbn' || unit === 'k') amount *= 1000;
    else if (unit === 'jt' || unit === 'juta' || unit === 'm') amount *= 1000000;
    else if (unit === 'miliar' || unit === 'milyar' || unit === 'b') amount *= 1000000000;
  }

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

  let category = null;
  if (lower.includes('uang jajan') || lower.includes('sangu')) {
    category = 'FAMILY';
  } else {
    for (const [cat, keywords] of Object.entries(categoryMap)) {
      for (const kw of keywords) {
        const catRegex = new RegExp(`\\b${kw}\\b`, 'i');
        if (catRegex.test(lower)) { category = cat; break; }
      }
      if (category) break;
    }
  }
  if (!category) category = type === 'INCOME' ? 'SALARY' : 'FOOD';

  let titleClean = lower;
  if (amountRawMatch) titleClean = titleClean.replace(amountRawMatch, '');
  if (matchedWalletWord) titleClean = titleClean.replace(new RegExp(`\\b${matchedWalletWord}\\b`, 'gi'), '');
  const noiseWords = ['!y:', '!y', 'di', 'ke', 'pada', 'untuk', 'yang', 'dengan', 'dan', 'sama', 'via', 'pakai', 'lewat'];
  noiseWords.forEach(nw => { titleClean = titleClean.replace(new RegExp(`\\b${nw}\\b`, 'gi'), ''); });

  titleClean = titleClean.replace(/\s+/g, ' ').trim();
  let title = titleClean.charAt(0).toUpperCase() + titleClean.slice(1);
  if (!title || title.length < 2) title = type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran';

  return {
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    title, amount, type, category, wallet,
    date: new Date().toISOString()
  };
}

async function sendTelegramMessage(chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown'
      })
    });
  } catch (e) {
    console.error('Failed to send Telegram message:', e);
  }
}

async function sendTelegramDocument(chatId, filename, csvContent, captionText) {
  try {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).slice(2);
    let body = '';

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`;

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="caption"\r\n\r\n${captionText}\r\n`;

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="parse_mode"\r\n\r\nMarkdown\r\n`;

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="document"; filename="${filename}"\r\n`;
    body += `Content-Type: text/csv\r\n\r\n`;
    body += `${csvContent}\r\n`;
    body += `--${boundary}\r\n--`;

    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: body
    });
  } catch (e) {
    console.error('Failed to send Telegram document:', e);
  }
}

// ==========================================
// VERCEL SERVERLESS HANDLER
// ==========================================
module.exports = async function handler(req, res) {
  // Option to auto-set Telegram Webhook URL
  if (req.method === 'GET' && req.query.setWebhook) {
    const host = req.headers.host;
    const webhookUrl = `https://${host}/api/telegram`;
    const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const tgData = await tgRes.json();
    return res.json({ success: true, webhookUrl, telegramResponse: tgData });
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'KAEL Telegram Webhook Serverless Ready' });
  }

  try {
    const body = req.body || {};
    const message = body.message || body.edited_message;
    if (!message) return res.status(200).json({ ok: true });

    const chatId = message.chat.id;
    const text = message.text || message.caption || '';
    if (!text) return res.status(200).json({ ok: true });

    const lower = text.toLowerCase().trim();

    // 1. Menu / Help / Start
    if (lower === '/start' || lower === '/help' || lower === '/menu' || lower === 'kael' || lower === '!y' || lower === '!y help') {
      await sendTelegramMessage(chatId,
        `✨ *HALO BOSS! AKU KAEL - ASISTEN KEUANGAN PRIBADI KAMU!* 🤖💰\n\n` +
        `*Catat Bebas* ➔ Ketik biasa tanpa ribet, contoh:\n` +
        `• _bca 50k makan siang_\n` +
        `• _dapat uang jajan 356.381 di bca_\n` +
        `• _kevin bayar 300k_\n\n` +
        `⚡ *Perintah Slash Telegram KAEL*:\n` +
        `• */archive* atau */export* ➔ Export 15 hari ke CSV & bersihkan Cloud DB\n` +
        `• */report* ➔ Laporan rekap keuangan\n` +
        `• */sisa* atau */budget* ➔ Hitung budget aman harian\n` +
        `• */budget 15jt* ➔ Set target budget bulanan\n` +
        `• */piutang* ➔ Catatan utang & pinjaman\n` +
        `• */tf 500k bca ke gopay* ➔ Pindah saldo antar dompet\n` +
        `• */saldo bca 5jt* ➔ Set saldo awal dompet\n` +
        `• */undo* ➔ Batal / hapus transaksi terakhir\n` +
        `• */reset* ➔ Reset total income & expense ke 0`
      );
      return res.status(200).json({ ok: true });
    }

    // Archive & Export CSV (/archive, /export, /backup)
    if (lower === '/archive' || lower === '/export' || lower === '/backup' || lower === '!y archive' || lower === '!y export') {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const { data: oldTx } = await supabase.from('transactions').select('*').lte('date', fifteenDaysAgo).order('date', { ascending: true });

      if (!oldTx || oldTx.length === 0) {
        const { data: allTx } = await supabase.from('transactions').select('*').order('date', { ascending: true });
        if (!allTx || allTx.length === 0) {
          await sendTelegramMessage(chatId, '❌ Tidak ada transaksi untuk diarsip saat ini.');
          return res.status(200).json({ ok: true });
        }

        let csv = 'ID,Tanggal,Judul,Jenis,Kategori,Dompet,Nominal\n';
        allTx.forEach(t => {
          const dateStr = new Date(t.date).toLocaleString('id-ID');
          const titleEsc = `"${(t.title || '').replace(/"/g, '""')}"`;
          csv += `${t.id},${dateStr},${titleEsc},${t.type},${t.category},${t.wallet},${t.amount}\n`;
        });

        const dateTag = new Date().toISOString().slice(0, 10);
        const filename = `arsip_keuangan_kael_${dateTag}.csv`;
        const caption = `📄 *ARSIP EXCEL/CSV KEUANGAN KAEL* 🤖\n\n` +
          `Total *${allTx.length} transaksi* telah diexport ke CSV!\n` +
          `ℹ️ _Belum ada transaksi berusia >15 hari untuk dihapus dari Cloud DB._`;

        await sendTelegramDocument(chatId, filename, csv, caption);
        return res.status(200).json({ ok: true });
      }

      let csv = 'ID,Tanggal,Judul,Jenis,Kategori,Dompet,Nominal\n';
      const idsToDelete = [];
      oldTx.forEach(t => {
        idsToDelete.push(t.id);
        const dateStr = new Date(t.date).toLocaleString('id-ID');
        const titleEsc = `"${(t.title || '').replace(/"/g, '""')}"`;
        csv += `${t.id},${dateStr},${titleEsc},${t.type},${t.category},${t.wallet},${t.amount}\n`;
      });

      await supabase.from('transactions').delete().in('id', idsToDelete);

      const dateTag = new Date().toISOString().slice(0, 10);
      const filename = `arsip_15hari_kael_${dateTag}.csv`;
      const caption = `📦 *ARSIP KEUANGAN 15 HARIAN BY KAEL* 🤖\n\n` +
        `📄 Total *${oldTx.length} transaksi* (>15 hari) telah berhasil diexport ke file CSV/Excel di atas.\n` +
        `🧹 Transaksi lama tersebut otomatis dibersihkan dari Cloud DB agar DB tetap ultra-ringan!`;

      await sendTelegramDocument(chatId, filename, csv, caption);
      return res.status(200).json({ ok: true });
    }

    // 2. Report (/report atau !y report)
    if (lower === '/report' || lower === '!y report') {
      const { data: allData } = await supabase.from('transactions').select('*');
      let totalInc = 0, totalExp = 0;
      (allData || []).forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'INCOME') totalInc += amt;
        else totalExp += amt;
      });
      const netWorth = totalInc - totalExp;

      await sendTelegramMessage(chatId,
        `*📊 LAPORAN KEUANGAN KAEL* 🤖\n\n` +
        `💰 *Total Net Worth*: Rp ${netWorth.toLocaleString('id-ID')}\n` +
        `📈 Total Pemasukan: Rp ${totalInc.toLocaleString('id-ID')}\n` +
        `📉 Total Pengeluaran: Rp ${totalExp.toLocaleString('id-ID')}\n\n` +
        `✨ *Pesan KAEL*: Tetap jaga kestabilan finansialmu boss! 🔥`
      );
      return res.status(200).json({ ok: true });
    }

    // 3. Budget Calculator & Target (/sisa, /budget, !y sisa, !y budget)
    if (lower.startsWith('/budget ') || lower.startsWith('!y budget ') || lower.startsWith('/target ') || lower.startsWith('!y target ')) {
      const amtMatch = lower.match(/(\d+[\.,]?\d*)\s*(rb|ribu|k|jt|juta|m)?/i);
      if (amtMatch) {
        let newTarget = parseFloat(amtMatch[1].replace(',', '.'));
        const unit = (amtMatch[2] || '').toLowerCase();
        if (unit === 'rb' || unit === 'ribu' || unit === 'k') newTarget *= 1000;
        else if (unit === 'jt' || unit === 'juta' || unit === 'm') newTarget *= 1000000;

        await sendTelegramMessage(chatId,
          `🎯 *TARGET BUDGET BULANAN DISET BY KAEL!* 🤖\n\n` +
          `💰 Nominal Target Income Bulanan: Rp ${newTarget.toLocaleString('id-ID')}\n` +
          `🛡️ Limit Needs (50%): Rp ${(newTarget * 0.5).toLocaleString('id-ID')}\n` +
          `🛍️ Limit Wants (30%): Rp ${(newTarget * 0.3).toLocaleString('id-ID')}\n` +
          `💎 Limit Savings (20%): Rp ${(newTarget * 0.2).toLocaleString('id-ID')}\n\n` +
          `✅ Target Set!`
        );
        return res.status(200).json({ ok: true });
      }
    }

    if (lower === '/sisa' || lower === '/budget' || lower === '!y sisa' || lower === '!y budget') {
      const now = new Date();
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const remainingDays = Math.max(1, lastDayOfMonth - now.getDate() + 1);

      const { data: allData } = await supabase.from('transactions').select('*');
      let inc = 0, exp = 0;
      (allData || []).forEach(t => {
        const amt = Number(t.amount) || 0;
        if (t.type === 'INCOME') inc += amt;
        else exp += amt;
      });
      const remainingMoney = inc - exp;
      const safeDaily = Math.max(0, Math.floor(remainingMoney / remainingDays));

      await sendTelegramMessage(chatId,
        `*🧮 KALKULATOR BUDGET BULANAN BY KAEL* 🤖\n\n` +
        `💰 Sisa Uang Bulan Ini: Rp ${remainingMoney.toLocaleString('id-ID')}\n` +
        `📅 Sisa Hari: ${remainingDays} hari lagi\n` +
        `🛡️ *Budget Aman per Hari*: Rp ${safeDaily.toLocaleString('id-ID')}/hari`
      );
      return res.status(200).json({ ok: true });
    }

    // 4. Piutang (/piutang, !y piutang)
    if (lower === '/piutang' || lower === '/utang' || lower === '!y piutang' || lower === '!y utang') {
      const { data: debtTx } = await supabase.from('transactions').select('*').eq('category', 'DEBT').order('date', { ascending: false });
      if (!debtTx || debtTx.length === 0) {
        await sendTelegramMessage(chatId, '🎉 *Bersih!* Tidak ada catatan piutang / utang saat ini.');
        return res.status(200).json({ ok: true });
      }
      let debtMsg = '*📋 DAFTAR CATATAN PIUTANG / UTANG*\n\n';
      debtTx.slice(0, 10).forEach(t => {
        const emoji = t.type === 'INCOME' ? '🟢 Lunas/Terima' : '🔴 Belum Lunas';
        debtMsg += `• ${t.title}: Rp ${Number(t.amount).toLocaleString('id-ID')} (${emoji})\n`;
      });
      await sendTelegramMessage(chatId, debtMsg);
      return res.status(200).json({ ok: true });
    }

    // 5. Undo (/undo, /batal, !y undo, !y batal)
    if (lower === '/undo' || lower === '/batal' || lower === '!y undo' || lower === '!y batal') {
      const { data: latest } = await supabase.from('transactions').select('*').order('date', { ascending: false }).limit(1);
      if (!latest || latest.length === 0) {
        await sendTelegramMessage(chatId, '❌ Tidak ada transaksi untuk dibatalkan.');
        return res.status(200).json({ ok: true });
      }
      const lastTx = latest[0];
      await supabase.from('transactions').delete().eq('id', lastTx.id);
      await sendTelegramMessage(chatId, `🗑️ Transaksi "${lastTx.title}" (Rp ${Number(lastTx.amount).toLocaleString('id-ID')}) berhasil dibatalkan!`);
      return res.status(200).json({ ok: true });
    }

    // 6. Transfer (/tf, /transfer, !y tf)
    if (lower.startsWith('/tf') || lower.startsWith('/transfer') || lower.startsWith('!y tf') || lower.startsWith('!y transfer') || lower.startsWith('pindah ')) {
      const walletList = ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'];
      const amtMatch = lower.match(/(\d+[\.,]?\d*)\s*(rb|ribu|k|jt|juta|m)?/i);
      if (!amtMatch) {
        await sendTelegramMessage(chatId, '❌ Format transfer: /tf 500k bca ke gopay');
        return res.status(200).json({ ok: true });
      }
      let amount = parseFloat(amtMatch[1].replace(',', '.'));
      const unit = (amtMatch[2] || '').toLowerCase();
      if (unit === 'rb' || unit === 'ribu' || unit === 'k') amount *= 1000;
      else if (unit === 'jt' || unit === 'juta' || unit === 'm') amount *= 1000000;

      const foundWallets = walletList.filter(w => lower.includes(w.toLowerCase()));
      const fromW = foundWallets[0] || 'BCA';
      const toW = foundWallets[1] || 'GOPAY';
      const nowIso = new Date().toISOString();

      const txOut = { id: 'tx_' + Date.now() + '_out', title: `Transfer ke ${toW}`, amount, type: 'EXPENSE', category: 'TRANSFER', wallet: fromW, date: nowIso };
      const txIn = { id: 'tx_' + (Date.now() + 1) + '_in', title: `Transfer dari ${fromW}`, amount, type: 'INCOME', category: 'TRANSFER', wallet: toW, date: nowIso };

      await supabase.from('transactions').insert([txOut, txIn]);

      const { data: allData } = await supabase.from('transactions').select('*');
      let totalInc = 0, totalExp = 0;
      const balances = { BCA: 0, MANDIRI: 0, GOPAY: 0, OVO: 0, SHOPEEPAY: 0, DANA: 0, CASH: 0 };
      (allData || []).forEach(t => {
        const w = (t.wallet || 'CASH').toUpperCase();
        const amtVal = Number(t.amount) || 0;
        if (t.type === 'INCOME') { totalInc += amtVal; balances[w] = (balances[w] || 0) + amtVal; }
        else { totalExp += amtVal; balances[w] = (balances[w] || 0) - amtVal; }
      });

      await sendTelegramMessage(chatId,
        `🔄 *TRANSFER ANTAK DOMPET BERHASIL!* 🤖\n\n` +
        `💰 Nominal: Rp ${amount.toLocaleString('id-ID')}\n` +
        `📤 Dari: *${fromW}* (Sisa: Rp ${(balances[fromW] || 0).toLocaleString('id-ID')})\n` +
        `📥 Ke: *${toW}* (Saldo Akhir: Rp ${(balances[toW] || 0).toLocaleString('id-ID')})\n` +
        `💵 *Total Net Worth*: Rp ${(totalInc - totalExp).toLocaleString('id-ID')} (Utuh!)\n\n` +
        `✅ Success`
      );
      return res.status(200).json({ ok: true });
    }

    // 7. Saldo awal (/saldo, !y saldo)
    if (lower.startsWith('/saldo') || lower.startsWith('!y saldo') || lower.startsWith('/set') || lower.startsWith('!y set')) {
      const walletList = ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'];
      const amtMatch = lower.match(/(\d+[\.,]?\d*)\s*(rb|ribu|k|jt|juta|m)?/i);
      if (amtMatch) {
        let newAmt = parseFloat(amtMatch[1].replace(',', '.'));
        const unit = (amtMatch[2] || '').toLowerCase();
        if (unit === 'rb' || unit === 'ribu' || unit === 'k') newAmt *= 1000;
        else if (unit === 'jt' || unit === 'juta' || unit === 'm') newAmt *= 1000000;

        const targetWallet = walletList.find(w => lower.includes(w.toLowerCase())) || 'CASH';
        const seedTx = { id: 'tx_saldo_' + targetWallet.toLowerCase() + '_' + Date.now(), title: `Saldo Awal ${targetWallet}`, amount: newAmt, type: 'INCOME', category: 'SALARY', wallet: targetWallet, date: new Date().toISOString() };
        await supabase.from('transactions').insert([seedTx]);

        await sendTelegramMessage(chatId, `💳 *SALDO AWAL ${targetWallet} BERHASIL DISET!*\n\n💰 Nominal Saldo Awal: Rp ${newAmt.toLocaleString('id-ID')}\n✅ Success`);
        return res.status(200).json({ ok: true });
      }
    }

    // 8. Secret Reset (/reset, !y reset)
    if (lower === '/reset' || lower === '!y reset' || lower === '!y reset confirm') {
      await supabase.from('transactions').delete().neq('id', '0');
      await sendTelegramMessage(chatId,
        `🧹 *RESET TOTAL INCOME & EXPENSE BERHASIL!* 🤖\n\n` +
        `✨ Total pemasukan & pengeluaran telah di-reset ke Rp 0.\n` +
        `👉 *Langkah Selanjutnya*: Ketik _/budget 10jt_ atau _/saldo bca 5jt_ untuk mulai!\n\n` +
        `✅ Clean Slate Ready!`
      );
      return res.status(200).json({ ok: true });
    }

    // Record Natural Transaction
    const tx = parseTransactionFromText(text);
    if (tx && tx.amount > 0) {
      const { id, title, amount, type, category, date, wallet } = tx;
      const taggedTitle = `[${wallet}] ${title}`;

      // Insert to Supabase Cloud DB
      const { error } = await supabase.from('transactions').insert([tx]);
      if (error && error.message.includes('wallet')) {
        await supabase.from('transactions').insert([{ id, title: taggedTitle, amount, type, category, date }]);
      }

      // Fetch all transactions to compute ending balances
      const { data: allData } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      const walletList = ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'];
      let totalInc = 0, totalExp = 0;
      const balances = { BCA: 0, MANDIRI: 0, GOPAY: 0, OVO: 0, SHOPEEPAY: 0, DANA: 0, CASH: 0 };

      (allData || []).forEach(t => {
        let w = t.wallet;
        let tTitle = t.title || '';
        const tagMatch = tTitle.match(/^\[([A-Z]+)\]\s*(.*)$/i);
        if (tagMatch) w = tagMatch[1].toUpperCase();
        if (!w || w === 'CASH') {
          const found = walletList.find(wl => tTitle.toLowerCase().includes(wl.toLowerCase()));
          if (found) w = found;
          else if (!w) w = 'CASH';
        }
        w = w.toUpperCase();
        const amtVal = Number(t.amount) || 0;
        if (!balances.hasOwnProperty(w)) balances[w] = 0;

        if (t.type === 'INCOME') {
          totalInc += amtVal;
          balances[w] += amtVal;
        } else {
          totalExp += amtVal;
          balances[w] -= amtVal;
        }
      });

      const endingWalletBal = balances[tx.wallet] || 0;
      const netWorth = totalInc - totalExp;
      const emoji = tx.type === 'INCOME' ? '📈' : '📉';
      const sign = tx.type === 'INCOME' ? '+' : '-';
      const dateStr = new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

      const commentText = tx.type === 'INCOME' 
        ? `Mantap banget boss! Dompet ${tx.wallet} makin tebal! 🔥`
        : `Siap boss! Pengeluaran dari ${tx.wallet} sudah KAEL catat rapi. 👌`;

      const walletBalText = tx.type === 'INCOME'
        ? `📊 Saldo Akhir *${tx.wallet}*: Rp ${endingWalletBal.toLocaleString('id-ID')} (📈 +Rp ${Number(tx.amount).toLocaleString('id-ID')})`
        : `📊 Sisa Saldo *${tx.wallet}*: Rp ${endingWalletBal.toLocaleString('id-ID')} (📉 -Rp ${Number(tx.amount).toLocaleString('id-ID')})`;

      await sendTelegramMessage(chatId,
        `${emoji} *${tx.type === 'INCOME' ? 'PEMASUKAN' : 'PENGELUARAN'} TERCATAT BY KAEL!* 🤖\n\n` +
        `📝 ${tx.title}\n` +
        `💰 Nominal: ${sign}Rp ${Number(tx.amount).toLocaleString('id-ID')}\n` +
        `💳 Dompet: *${tx.wallet}* | 📂 Kategori: *${tx.category}*\n` +
        `🕒 Waktu: ${dateStr}\n\n` +
        `${walletBalText}\n` +
        `💵 *Total Net Worth*: Rp ${netWorth.toLocaleString('id-ID')}\n\n` +
        `✨ *Pesan KAEL*: ${commentText}\n` +
        `✅ Success`
      );
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return res.status(200).json({ ok: true });
  }
};
