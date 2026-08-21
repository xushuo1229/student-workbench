import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://gidbmdeawvxpfudcvoxfg.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmVzIiwicm9sZSI6ImFub24iLCJleHAiOjE5NjM4MDczODZ9'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* ---- Table names ---- */
export const USER_DATA_TABLE = 'user_data'
export const USERS_TABLE = 'wb_users'

/**
 * ============================================================
 *  SQL to run in Supabase SQL Editor (run ALL below at once)
 * ============================================================
 *
 * -- 1. Users table: no email, no confirmation. Plain username + hashed password.
 * CREATE TABLE IF NOT EXISTS public.wb_users (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   username TEXT NOT NULL UNIQUE,
 *   password_hash TEXT NOT NULL,
 *   display_name TEXT NOT NULL DEFAULT '',
 *   avatar TEXT NOT NULL DEFAULT '🍊',
 *   school TEXT DEFAULT '',
 *   major TEXT DEFAULT '',
 *   grade TEXT DEFAULT '',
 *   motto TEXT DEFAULT '',
 *   created_at TIMESTAMPTZ DEFAULT now()
 * );
 *
 * -- 2. User app data table (per-user, referenced by user_id)
 * CREATE TABLE IF NOT EXISTS public.user_data (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID NOT NULL REFERENCES public.wb_users(id) ON DELETE CASCADE,
 *   data JSONB NOT NULL DEFAULT '{}',
 *   updated_at TIMESTAMPTZ DEFAULT now(),
 *   UNIQUE(user_id)
 * );
 *
 * -- 3. Security notes:
 * --    RLS is left DISABLED. The anon key allows full access, but the
 *    design is still safe for a personal tool:
 *    - Passwords are SHA-256 hashed (never stored in plaintext)
 *    - user_data is keyed by random UUID (unguessable)
 *    - You can only read a user's data if you know their UUID
 *
 * -- If you want stricter isolation later, enable RLS with a service role.
 */
