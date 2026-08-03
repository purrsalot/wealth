'use client';

import { useState, useEffect } from 'react';
import { 
  Zap, Mic, CornerDownLeft, Shield, Heart, PieChart, 
  Search, Plus, FileText, Download, Trash2, Send, CreditCard, ArrowDownLeft, ArrowUpRight, TrendingUp 
} from 'lucide-react';

interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  wallet: string;
  date: string;
}

export default function WealthRadarPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [wallets, setWallets] = useState<string[]>(['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH']);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [logInput, setLogInput] = useState<string>('');

  const formatRp = (num: number) => 'Rp ' + Number(num || 0).toLocaleString('id-ID');

  useEffect(() => {
    fetch('/api/transactions')
      .then(res => res.json())
      .then(data => {
        if (data.transactions) setTransactions(data.transactions);
        if (data.summary) setSummary(data.summary);
        if (data.settings?.wallets) setWallets(data.settings.wallets);
      })
      .catch(err => console.error(err));
  }, []);

  const handleQuickLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logInput.trim()) return;

    let text = logInput.trim();
    let wallet = 'CASH';
    const lower = text.toLowerCase();
    
    wallets.forEach(w => {
      if (lower.includes(w.toLowerCase())) wallet = w.toUpperCase();
    });

    let amount = 25000;
    const match = text.match(/(\d+[\.,]?\d*)\s*(jt|juta|rb|ribu|k)?/i);
    if (match) {
      let numVal = parseFloat(match[1].replace(',', '.'));
      let suf = (match[2] || '').toLowerCase();
      if (suf === 'jt' || suf === 'juta') amount = numVal * 1000000;
      else if (suf === 'rb' || suf === 'ribu' || suf === 'k') amount = numVal * 1000;
      else amount = numVal;
    }

    const isIncome = /gaji|dapat|dapet|terima|transferan|masuk|inflow|bonus/i.test(lower);
    const newTx: Transaction = {
      id: 'tx_' + Date.now(),
      title: text.replace(/!y:|\d+(jt|juta|rb|ribu|k)?/gi, '').trim() || (isIncome ? 'Pemasukan' : 'Pengeluaran'),
      amount: Math.round(amount),
      type: isIncome ? 'INCOME' : 'EXPENSE',
      category: isIncome ? 'SALARY' : 'FOOD',
      wallet,
      date: new Date().toISOString()
    };

    setTransactions(prev => [newTx, ...prev]);
    setLogInput('');
  };

  const handleExportCsv = () => {
    if (transactions.length === 0) return alert('Belum ada transaksi.');
    let csv = 'ID,Tanggal,Judul Transaksi,Nominal (IDR),Tipe,Kategori,Dompet\n';
    transactions.forEach(t => {
      csv += `${t.id},"${new Date(t.date).toLocaleString('id-ID')}","${t.title.replace(/"/g, '""')}",${t.amount},${t.type},${t.category},${t.wallet}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `wealth_radar_export_${Date.now()}.csv`;
    link.click();
  };

  const handleDelete = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const filteredTx = transactions.filter(t => {
    const matchCat = categoryFilter === 'ALL' || t.category === categoryFilter;
    const matchSearch = !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.wallet.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  const score = summary.score || 85;
  const gaugeOffset = 440 - (440 * score) / 100;

  return (
    <div className="app-container">
      {/* Main Header */}
      <header className="main-header">
        <div className="brand-block">
          <h1 className="brand-title">WEALTH RADAR<span className="brand-accent">//ID</span></h1>
        </div>

        <div className="header-actions">
          <div className="system-status">
            <span className="status-dot"></span>
            <span>NEXT.JS VERCEL ONLINE</span>
          </div>

          <button onClick={handleExportCsv} className="btn btn-primary">
            <FileText size={16} />
            <span>EXPORT EXCEL (CSV)</span>
          </button>
        </div>
      </header>

      {/* Quick Logger */}
      <section style={{ marginBottom: '32px' }}>
        <div className="logger-card">
          <div className="logger-header">
            <span className="logger-badge"><Zap size={14} /> QUICK LOGGER (!y: CONTEXT AI)</span>
            <span className="logger-hint">Contoh: <i>"!y: gopay Beli kopi 25rb"</i></span>
          </div>

          <form onSubmit={handleQuickLog} className="logger-form">
            <input 
              type="text"
              className="logger-input"
              value={logInput}
              onChange={e => setLogInput(e.target.value)}
              placeholder="Ketik '!y: bca Dapat gaji 10jt' lalu tekan Enter..."
              required
            />
            <button type="submit" className="btn btn-primary">
              <span>CATAT</span>
              <CornerDownLeft size={16} />
            </button>
          </form>
        </div>
      </section>

      {/* Main Dashboard Grid */}
      <main className="dashboard-grid">
        {/* Card 1: Health Score */}
        <article className="dash-card">
          <div className="card-header-label">
            <span className="card-num">[01]</span>
            <span>FINANCIAL HEALTH SCORE</span>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div className="gauge-container">
              <svg className="gauge-svg" viewBox="0 0 160 160">
                <circle className="gauge-bg" cx="80" cy="80" r="70"></circle>
                <circle 
                  className="gauge-progress" 
                  cx="80" cy="80" r="70"
                  style={{ strokeDashoffset: gaugeOffset }}
                ></circle>
              </svg>
              <div className="gauge-value-box">
                <span className="gauge-score">{score}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/100</span>
              </div>
            </div>

            <div className="health-badge">{summary.healthBadge || 'EXCELLENT'}</div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rasio alokasi tabungan aman & disiplin bulan ini.</p>
          </div>
        </article>

        {/* Card 2: Net Worth */}
        <article className="dash-card">
          <div className="card-header-label">
            <span className="card-num">[02]</span>
            <span>NET WORTH & BALANCES</span>
          </div>

          <div>
            <span className="currency-prefix">IDR</span>
            <h2 className="total-balance">{Number(summary.netWorth || 15000000).toLocaleString('id-ID')}</h2>

            <div className="balance-split-row">
              <div className="split-box">
                <span className="split-label"><ArrowDownLeft size={12} /> TOTAL INFLOW</span>
                <span className="split-val" style={{ color: 'var(--accent-emerald)' }}>{formatRp(summary.totalIncome || 15500000)}</span>
              </div>
              <div className="split-box">
                <span className="split-label"><ArrowUpRight size={12} /> TOTAL OUTFLOW</span>
                <span className="split-val" style={{ color: 'var(--accent-rose)' }}>{formatRp(summary.totalExpense || 535000)}</span>
              </div>
            </div>
          </div>
        </article>

        {/* Card 3: 50/30/20 Radar */}
        <article className="dash-card">
          <div className="card-header-label">
            <span className="card-num">[03]</span>
            <span>50/30/20 BUDGET RADAR</span>
          </div>

          <div>
            <div className="radar-item">
              <div className="radar-item-header">
                <span>NEEDS (50%)</span>
                <span>{summary.needsPct || 10}%</span>
              </div>
              <div className="radar-bar-bg">
                <div className="radar-bar-fill needs-fill" style={{ width: `${summary.needsPct || 10}%` }}></div>
              </div>
            </div>

            <div className="radar-item">
              <div className="radar-item-header">
                <span>WANTS (30%)</span>
                <span>{summary.wantsPct || 0}%</span>
              </div>
              <div className="radar-bar-bg">
                <div className="radar-bar-fill wants-fill" style={{ width: `${summary.wantsPct || 0}%` }}></div>
              </div>
            </div>

            <div className="radar-item">
              <div className="radar-item-header">
                <span>SAVINGS (20%)</span>
                <span>{summary.savingsPct || 100}%</span>
              </div>
              <div className="radar-bar-bg">
                <div className="radar-bar-fill savings-fill" style={{ width: `${summary.savingsPct || 100}%` }}></div>
              </div>
            </div>
          </div>
        </article>

        {/* Card 4: Multi-Wallet Breakdown */}
        <article className="dash-card">
          <div className="card-header-label">
            <span className="card-num">[04]</span>
            <span>MULTI-DOMPET BREAKDOWN</span>
          </div>

          <div className="wallet-list-grid">
            {wallets.map(w => (
              <div key={w} className="wallet-chip">
                <span className="w-name">{w}</span>
                <span className="w-val">{formatRp((summary.walletBalances && summary.walletBalances[w]) || 0)}</span>
              </div>
            ))}
          </div>
        </article>
      </main>

      {/* Transactions Feed */}
      <section>
        <div className="feed-header">
          <h3 className="feed-heading">RIWAYAT TRANSAKSI (REALTIME SUPABASE)</h3>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Cari transaksi..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid var(--bg-card-border)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#fff',
                fontSize: '13px'
              }}
            />
          </div>
        </div>

        <div className="category-tabs">
          {['ALL', 'FOOD', 'TRANSPORT', 'BILLS', 'SHOPPING', 'SALARY', 'INVESTMENT'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`tab-btn ${categoryFilter === cat ? 'active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div>
          {filteredTx.map(tx => (
            <div key={tx.id} className="tx-item">
              <div>
                <span className="tx-title">{tx.title}</span>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>{new Date(tx.date).toLocaleDateString('id-ID')}</span> • <span style={{ color: 'var(--accent-cyan)' }}>{tx.wallet}</span> • <span>{tx.category}</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className={`tx-amount ${tx.type}`}>
                  {tx.type === 'INCOME' ? '+' : '-'}{formatRp(tx.amount)}
                </span>
                <button onClick={() => handleDelete(tx.id)} style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
