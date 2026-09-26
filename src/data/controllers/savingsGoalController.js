import { storage } from '../../core/storage.js'
import { uid } from '../../core/utils.js'
import { STORAGE_KEYS, DEFAULT_GOAL_TYPE } from '../../core/constants.js'

export const emptyGoalForm = () => ({
  name: '',
  targetAmount: '',
  targetDate: '',
  savedAmount: ''
})

export function loadGoals() {
  const goals = storage.getJSON(STORAGE_KEYS.savingsGoals) || []
  // 兼容旧数据：没有存入明细的目标，按当前已存补一条初始记录
  let migrated = false
  const normalized = goals.map((g) => {
    if (Array.isArray(g.deposits)) return g
    migrated = true
    const saved = Number(g.savedAmount) || 0
    return {
      ...g,
      deposits: saved > 0
        ? [{ id: uid(), kind: 'initial', amount: saved, note: '初始已存', createdAt: 0 }]
        : []
    }
  })
  if (migrated) saveGoals(normalized)
  return normalized
}

export function saveGoals(goals) {
  storage.setJSON(STORAGE_KEYS.savingsGoals, goals)
}

export function normalizeGoal(form) {
  const savedAmount = Number(form.savedAmount) || 0
  return {
    id: uid(),
    name: String(form.name || '').trim(),
    type: DEFAULT_GOAL_TYPE,
    targetAmount: Number(form.targetAmount) || 0,
    targetDate: form.targetDate || '',
    savedAmount,
    deposits: savedAmount > 0
      ? [{ id: uid(), kind: 'initial', amount: savedAmount, note: '初始已存', createdAt: Date.now() }]
      : []
  }
}

export function addGoal(form) {
  const goal = normalizeGoal(form)
  saveGoals([...loadGoals(), goal])
  return goal
}

export function updateGoal(id, form) {
  const goals = loadGoals().map((g) =>
    g.id === id
      ? { ...g, name: String(form.name || '').trim(), targetAmount: Number(form.targetAmount) || 0, targetDate: form.targetDate || '' }
      : g
  )
  saveGoals(goals)
}

export function addGoalSaving(id, amount) {
  const value = Number(amount) || 0
  if (value <= 0) return
  const goals = loadGoals().map((g) => {
    if (g.id !== id) return g
    const deposit = { id: uid(), kind: 'saving', amount: value, note: '', createdAt: Date.now() }
    return { ...g, savedAmount: Number(g.savedAmount || 0) + value, deposits: [...(g.deposits || []), deposit] }
  })
  saveGoals(goals)
}

export function removeGoalSaving(goalId, depositId, confirmFn = window.confirm) {
  const goal = loadGoals().find((g) => g.id === goalId)
  const deposit = goal && (goal.deposits || []).find((d) => d.id === depositId)
  if (!deposit) return false
  if (!confirmFn(`确认删除这笔 ¥${Number(deposit.amount).toFixed(2)} 的存入记录吗？已存金额和进度将相应回退。`)) return false
  const goals = loadGoals().map((g) => {
    if (g.id !== goalId) return g
    const deposits = (g.deposits || []).filter((d) => d.id !== depositId)
    return { ...g, deposits, savedAmount: Math.max(0, Number(g.savedAmount || 0) - Number(deposit.amount)) }
  })
  saveGoals(goals)
  return true
}

export function removeGoal(id, confirmFn = window.confirm) {
  if (!confirmFn(`确认删除储蓄目标「${id}」吗？`)) return false
  saveGoals(loadGoals().filter((g) => g.id !== id))
  return true
}
