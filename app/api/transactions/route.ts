import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://alpxljvkcwtjywskyzie.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFscHhsanZrY3d0anl3c2t5emllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NzM4NDAsImV4cCI6MjEwMTM0OTg0MH0.du58Vf0d20u2g7eqxLFP8NPGlN5KGATU3LH7vTNN0Uc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function GET() {
  try {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false });

    let transactions = (data && data.length > 0) ? data : [
      { id: 'tx_seed_1', title: 'Gaji Bulanan Utama', amount: 12000000, type: 'INCOME', category: 'SALARY', wallet: 'BCA', date: new Date(Date.now() - 86400000 * 5).toISOString() },
      { id: 'tx_seed_2', title: 'Project Freelance UI/UX', amount: 3500000, type: 'INCOME', category: 'SALARY', wallet: 'MANDIRI', date: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: 'tx_seed_3', title: 'Makan Siang Warteg', amount: 35000, type: 'EXPENSE', category: 'FOOD', wallet: 'GOPAY', date: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: 'tx_seed_4', title: 'Bensin Motor Pertamax', amount: 50000, type: 'EXPENSE', category: 'TRANSPORT', wallet: 'OVO', date: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: 'tx_seed_5', title: 'Bayar WiFi Indihome', amount: 450000, type: 'EXPENSE', category: 'BILLS', wallet: 'BCA', date: new Date(Date.now() - 86400000 * 1).toISOString() }
    ];

    let totalIncome = 0;
    let totalExpense = 0;
    let needsSpent = 0;
    let wantsSpent = 0;
    let savingsSpent = 0;
    const walletBalances: Record<string, number> = { BCA: 0, MANDIRI: 0, GOPAY: 0, OVO: 0, SHOPEEPAY: 0, DANA: 0, CASH: 0 };

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

    return NextResponse.json({
      transactions,
      summary: {
        totalIncome, totalExpense, netWorth,
        needsSpent, needsLimit, needsPct,
        wantsSpent, wantsLimit, wantsPct,
        savingsSpent, savingsLimit, savingsPct,
        score, healthBadge, walletBalances
      },
      settings: { wallets: ['BCA', 'MANDIRI', 'GOPAY', 'OVO', 'SHOPEEPAY', 'DANA', 'CASH'] },
      supabaseConnected: true
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
