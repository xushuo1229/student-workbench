# student-workbench 代码审查与完善报告

> 审查对象：https://xushuo1229.github.io/student-workbench/
> 仓库版本：master @ d039892 (含后续未提交完善)
> 审查日期：2026-08-21

---

## 一、审查结论概览

| 级别 | 数量 | 关键问题 |
|---|---|---|
| 🔴 致命 | 2 | 云同步从未真正工作；线上部署与代码脱节（线上跑的是旧版原生 JS 单文件应用） |
| 🟠 高 | 2 | 密码哈希无盐 + RLS 禁用；AuthModal 存在死代码且密码规则不一致 |
| 🟡 中 | 4 | 错误信息被吞；重置语义错误；导出文案造假；无登录守卫 |
| 🟢 低 | 6 | 假搜索框/通知铃；垃圾文件入库；测试是"文本包含"级；重复常量；merge 浅合并；Home 假按钮 |

**核心发现：用户访问的 `login.html` 并不是 React 主应用的入口**——它是 gh-pages 分支上**残留的旧版原生 JS 登录页**，与 master 分支的 React 应用使用完全不同的数据结构和存储 key（`sw_users` vs `student-workbench-*`），互不兼容。

---

## 二、详细缺陷清单

### 🔴 P0-1：云端同步从未在浏览器中工作过

**根因**：`src/store/StoreContext.jsx` 用 `require('@supabase/supabase-js')` 动态加载 Supabase SDK。浏览器中没有 `require` 全局函数，运行必抛 `ReferenceError`，被 try/catch 静默吞掉后 `supabase` 永远为 `null`。

**硬证据**（修复前构建产物 `dist/assets/index-*.js`）：
```js
try {
  Ie = require("@supabase/supabase-js").createClient(...)
} catch(e) { ... }
```
此段代码原样保留在浏览器 bundle 中。

**实际影响**：
- UI 长期宣称"数据自动保存到 Supabase · 多设备同账号同步"，实际纯 localStorage 单机模式
- 所有用户"云端同步"功能承诺从未兑现

**修复**（已完成）：统一从 `src/lib/supabase.js` 静态 import，移除 `require` 块。
**修复证据**：修复后构建产物中 `require("@supabase")` 残留 = **0**；`createClient` / `wb_users` / `user_data` 均在产物中。

---

### 🔴 P0-2：线上部署与代码完全脱节

**根因**：gh-pages 分支上 index.html 是一份 **138KB 的旧版原生 JS 单文件应用**（直接用 `sw_users` / `sw_data_*` localStorage key，自己直连 Supabase REST），而 master 分支是 React 新版。两者数据结构不兼容：
- 旧版 localStorage key：`sw_users`、`sw_current`、`sw_data_<u>`、`sw_settings_<u>`
- 新版 localStorage key：`student-workbench-accounts`、`student-workbench-session`、`student-workbench-cache-<id>`、`student-workbench-v1`
- 旧版 Supabase 数据格式：`{__app: 'static', payload: {...}}`（带版本标记）
- 新版 Supabase 数据格式：直接存 `{plans, courses, ...}`

**gh-pages 分支历史**（`git log origin/gh-pages`）显示在 React 自动部署（commit `11b41c6`）之后，又被多次手动 push 改回旧版单文件应用（"紧急修复 reveal 默认 opacity"等），导致线上永远跑旧版。

**修复**（已完成）：`.github/workflows/deploy.yml` 在构建后增加 `cp dist/index.html dist/404.html`（GitHub Pages SPA fallback 任意路径回落 React 应用），注释中明确 keep_files 默认 false 会清空 gh-pages 旧残留。

---

### 🟠 P1-1：密码哈希无盐 + 客户端比较

`StoreContext.jsx` 原 hashPassword：纯 `SHA-256(password)`，无盐。AuthModal 有个带 `_swb_salt_v1` 盐的 hashPassword **但从未被调用**（死代码）。

**安全后果**：
- 配合 `wb_users` 表 RLS 禁用 + anon key 全权访问（注释明说"安全靠 UUID 不可猜测"），任何拿到 Supabase URL 的人可枚举所有用户的 password_hash 并离线彩虹表爆破
- 登录逻辑 `SELECT * FROM wb_users WHERE username=?` 把整行（含 hash）下发到客户端做比较，攻击者直接拿到 hash

**修复**（已完成）：
- `src/lib/supabase.js` 统一 `hashPassword(password)`（带 `_swb_salt_v1` 盐）+ `verifyPassword`（兼容旧无盐哈希自动升级）
- `StoreContext.jsx` 移除本地 hashPassword，改从 supabase.js 导入
- 旧版本地账号登录时自动升级为带盐哈希（幂等）

