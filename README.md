# WEALTH RADAR // ID — Full-Stack Micro-SaaS (V5.0)
> **AI Personal Finance & Net Worth Radar** berbasis **Node.js, Express, WebSocket, Supabase Realtime Database, dan WhatsApp Bot Engine (`!y:`)**.

---

## ⚡ Fitur Utama

- **Studio Steve Dark Mode Aesthetics**: Tampilan UI ultra-modern dengan glassmorphism (`backdrop-filter: blur`), typography `Outfit`, dan palet warna neon.
- **Supabase Realtime Database**: Terhubung otomatis ke Supabase Cloud DB dengan skema tabel `transactions` RLS & Realtime publication.
- **WhatsApp Bot Integration (`!y:`)**:
  - **Sintaks Wajib Pencatatan (`!y:`)**: `!y: bca Dapat transferan 500rb` (Inflow) / `!y: gopay Beli kopi 25rb` (Outflow).
  - **Filter Ketat Anti-Spam**: Mengabaikan 100% saluran WA (newsletters/broadcast) dan pesan biasa tanpa prefix `!y`.
- **Daftar WhatsApp Commands Full**:
  - `!y total` — Laporan Net Worth & 50/30/20 Budget Radar.
  - `!y dompet` — Rincian saldo semua dompet digital & bank.
  - `!y [nama dompet]` (e.g. `!y bca`, `!y gopay`) — Cek khusus saldo & statistik dompet tertentu.
  - `!y undo` — Batalkan / hapus transaksi terakhir yang baru dicatat.
  - `!y bulan` — Rekap pengeluaran bulan ini & analisa kategori paling boros.
  - `!y cat` — Breakdown pengeluaran per kategori.
  - `!y help` — Tampilkan buku panduan command di WA.
- **Custom Multi-Wallet Manager**: Tambah & hapus dompet digital / bank sesuka kamu di web dashboard.
- **Export Laporan Excel (CSV)**: Download data riwayat keuangan ke file CSV / Excel kapan saja.

---

## 🚀 Cara Menjalankan Aplikasi

1. **Install Dependensi**:
   ```bash
   npm install
   ```

2. **Jalankan Server Node.js**:
   ```bash
   npm start
   # atau
   node server.js
   ```

3. **Buka Dashboard**:
   Akses `http://localhost:3000` di browser.

4. **Koneksi WhatsApp**:
   - Klik tombol **`SCAN WA QR`** di web header atau lihat terminal.
   - Scan QR Code dari HP via WhatsApp (`Linked Devices` / `Perangkat Tertaut`).

---

## 📄 Database Schema (Supabase SQL)

Script SQL untuk Supabase ada di file `schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
    category TEXT NOT NULL,
    wallet TEXT DEFAULT 'CASH',
    date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---
*Built with ❤️ by Wealth Radar ID Team.*
