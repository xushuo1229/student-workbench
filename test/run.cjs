/* Headless runtime test: mounts the real app in jsdom and simulates user flows.
   Covers: auth (register/login), navigation, CRUD, timers, weekly plan, growth, persistence.
*/
const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')
const { JSDOM } = require('jsdom')

const KEY = 'student-workbench-v1'
const ACC_KEY = 'student-workbench-accounts'
let passed = 0
const failures = []

function assert(cond, msg) {
  if (cond) {
    passed++
    console.log('  ✓ ' + msg)
  } else {
    failures.push(msg)
    console.log('  ✗ ' + msg)
  }
}

async function main() {
  // 1) Bundle the app
  const outfile = path.resolve(__dirname, 'out.cjs')
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, 'smoke.jsx')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    outfile,
    logLevel: 'error',
    loader: { '.js': 'jsx' },
  })

  // 2) Fresh jsdom
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  })
  const { window } = dom
  global.window = window
  global.document = window.document
  global.navigator = window.navigator
  global.localStorage = window.localStorage
  global.HTMLElement = window.HTMLElement
  global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0)
  global.cancelAnimationFrame = (id) => clearTimeout(id)
  // crypto.subtle polyfill for password hashing in jsdom
  if (!global.crypto || !global.crypto.subtle) {
    const { createHash } = await import('crypto')
    global.crypto = {
      subtle: {
        digest: async (algo, data) => {
          const hash = createHash('sha256').update(Buffer.from(data)).digest()
          return hash.buffer
        },
      },
      getRandomValues: (arr) => { /* stub */ return arr },
    }
  }
  window.IS_REACT_ACT_ENVIRONMENT = true

  const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms))
  const txt = (el) => (el ? el.textContent.trim() : '')
  const byText = (text, tag = 'button') =>
    [...document.querySelectorAll(tag)].find((e) => txt(e).includes(text))
  const click = async (elOrText) => {
    const el = typeof elOrText === 'string' ? byText(elOrText) : elOrText
    if (!el) throw new Error('click target not found: ' + elOrText)
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await tick()
  }
  const setInput = (el, value) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
    el.dispatchEvent(new window.Event('input', { bubbles: true }))
  }
  const setSelect = (el, value) => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new window.Event('change', { bubbles: true }))
  }
  const inputByPlaceholder = (sub) => [...document.querySelectorAll('input,textarea')].find((e) => (e.placeholder || '').includes(sub))
  const readStore = () => JSON.parse(localStorage.getItem(KEY) || '{}')

  // 3) Render
  require(outfile)
  await tick(80)

  /* ==================== AUTH FLOW ==================== */
  console.log('\n[0] 认证系统：注册新账号（用户名+密码）')
  assert(document.body.textContent.includes('欢迎回来'), '未登录时显示登录弹窗')
  assert(document.body.textContent.includes('注册'), '登录弹窗含「注册」标签/按钮')

  // Switch to register tab
  await click('注册')
  await tick(60)
  assert(document.body.textContent.includes('创建账号'), '切换到注册模式')

  // Fill registration form
  const regUserInput = inputByPlaceholder('1-20个字符')
  assert(!!regUserInput, '注册表单含用户名输入框')
  if (regUserInput) setInput(regUserInput, 'testuser_smoke')
  const regPassInput = inputByPlaceholder('至少4位')
  assert(!!regPassInput, '注册表单含密码输入框')
  if (regPassInput) setInput(regPassInput, 'pass1234')
  const regConfirmInput = inputByPlaceholder('再次输入密码')
  if (regConfirmInput) setInput(regConfirmInput, 'pass1234')
  await click('注 册')
  await tick(100)

  const afterRegStore = readStore()
  assert(afterRegStore.isLoggedIn === true, '注册后自动 isLoggedIn=true')
  assert(afterRegStore.currentUser === 'testuser_smoke', '注册后 currentUser 已设置')
  assert(afterRegStore.user.name && afterRegStore.user.name.length > 0, '注册后用户资料已填充')
  assert(!document.body.textContent.includes('欢迎回来'), '注册后登录弹窗关闭')

  // Verify accounts stored separately
  const accounts = JSON.parse(localStorage.getItem(ACC_KEY) || '{}')
  assert(accounts['testuser_smoke'] !== undefined, '账号已保存到独立存储 (accounts key)')
  assert(accounts['testuser_smoke'].passwordHash !== 'pass1234', '密码已哈希存储（非明文）')

  /* ==================== NAVIGATION ==================== */
  console.log('\n[1] 初始渲染 / 导航')
  assert(document.getElementById('root').children.length > 0, 'App 已挂载渲染')
  const navCount = [...document.querySelectorAll('aside button')].filter((b) =>
    ['首页','今日计划','课程学习','每日阅读','英语学习','每日运动','成长数据'].some(t => txt(b).includes(t))
  ).length
  assert(navCount >= 7, `侧边栏包含至少 7 个导航项（实际 ${navCount}）`)
  assert(document.body.textContent.includes('今天也要元气满满'), '首页欢迎 Banner 渲染')

  /* ==================== PLANS CRUD ==================== */
  console.log('\n[2] 今日计划：新增 / 完成 / 持久化')
  await click('今日计划')
  assert(!!byText('新增计划'), '进入今日计划页并显示「新增计划」')
  let before = readStore().plans?.length || 0
  await click('新增计划')
  const titleInput = inputByPlaceholder('例如：完成高等数学')
  assert(!!titleInput, '新增计划弹窗已打开（标题输入框存在）')
  setInput(titleInput, '测试任务_单元测试')
  await click('添加')
  await tick(60)
  let after = readStore().plans?.length || 0
  assert(after === before + 1, `新增后计划数 +1（${before} -> ${after}）`)
  assert(document.body.textContent.includes('测试任务_单元测试'), '新计划已显示在列表中')
  // toggle complete — target the test plan's own checkbox
  const planLi = [...document.querySelectorAll('li')].find((li) => li.textContent.includes('测试任务_单元测试'))
  assert(!!planLi, '能在列表中定位到测试计划')
  const planCheckbox = planLi?.querySelector('button[aria-label="标记完成"], button[aria-label="取消完成"]')
  if (planCheckbox) {
    const beforeToggle = readStore().plans.find((p) => p.title === '测试任务_单元测试').completed
    await click(planCheckbox)
    await tick(60)
    const afterToggle = readStore().plans.find((p) => p.title === '测试任务_单元测试').completed
    assert(beforeToggle !== afterToggle, '勾选后完成状态已切换并保存')
  }

  /* ==================== COURSES CRUD ==================== */
  console.log('\n[3] 课程学习：新增课程 + 进度 + 笔记')
  await click('课程学习')
  assert(!!byText('新增课程'), '进入课程页')
  before = readStore().courses?.length || 0
  await click('新增课程')
  setInput(inputByPlaceholder('例如：高等数学'), '测试课程X')
  await click('添加')
  await tick(60)
  after = readStore().courses?.length || 0
  assert(after === before + 1, `新增课程 +1（${before} -> ${after}）`)
  assert(document.body.textContent.includes('测试课程X'), '新课程卡片显示')
  const noteInput = [...document.querySelectorAll('input')].find((e) => (e.placeholder || '').includes('记一条笔记'))
  assert(!!noteInput, '课程笔记输入框存在')
  if (noteInput) {
    setInput(noteInput, '这是一条测试笔记')
    const addNoteBtn = noteInput.parentElement.querySelector('button')
    if (addNoteBtn) await click(addNoteBtn)
    await tick(60)
    const course = readStore().courses.find((c) => c.name === '测试课程X')
    assert(course.notes.some((n) => n.content === '这是一条测试笔记'), '笔记已保存到课程')
  }

  /* ==================== READING TIMER ==================== */
  console.log('\n[4] 每日阅读：计时器 开始/暂停/继续/重置 + 使用本次时长')
  await click('每日阅读')
  const timerDisplay = document.querySelector('.font-mono')
  assert(!!timerDisplay, '阅读页计时器存在')
  const d0 = txt(timerDisplay)
  await click('开始')
  await tick(1300)
  const d1 = txt(timerDisplay)
  assert(d1 !== '00:00' && d1 !== d0, `计时器开始计时（显示 ${d1}）`)
  await click('暂停')
  const dp1 = txt(timerDisplay)
  await tick(1200)
  const dp2 = txt(timerDisplay)
  assert(dp1 === dp2, `暂停后时间不变（${dp1}）`)
  await click('继续')
  await tick(1300)
  const d2 = txt(timerDisplay)
  assert(d2 !== dp1, `继续后时间推进（${d2}）`)
  await click('重置')
  await tick(60)
  assert(txt(timerDisplay) === '00:00', '重置后回到 00:00')
  await click('开始')
  await tick(1300)
  const tBeforeUse = txt(timerDisplay)
  const toSec = (s) => { const [m, sec] = s.split(':').map(Number); return m * 60 + sec }
  const expectedMins = Math.round(toSec(tBeforeUse) / 60)
  await click('使用本次时长')
  await tick(60)
  assert(document.body.textContent.includes('新增阅读记录'), '「使用本次时长」打开阅读记录弹窗')
  const durInput = inputByPlaceholder('阅读时长（分钟）')
  assert(durInput && Number(durInput.value) === expectedMins, `时长已带入弹窗（值=${durInput ? durInput.value : 'n/a'}，预期 ${expectedMins}）`)
  const cancelBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消')
  if (cancelBtn) await click(cancelBtn)

  /* ==================== ENGLISH CRUD ==================== */
  console.log('\n[5] 英语学习：计时器保存到记录')
  await click('英语学习')
  before = readStore().english?.length || 0
  await click('新增学习')
  setInput(inputByPlaceholder('例如：背诵考研核心词汇'), '测试英语任务')
  await click('保存学习')
  await tick(60)
  after = readStore().english?.length || 0
  assert(after === before + 1, `新增英语学习 +1（${before} -> ${after}）`)

  /* ==================== SPORTS + WEEKLY PLAN ==================== */
  console.log('\n[6] 每日运动：记录 + 周计划 新增/完成')
  await click('每日运动')
  before = readStore().sports?.length || 0
  await click('新增运动')
  setInput(inputByPlaceholder('例如：慢跑 / 瑜伽'), '测试运动')
  await click('保存记录')
  await tick(60)
  after = readStore().sports?.length || 0
  assert(after === before + 1, `新增运动记录 +1（${before} -> ${after}）`)
  // weekly plan
  const wBefore = readStore().weeklyPlan?.length || 0
  await click('新增周计划')
  setInput(inputByPlaceholder('例如：慢跑 / 力量训练'), '周计划测试')
  await click('添加')
  await tick(60)
  const wAfter = readStore().weeklyPlan?.length || 0
  assert(wAfter === wBefore + 1, `新增周计划 +1（${wBefore} -> ${wAfter}）`)
  assert(document.body.textContent.includes('周计划测试'), '周计划已显示')
  const wCheckbox = [...document.querySelectorAll('button[aria-label="标记完成"]')][0]
  if (wCheckbox) {
    await click(wCheckbox)
    await tick(60)
    assert(readStore().weeklyPlan.some((w) => w.project === '周计划测试' && w.completed), '周计划可标记完成并保存')
  }

  /* ==================== GROWTH DATA ==================== */
  console.log('\n[7] 成长数据：随真实记录自动汇总')
  await click('成长数据')
  await tick(60)
  const growthText = document.body.textContent
  assert(growthText.includes('计划完成率'), '成长页展示计划完成率')
  assert(growthText.includes('连续打卡'), '成长页展示连续打卡')
  const storeNow = readStore()
  assert(storeNow.plans.some((p) => p.title === '测试任务_单元测试'), '成长数据基于真实计划记录')
  assert(storeNow.courses.some((c) => c.name === '测试课程X'), '成长数据基于真实课程记录')

  /* ==================== PERSISTENCE ==================== */
  console.log('\n[8] 刷新持久化：用已保存数据重新挂载')
  const saved = localStorage.getItem(KEY)
  const savedAcc = localStorage.getItem(ACC_KEY)
  const dom2 = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
  global.window = dom2.window
  global.document = dom2.window.document
  global.navigator = dom2.window.navigator
  global.localStorage = dom2.window.localStorage
  dom2.window.localStorage.setItem(KEY, saved)
  dom2.window.localStorage.setItem(ACC_KEY, savedAcc)
  delete require.cache[require.resolve(outfile)]
  require(outfile)
  await tick(80)
  assert(document.body.textContent.includes('测试任务_单元测试'), '刷新后新增的计划仍在（未丢失）')
  assert(document.body.textContent.includes('测试课程X'), '刷新后新增的课程仍在（未丢失）')
  // Should still be logged in (session persisted)
  assert(readStore().isLoggedIn === true, '刷新后仍保持登录状态')

  /* ==================== PROFILE EDIT + LOGOUT ==================== */
  console.log('\n[9] 个人资料：编辑 + 退出登录')
  const avatarBtn = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '查看个人资料')
  assert(!!avatarBtn, '顶栏头像可点击打开资料')
  if (avatarBtn) {
    await click(avatarBtn)
    await tick(60)
    assert(document.body.textContent.includes('编辑资料'), '资料弹窗显示「编辑资料」')
    await click('编辑资料')
    await tick(60)
    const mottoInput = inputByPlaceholder('每天进步一点点')
    if (mottoInput) setInput(mottoInput, '测试座右铭XYZ')
    await click('保存')
    await tick(60)
    assert(readStore().user.motto === '测试座右铭XYZ', '编辑后座右铭已保存')
    await click('退出登录')
    await tick(60)
    assert(readStore().isLoggedIn === false, '退出登录后 isLoggedIn=false 并持久化')
    assert(document.body.textContent.includes('欢迎回来'), '退出后重新显示登录弹窗')
  }

  /* ==================== LOGIN WITH PASSWORD ==================== */
  console.log('\n[10] 密码登录：用刚注册的账号重新登录')
  assert(document.body.textContent.includes('欢迎回来'), '退出后回到登录界面')
  const loginUserInput = inputByPlaceholder('输入你的用户名')
  assert(!!loginUserInput, '登录表单含用户名输入框')
  if (loginUserInput) setInput(loginUserInput, 'testuser_smoke')
  const loginPassInput = document.querySelectorAll('input[type="password"]')[0]
  if (loginPassInput) setInput(loginPassInput, 'pass1234')
  await click('登 录')
  await tick(100)
  assert(readStore().isLoggedIn === true, '密码登录成功，isLoggedIn=true')
  assert(readStore().currentUser === 'testuser_smoke', '登录后 currentUser 正确')

  /* ==================== SINGLE-CHAR USERNAME ==================== */
  console.log('\n[11] 单字符用户名注册')
  // logout, then register a 1-char username
  const avatarBtn2 = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '查看个人资料')
  if (avatarBtn2) await click(avatarBtn2)
  await tick(60)
  await click('退出登录')
  await tick(60)
  assert(document.body.textContent.includes('欢迎回来'), '回到登录界面')
  await click('注册')
  await tick(60)
  const singleInput = inputByPlaceholder('1-20个字符')
  if (singleInput) setInput(singleInput, 'A')
  const sp = inputByPlaceholder('至少4位')
  if (sp) setInput(sp, 'pass1234')
  const sc = inputByPlaceholder('再次输入密码')
  if (sc) setInput(sc, 'pass1234')
  await click('注 册')
  await tick(100)
  const singleStore = readStore()
  assert(singleStore.currentUser === 'A', '单字符用户名「A」注册并登录成功')
  assert(JSON.parse(localStorage.getItem(ACC_KEY) || '{}')['A'] !== undefined, '单字符用户名已存入账号簿')

  /* ==================== SETTINGS ==================== */
  console.log('\n[12] 设置：打开设置面板 + 背景切换')
  // Find and click settings button (gear icon)
  const settingsBtn = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '设置')
  // Also check sidebar for "设置" text button
  const settingsBtnText = [...document.querySelectorAll('button')].find((b) => txt(b) === '设置' && b.getAttribute('aria-label') !== '查看个人资料')
  const sBtn = settingsBtn || settingsBtnText
  assert(!!sBtn, '设置按钮存在（侧边栏或顶栏）')
  if (sBtn) {
    await click(sBtn)
    await tick(60)
    assert(document.body.textContent.includes('设置'), '设置面板已打开')
    assert(document.body.textContent.includes('界面背景'), '设置含「界面背景」区域')
    assert(document.body.textContent.includes('预设渐变背景'), '设置含预设渐变选项')

    // Check that initial data has settings object
    const storeWithSettings = readStore()
    assert(storeWithSettings.settings !== undefined, '数据中包含 settings 对象')
    assert(storeWithSettings.settings.backgroundImage === null, '初始背景为 null（默认）')

    // Test selecting a preset gradient (click first preset tile which is "日落暖阳")
    const presetTiles = [...document.querySelectorAll('button')].filter((b) =>
      b.title && b.title.includes('日落') || b.title?.includes('海洋') || b.title?.includes('森林')
    )
    if (presetTiles.length > 0) {
      await click(presetTiles[0])
      await tick(60)
      const afterPreset = readStore()
      assert(afterPreset.settings.backgroundImage !== null, '选择预设后 backgroundImage 已设置')
      assert(typeof afterPreset.settings.backgroundImage === 'string', 'backgroundImage 为字符串（CSS gradient）')
    }

    // Close settings
    const closeSettingsX = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '关闭' &&
      b.closest('[class*="fixed"]')) || [...document.querySelectorAll('button')].find((b) => txt(b).includes('关闭'))
    if (closeSettingsX) {
      await click(closeSettingsX)
      await tick(60)
    }
  }

  /* ==================== RESULT ==================== */
  console.log(`\n==== 结果：通过 ${passed} 项，失败 ${failures.length} 项 ====`)
  if (failures.length) {
    console.log('失败项：\n - ' + failures.join('\n - '))
    process.exit(1)
  } else {
    console.log('全部通过 ✅')
    process.exit(0)
  }
}

main().catch((e) => {
  console.error('测试运行异常：', e)
  process.exit(2)
})