**遗留安全建议**（已记录在 supabase.js 注释中）：生产环境务必启用 RLS 并收紧 anon key 权限，不应依赖"UUID 不可猜测"作为唯一防线。

---

### 🟠 P1-2：AuthModal 死代码 + 密码规则不一致

| 项目 | 旧值 | 新值 |
|---|---|---|
| AuthModal 本地 hashPassword | 死代码（带盐） | 删除，统一从 supabase.js 导入 |
| 密码校验 | `p.length < 4` | `p.length < 6`（与占位符/旧版一致） |
| 密码 placeholder | "至少4位" | "至少6位" |
| 注册错误提示 | 一律"注册失败，请重试" | 透传真实错误（"该用户名已被注册"等） |

---

### 🟡 P2：业务逻辑缺陷

1. **重置数据语义错误**：`resetAll` 实际是"恢复示例数据"，与"重置我的数据"按钮文案冲突；且 cloud 模式下重置后会被下次同步的旧数据覆盖回来。
   **修复**：新增 `clearAllData` 真正清空列表字段（保留 user/settings），云端同步清空；SettingsModal 按钮改调用 clearAllData。resetAll 保留供 Growth 页"恢复示例数据"使用。

2. **导出文案造假**：toast 显示"已导出 N 个账号"，但导出对象里根本没有 `accounts` 字段。
   **修复**：导出逻辑修正（增加 account 字段），toast 改为"已导出当前账号数据"。

3. **import 浅合并**：merge 模式 `mergedData = {...existing, ...incoming}`，数组字段会被整个覆盖而非合并。
   **修复**：新增 `mergeAppData` 辅助函数，对 `plans / courses / readings / english / sports / weeklyPlan` 列表按 id 深度合并。

4. **无登录守卫**（保留）：未登录时 AuthModal 全屏覆盖，数据操作无 isLoggedIn 守卫但无明显安全/功能后果（因为用户根本无法绕过弹窗操作主界面）。

---

### 🟢 P3：体验与卫生

1. **假按钮**：Topbar 搜索框无功能、Home "开始专注"按钮只弹 toast。
   **修复**：搜索框实现全站模糊搜索（计划/课程/书籍/英语/运动），下拉分组显示结果，回车跳转；"开始专注"改跳转今日计划页。

2. **重复常量**：AuthModal 与 ProfileModal 各定义 `AVATARS` / `GRADES`。
   **修复**：抽取到 `src/lib/constants.js`，两处统一引用。

3. **死代码引用**：`ProfileModal` 中 `data.data?.currentUser`（`data.data` 不存在，永远 false）。
   **修复**：改为 `data.currentUser`。

4. **垃圾文件**：`vite.config.js.timestamp-*.mjs` 入库。
   **修复**：从 git 移除并删除工作区文件。

5. **测试是"文本包含"级**：原 `test/run.cjs` 的 readStoreFromDOM 返回空对象，多数断言是"页面包含某字符串"这种恒真/弱断言。
   **修复**：补充关键回归检查——"StoreContext 不再使用 require 加载 Supabase"（防止再次引入此 bug）；断言 StoreContext 提供 `clearAllData` / `syncState`。

6. **无同步状态展示**：用户不知道云同步是否成功。
   **修复**：StoreContext 暴露 `syncState`（`idle / syncing / synced / offline / local`），SettingsModal "跨设备同步"区块实时展示；失败时 30s 自动重试一次。

---

## 三、修改文件清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `src/lib/supabase.js` | 重写 | 单一 Supabase 配置源 + 统一带盐密码哈希 + 兼容校验 |
| `src/lib/constants.js` | 新增 | 共享 AVATARS / GRADES |
| `src/store/StoreContext.jsx` | 大改 | ES import 替换 require、错误透传、密码升级、clearAllData、syncState、export 修正、import 深合并、失败重试 |
| `src/components/AuthModal.jsx` | 小改 | 删除死代码 hashPassword、密码 ≥6、错误透传、常量统一 |
| `src/components/ProfileModal.jsx` | 小改 | 修复 data.data 死代码、常量统一 |
| `src/components/SettingsModal.jsx` | 小改 | syncState 展示、clearAllData 调用、导出文案修正 |
| `src/components/Topbar.jsx` | 中改 | 真实全局搜索（下拉分组 + 回车跳转） |
| `src/pages/Home.jsx` | 小改 | "开始专注"跳今日计划、清理未用 pushToast |
| `.github/workflows/deploy.yml` | 改 | 增加 404.html SPA fallback、注释强调 keep_files: false |
| `test/run.cjs` | 改 | 增加 require 残留回归检查、新增 clearAllData/syncState 断言 |
| `vite.config.js.timestamp-*.mjs` | 删 | 从 git 与工作区移除 |

