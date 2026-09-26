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
  return storage.getJSON(STORAGE_KEYS.savingsGoals) || []
}

export function saveGoals(goals) {
  storage.setJSON(STORAGE_KEYS.savingsGoals, goals)
}

export function loadGoalDeposits() {
  return storage.getJSON(STORAGE_KEYS.goalDeposits) || []
}

export function saveGoalDeposits(deposits) {
  storage.setJSON(STORAGE_KEYS.goalDeposits, deposits)
}

const round2 = (n) => Math.round(n * 100) / 100

export function normalizeGoal(form) {
  return {
    id: uid(),
    name: String(form.name || '').trim(),
    type: DEFAULT_GOAL_TYPE,
    targetAmount: Number(form.targetAmount) || 0,
    targetDate: form.targetDate || '',
    savedAmount: Number(form.savedAmount) || 0
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
  const num = round2(Number(amount))
  if (!num || num <= 0) return null
  const goals = loadGoals()
  if (!goals.some((g) => g.id === id)) return null
  saveGoals(goals.map((g) =>
    g.id === id ? { ...g, savedAmount: round2(Number(g.savedAmount || 0) + num) } : g
  ))
  const deposit = { id: uid(), goalId: id, amount: num, createdAt: Date.now() }
  saveGoalDeposits([...loadGoalDeposits(), deposit])
  return deposit
}

export function removeGoalDeposit(goalId, depositId, confirmFn = window.confirm) {
  const deposits = loadGoalDeposits()
  const deposit = deposits.find((d) => d.id === depositId && d.goalId === goalId)
  if (!deposit) return false
  if (!confirmFn(`确认删除这条 ¥${deposit.amount} 的存入记录吗？目标进度和已存金额将同步回退。`)) return false
  saveGoalDeposits(deposits.filter((d) => d.id !== deposit.id))
  saveGoals(loadGoals().map((g) =>
    g.id === goalId ? { ...g, savedAmount: Math.max(0, round2(Number(g.savedAmount || 0) - deposit.amount)) } : g
  ))
  return true
}

export function removeGoal(id, confirmFn = window.confirm) {
  if (!confirmFn(`确认删除储蓄目标「${id}」吗？`)) return false
  saveGoals(loadGoals().filter((g) => g.id !== id))
  saveGoalDeposits(loadGoalDeposits().filter((d) => d.goalId !== id))
  return true
}
