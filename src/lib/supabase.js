import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gidbmdeawvxpfudcvoxfg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmVzIiwicm9sZSI6ImFub24iLCJleHAiOjE5NjM4MDczODZ9'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* ---- Table name for per-user app data ---- */
export const USER_DATA_TABLE = 'user_data'

/**
 * Database schema (run once in Supabase SQL Editor):
 *
 * CREATE TABLE IF NOT EXISTS public.user_data (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 *   data JSONB NOT NULL DEFAULT '{}',
 *   updated_at TIMESTAMPTZ DEFAULT now(),
 *   UNIQUE(user_id)
 * );
 *
 * -- RLS: users can only access their own row
 * ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Users can read own data"
 *   ON public.user_data FOR SELECT
 *   USING (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can insert own data"
 *   ON public.user_data FOR INSERT
 *   WITH CHECK (auth.uid() = user_id);
 *
 * CREATE POLICY "Users can update own data"
 *   ON public.user_data FOR UPDATE
 *   USING (auth.uid() = user_id);
 */
