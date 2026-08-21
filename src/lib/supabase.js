import { createClient } from '@supabase/supabase-js'

/* ---- 单点配置：所有模块统一从这里取 Supabase 实例与表名 ---- */
export const SUPABASE_URL = 'https://gidbmdeawvxpfudcvoxfg.supabase.co'
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmVzIiwicm9sZSI6ImFub24iLCJleHAiOjE5NjM4MDczODZ9'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* ---- Table names ---- */
export const USER_DATA_TABLE = 'user_data'
export const USERS_TABLE = 'wb_users'

/**
 * 统一密码哈希：SHA-256 + 固定盐，防彩虹表。
 * 所有注册/登录校验必须使用本函数，严禁在别处重复实现哈希逻辑。
 */
const PASSWORD_SALT = '_swb_salt_v1'

export async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + PASSWORD_SALT)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * 兼容校验：先用带盐哈希比对，失败再尝试旧版无盐哈希（历史账号迁移用）。
 * 校验通过且为旧格式时返回 true，调用方可将密码升级为新哈希。
 */
export async function verifyPassword(password, storedHash) {
  if (!storedHash) return false
  const salted = await hashPassword(password)
  if (salted === storedHash) return true
  // Legacy: 无盐 SHA-256（旧版本 StoreContext 生成的账号）
  const encoder = new TextEncoder()
  const legacy = await crypto.subtle.digest('SHA-256', encoder.encode(password))
  const legacyHex = Array.from(new Uint8Array(legacy))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return legacyHex === storedHash
}

/* ============================================================
 * 建表 SQL（在 Supabase SQL Editor 中执行一次）：
 *
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
 * CREATE TABLE IF NOT EXISTS public.user_data (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id UUID NOT NULL REFERENCES public.wb_users(id) ON DELETE CASCADE,
 *   data JSONB NOT NULL DEFAULT '{}',
 *   updated_at TIMESTAMPTZ DEFAULT now(),
 *   UNIQUE(user_id)
 * );
 *
 * -- 安全建议：请务必启用 RLS 并收紧 anon key 权限，生产环境不应依赖
 * -- "UUID 不可猜测"作为唯一防线。具体策略见项目报告。
 * ============================================================ */