---

## 四、验证证据

| 验证项 | 方法 | 结果 |
|---|---|---|
| 构建通过 | `npm run build` | ✓ 0 错误，1646 modules |
| 核心修复（require → ES import） | `grep -c "require(\"@supabase" dist/assets/index-*.js` | **0**（修复前 1） |
| Supabase SDK 正确打包 | `grep -o "createClient" dist/assets/*.js` | **2** 次调用；`wb_users` / `user_data` 都在 |
| 统一哈希生效 | `grep -o "_swb_salt_v1" dist/assets/*.js` | ✓ 命中 |
| 密码规则更新 | 浏览器 DOM placeholder | "至少6位"（修复前 "至少4位"） |
| 错误透传 | 浏览器 + Supabase 云端响应 | 提交同名用户时显示"该用户名已被注册"（来自云端响应，证明 SDK 真实工作） |
| jsdom 测试 | `node test/run.cjs` | **26/26 通过**（新增 4 项：require 残留、clearAllData、syncState、源码使用统一 hashPassword） |
| HTTP 预览 | `npm run preview` | index.html / assets / 404.html 均 200 |
| 页面渲染 | agent-browser 加载本地预览 | 完整工作台 + 登录弹窗正常显示 |

**最强的"云同步修复成功"证据**：浏览器中提交 `testuser_2026` 注册后，错误 banner 显示 **"该用户名已被注册"**——而修复前由于 `supabase === null`，代码会直接降级到 localStorage 路径并在本地新建账号，**永远看不到"该用户名已被注册"**。这说明 supabase-js SDK 真正在浏览器初始化、查询成功、返回数据。

---

## 五、部署建议

### A. 立即将 React 版部署到线上（推荐）

1. **推送本仓库 master** —— GitHub Actions `Deploy to GitHub Pages` workflow 会自动构建 + 部署 React 应用到 gh-pages
2. workflow 中的 `cp dist/index.html dist/404.html` 步骤保证任意路径（含旧 `login.html`）都回落 React SPA
3. peaceiris/actions-gh-pages 默认 `keep_files: false`，**会清空** gh-pages 分支上旧版 index.html / login.html / assets/ 等所有旧残留
4. 部署后访问 https://xushuo1229.github.io/student-workbench/ 直接进新版登录弹窗（应用内 AuthModal）

### B. 旧数据迁移（可选）

旧版（`sw_*`）用户的本地数据不会自动迁移到新版（`student-workbench-*`）。如需保留：
- 旧版有"导出数据"功能（gh-pages 上旧版应用内），可生成 JSON 备份
- 新版"导入数据"功能已升级为深合并（按 id 去重），可读入旧版备份（需手动调整格式差异）

### C. 安全加固建议（生产前必做）

1. **启用 RLS**：在 Supabase SQL Editor 执行 `ALTER TABLE public.wb_users ENABLE ROW LEVEL SECURITY;` 并为 `user_data` 配策略
2. **收紧 anon key**：可考虑用 Edge Function 做后端认证代理，anon key 不再直连 wb_users
3. **换更强密码哈希**：当前 SHA-256 仍可被强力 GPU 爆破，建议迁移到 bcrypt/Argon2（在服务端做）

---

## 六、已知遗留问题

1. **v1 vs v2 备份格式**：importAllData 只校验 `version` 存在，未做版本兼容；如未来升级数据 schema 需要迁移逻辑
2. **多设备冲突**：JSONB 整行 upsert，last-write-wins；多设备同时编辑会互相覆盖
3. **离线重试**：云同步失败后 30s 一次自动重试，但**没有离线队列**——失败期间如果用户退出登录，正在编辑的数据可能丢失（虽然本地有缓存）
4. **timer 状态丢失**：专注计时器运行中刷新页面会丢失当前时长（无持久化）
5. **测试仍较浅**：jsdom 26 项断言多为"源码包含/导出存在"级，真正的端到端 CRUD 流程未覆盖（Cloud 模式需真网络）
6. **Topbar 通知铃仍是装饰**：本次只做了搜索，通知功能未实现

---

## 七、本地构建/运行

```bash
# 安装依赖
npm install

# 开发模式
npm run dev          # http://localhost:5173

# 生产构建
npm run build        # 产物在 dist/

# 本地预览生产构建
npm run preview      # http://localhost:4173

# 运行测试
node test/run.cjs    # 26 项断言，应全部通过
```
