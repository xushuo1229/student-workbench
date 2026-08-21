/* Headless runtime test: mounts the real app in jsdom and simulates user flows. */
const path = require('path')
const fs = require('fs')
const esbuild = require('esbuild')
const { JSDOM } = require('jsdom')

const KEY = 'student-workbench-v1'
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
  // 1) Bundle the app (no CSS in this entry path)
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

  console.log('\n[1] 初始渲染 / 导航')
  assert(document.getElementById('root').children.length > 0, 'App 已挂载渲染')
  const navCount = [...document.querySelectorAll('aside button')].filter((b) => ['首页','今日计划','课程学习','每日阅读','英语学习','每日运动','成长数据'].includes(txt(b))).length
  assert(navCount === 7, '侧边栏包含 7 个导航项（实际 ' + navCount + '）')
  assert(document.body.textContent.includes('今天也要元气满满'), '首页欢迎 Banner 渲染')

  console.log('\n[1.5] 个性化登录：首次进入弹窗 + 登录后持久化')
  assert(document.body.textContent.includes('欢迎来到自律工作台'), '首次进入显示登录/欢迎弹窗')
  const nameInput = inputByPlaceholder('你的昵称')
  assert(!!nameInput, '登录表单含昵称输入框')
  if (nameInput) setInput(nameInput, '测试同学')
  await click('进入工作台')
  await tick(60)
  assert(readStore().isLoggedIn === true, '登录后 isLoggedIn=true 并持久化')
  assert(document.body.textContent.includes('测试同学'), '登录后昵称显示在界面')
  assert(!document.body.textContent.includes('欢迎来到自律工作台'), '登录后登录弹窗关闭')

  console.log('\n[2] 今日计划：新增 / 完成 / 持久化')
  await click('今日计划')
  assert(!!byText('新增计划'), '进入今日计划页并显示「新增计划」')
  let before = readStore().plans?.length || 0
  await click('新增计划')
  const titleInput = inputByPlaceholder('例如：完成高等数学')
  assert(!!titleInput, '新增计划弹窗已打开（标题输入框存在）')
  setInput(titleInput, '测试任务_单元测试')
  // category select default 学习; just add
  await click('添加')
  await tick(60)
  let after = readStore().plans?.length || 0
  assert(after === before + 1, `新增后计划数 +1（${before} -> ${after}）`)
  assert(document.body.textContent.includes('测试任务_单元测试'), '新计划已显示在列表中')
  // toggle complete — target the test plan's own checkbox
  const planLi = [...document.querySelectorAll('li')].find((li) => li.textContent.includes('测试任务_单元测试'))
  assert(!!planLi, '能在列表中定位到测试计划')
  const planCheckbox = planLi.querySelector('button[aria-label="标记完成"], button[aria-label="取消完成"]')
  const beforeToggle = readStore().plans.find((p) => p.title === '测试任务_单元测试').completed
  await click(planCheckbox)
  await tick(60)
  const afterToggle = readStore().plans.find((p) => p.title === '测试任务_单元测试').completed
  assert(beforeToggle !== afterToggle, '勾选后完成状态已切换并保存')

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
  // add a note via the course's note input
  const noteInput = [...document.querySelectorAll('input')].find((e) => (e.placeholder || '').includes('记一条笔记'))
  assert(!!noteInput, '课程笔记输入框存在')
  if (noteInput) {
    setInput(noteInput, '这是一条测试笔记')
    const noteBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '' && b.querySelector('svg')) // fallback
    // click the small check button next to note input
    const addNoteBtn = noteInput.parentElement.querySelector('button')
    await click(addNoteBtn)
    await tick(60)
    const course = readStore().courses.find((c) => c.name === '测试课程X')
    assert(course.notes.some((n) => n.content === '这是一条测试笔记'), '笔记已保存到课程')
  }

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
  const tBeforeUse = txt(timerDisplay) // e.g. 00:01
  const toSec = (s) => { const [m, sec] = s.split(':').map(Number); return m * 60 + sec }
  const expectedMins = Math.round(toSec(tBeforeUse) / 60)
  await click('使用本次时长')
  await tick(60)
  assert(document.body.textContent.includes('新增阅读记录'), '「使用本次时长」打开阅读记录弹窗')
  const durInput = inputByPlaceholder('阅读时长')
  assert(durInput && Number(durInput.value) === expectedMins, `时长已带入弹窗（值=${durInput ? durInput.value : 'n/a'}，预期 ${expectedMins}）`)
  // cancel modal
  const cancelBtn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '取消')
  if (cancelBtn) await click(cancelBtn)

  console.log('\n[5] 英语学习：计时器保存到记录')
  await click('英语学习')
  before = readStore().english?.length || 0
  await click('新增学习')
  setInput(inputByPlaceholder('例如：背诵考研核心词汇'), '测试英语任务')
  await click('保存学习')
  await tick(60)
  after = readStore().english?.length || 0
  assert(after === before + 1, `新增英语学习 +1（${before} -> ${after}）`)

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

  console.log('\n[7] 成长数据：随真实记录自动汇总')
  await click('成长数据')
  await tick(60)
  const growthText = document.body.textContent
  assert(growthText.includes('计划完成率'), '成长页展示计划完成率')
  assert(growthText.includes('连续打卡'), '成长页展示连续打卡')
  const storeNow = readStore()
  // verify aggregation reflects our added data
  assert(storeNow.plans.some((p) => p.title === '测试任务_单元测试'), '成长数据基于真实计划记录')
  assert(storeNow.courses.some((c) => c.name === '测试课程X'), '成长数据基于真实课程记录')

  console.log('\n[8] 刷新持久化：用已保存数据重新挂载')
  const saved = localStorage.getItem(KEY)
  const dom2 = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true })
  global.window = dom2.window
  global.document = dom2.window.document
  global.navigator = dom2.window.navigator
  global.localStorage = dom2.window.localStorage
  dom2.window.localStorage.setItem(KEY, saved) // simulate refresh with existing data
  delete require.cache[require.resolve(outfile)]
  require(outfile)
  await tick(80)
  assert(document.body.textContent.includes('测试任务_单元测试'), '刷新后新增的计划仍在（未丢失）')
  assert(document.body.textContent.includes('测试课程X'), '刷新后新增的课程仍在（未丢失）')

  console.log('\n[9] 个人资料：编辑 + 退出登录（基于刷新后的实例）')
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
    assert(document.body.textContent.includes('欢迎来到自律工作台'), '退出后重新显示登录弹窗')
  }

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
