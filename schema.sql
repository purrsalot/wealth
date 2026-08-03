-- ==========================================================================
-- WEALTH RADAR // ID — SUPABASE REALTIME DATABASE SCHEMA (V4.0)
-- Copy & Paste script ini ke SQL Editor di Supabase Dashboard kamu!
-- ==========================================================================

-- 1. Create Transactions Table with Wallet Column
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

-- Add wallet column if table already existed without it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='wallet') THEN
        ALTER TABLE public.transactions ADD COLUMN wallet TEXT DEFAULT 'CASH';
    END IF;
END $$;

-- 2. Enable Row Level Security (RLS) & Public Access Policy
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access to transactions" ON public.transactions;
CREATE POLICY "Allow public full access to transactions" 
ON public.transactions 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 3. Enable Realtime Replication for transactions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
