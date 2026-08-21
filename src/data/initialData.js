import { todayStr, uid } from '../lib/format'

const today = todayStr()
// A couple of recent days so charts/calendar aren't empty on first load
const d = (offset) => {
  const dt = new Date()
  dt.setDate(dt.getDate() - offset)
  const off = dt.getTimezoneOffset()
  return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 10)
}

export const initialData = {
  // 登录状态：首次进入为 false，完善资料后变为 true（持久化）
  isLoggedIn: false,
  user: {
    name: '小柚',
    avatar: '🍊',
    motto: '每天进步一点点，自律让我自由',
    school: '',
    major: '',
    grade: '',
  },

  plans: [
    { id: uid(), title: '完成高等数学第3章课后习题', category: '学习', estimatedMinutes: 60, completed: false, date: today },
    { id: uid(), title: '背诵考研英语核心词汇 30 个', category: '英语', estimatedMinutes: 25, completed: true, date: today },
    { id: uid(), title: '晨跑 3 公里', category: '运动', estimatedMinutes: 30, completed: false, date: today },
    { id: uid(), title: '阅读《被讨厌的勇气》第2章', category: '阅读', estimatedMinutes: 35, completed: false, date: today },
    { id: uid(), title: '整理宿舍书桌 + 洗衣服', category: '生活', estimatedMinutes: 20, completed: true, date: today },
  ],

  courses: [
    {
      id: uid(),
      name: '高等数学',
      teacher: '王教授',
      color: 'purple',
      progress: 62,
      notes: [
        { id: uid(), content: '泰勒公式展开注意余项阶数，考试常考。', createdAt: today },
        { id: uid(), content: '多元函数偏导先固定其他变量再求导。', createdAt: today },
      ],
    },
    {
      id: uid(),
      name: '大学英语',
      teacher: '李老师',
      color: 'orange',
      progress: 48,
      notes: [{ id: uid(), content: '长难句先找主干再拆修饰。', createdAt: today }],
    },
    {
      id: uid(),
      name: '数据结构',
      teacher: '陈老师',
      color: 'blue',
      progress: 75,
      notes: [{ id: uid(), content: '二叉树层序遍历用队列实现。', createdAt: today }],
    },
  ],

  readings: [
    { id: uid(), book: '被讨厌的勇气', author: '岸见一郎 / 古贺史健', pages: 42, gain: '课题分离：分清「自己的课题」与「他人的课题」。', durationMinutes: 35, date: today },
    { id: uid(), book: '认知觉醒', author: '周岭', pages: 28, gain: '元认知是人类的终极能力，学会观察自己的思考。', durationMinutes: 22, date: d(1) },
    { id: uid(), book: '原子习惯', author: '詹姆斯·克利尔', pages: 50, gain: '每天进步 1%，一年后会强大 37 倍。', durationMinutes: 40, date: d(2) },
  ],

  english: [
    { id: uid(), type: '单词', content: '背诵考研核心词汇 List 12（30词）', durationMinutes: 25, date: today },
    { id: uid(), type: '听力', content: 'VOA 慢速英语 1 篇', durationMinutes: 18, date: d(1) },
    { id: uid(), type: '口语', content: '跟读 TED 演讲 5 分钟', durationMinutes: 12, date: d(2) },
  ],

  sports: [
    { id: uid(), project: '慢跑', durationMinutes: 30, calories: 240, state: '轻松', note: '操场 3 圈，配速稳定。', date: today },
    { id: uid(), project: '瑜伽', durationMinutes: 20, calories: 90, state: '一般', note: '睡前拉伸放松。', date: d(1) },
    { id: uid(), project: '跳绳', durationMinutes: 15, calories: 160, state: '累', note: '间歇跳，心率上来了。', date: d(3) },
  ],

  weeklyPlan: [
    { id: uid(), weekday: 0, project: '慢跑', targetMinutes: 30, note: '晨跑，保持状态', completed: false },
    { id: uid(), weekday: 2, project: '力量训练', targetMinutes: 40, note: '上肢 + 核心', completed: false },
    { id: uid(), weekday: 4, project: '瑜伽', targetMinutes: 25, note: '放松拉伸', completed: true },
    { id: uid(), weekday: 6, project: '骑行', targetMinutes: 60, note: '周末户外', completed: false },
  ],
}
