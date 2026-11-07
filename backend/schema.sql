-- ==============================================================================
-- SMARTRETURN AI - SUPABASE DATABASE SCHEMA
-- ==============================================================================
-- College-level Product Return, Exchange, Warranty, and Purchase Management SaaS
-- This script configures all PostgreSQL tables, triggers, Row Level Security (RLS)
-- policies, and Supabase Storage bucket rules.
-- ==============================================================================

-- 1. Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. REUSABLE TRIGGER FUNCTIONS
-- ==============================================================================

-- Function: Automatically set updated_at column to current UTC timestamp
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::TEXT, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function: Automatically create a profile row when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 3. TABLES DEFINITION
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Table: profiles
-- Stores additional user details synced from Supabase auth.users
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- Table: purchases
-- Stores item purchases, price, store, return deadlines, and warranty dates
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    store TEXT,
    category TEXT,
    price NUMERIC(10, 2),
    currency TEXT DEFAULT 'USD',
    purchase_date DATE NOT NULL,
    warranty_expiry DATE,
    return_deadline DATE,
    invoice_url TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Ensure columns exist if table was previously created
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- ------------------------------------------------------------------------------
-- Table: return_requests
-- Stores returns or exchanges initiated for purchased products
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.return_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reason TEXT,
    dispute_letter TEXT,
    tracking_code TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Ensure return_requests columns exist if table was previously created
ALTER TABLE public.return_requests ADD COLUMN IF NOT EXISTS dispute_letter TEXT;
ALTER TABLE public.return_requests ADD COLUMN IF NOT EXISTS tracking_code TEXT;

-- ------------------------------------------------------------------------------
-- Table: reminders
-- Stores user reminders for return deadlines and warranty expirations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    due_date DATE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('return', 'warranty', 'general')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Ensure reminders columns exist if table was previously created
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- ==============================================================================
-- 4. TRIGGERS
-- ==============================================================================

-- Trigger: auto-update updated_at on profiles
DROP TRIGGER IF EXISTS trigger_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger: auto-update updated_at on purchases
DROP TRIGGER IF EXISTS trigger_purchases_updated_at ON public.purchases;
CREATE TRIGGER trigger_purchases_updated_at
    BEFORE UPDATE ON public.purchases
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger: auto-update updated_at on return_requests
DROP TRIGGER IF EXISTS trigger_return_requests_updated_at ON public.return_requests;
CREATE TRIGGER trigger_return_requests_updated_at
    BEFORE UPDATE ON public.return_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- Trigger: auto-create public.profiles record when auth.users record is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 5. INDEXES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_return_deadline ON public.purchases(return_deadline);
CREATE INDEX IF NOT EXISTS idx_purchases_warranty_expiry ON public.purchases(warranty_expiry);
CREATE INDEX IF NOT EXISTS idx_return_requests_user_status ON public.return_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_reminders_user_due ON public.reminders(user_id, due_date);

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Policies: profiles
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- Policies: purchases
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their own purchases"
    ON public.purchases FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own purchases"
    ON public.purchases FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own purchases"
    ON public.purchases FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own purchases"
    ON public.purchases FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Policies: return_requests
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their own return requests"
    ON public.return_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own return requests"
    ON public.return_requests FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own return requests"
    ON public.return_requests FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own return requests"
    ON public.return_requests FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- Policies: reminders
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can view their own reminders"
    ON public.reminders FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reminders"
    ON public.reminders FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reminders"
    ON public.reminders FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reminders"
    ON public.reminders FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ==============================================================================
-- 7. SUPABASE STORAGE BUCKET & POLICIES ('invoices')
-- ==============================================================================

-- Create invoices bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy: Allow authenticated users to upload files into their own folder ({user_id}/filename)
CREATE POLICY "Users can upload their own invoices"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'invoices' AND
        (storage.foldername(name))[1] = auth.uid()::TEXT
    );

-- Storage Policy: Allow authenticated users to view/download their own files
CREATE POLICY "Users can view their own invoices"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'invoices' AND
        (storage.foldername(name))[1] = auth.uid()::TEXT
    );

-- Storage Policy: Allow authenticated users to update their own files
CREATE POLICY "Users can update their own invoices"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'invoices' AND
        (storage.foldername(name))[1] = auth.uid()::TEXT
    )
    WITH CHECK (
        bucket_id = 'invoices' AND
        (storage.foldername(name))[1] = auth.uid()::TEXT
    );

-- Storage Policy: Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own invoices"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'invoices' AND
        (storage.foldername(name))[1] = auth.uid()::TEXT
    );
