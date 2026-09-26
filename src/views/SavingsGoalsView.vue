<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>储蓄目标</h2>
        <p class="page-sub">为家庭的梦想设定里程碑</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">＋ 新建目标</button>
    </div>

    <div class="goals-grid">
      <div v-for="g in goals" :key="g.id" class="card goal-card">
        <div class="goal-head">
          <h3>{{ g.name }}</h3>
          <button class="link-btn danger" @click="remove(g)">删除</button>
        </div>
        <div class="goal-ring-row">
          <div class="ring-wrap">
            <ProgressRing :percent="g.percent" />
            <div class="ring-center">
              <b>{{ g.percent }}%</b>
              <span>已存</span>
            </div>
          </div>
          <div class="goal-nums">
            <div><span>目标金额</span><b>¥{{ money(g.targetAmount) }}</b></div>
            <div><span>已存金额</span><b>¥{{ money(g.savedAmount) }}</b></div>
            <div><span>剩余金额</span><b>¥{{ money(g.remainingAmount) }}</b></div>
            <div><span>目标日期</span><b>{{ g.targetDate }}</b></div>
            <div><span>剩余时间</span><b>{{ g.leftDays }} 天</b></div>
          </div>
        </div>
        <div class="advice" v-if="g.status !== 'done'">
          <strong>达成建议</strong>
          <div>每月需存 <b>¥{{ money(g.monthlyAmount) }}</b>，每周 <b>¥{{ money(g.weeklyAmount) }}</b>，每天 <b>¥{{ money(g.dailyAmount) }}</b></div>
        </div>
        <div class="advice done" v-else>🎉 目标已达成！</div>
        <form class="add-save" @submit.prevent="addSaving(g)">
          <input v-model.number="g.depositInput" :placeholder="`存入金额，当前 ¥${money(g.savedAmount)}`" type="number" min="0.01" step="0.01" required />
          <button class="btn btn-primary" type="submit">存入</button>
        </form>
        <div class="deposit-history">
          <div class="deposit-history-head">
            <span>存入明细</span>
            <em>共 {{ g.deposits.length }} 笔</em>
          </div>
          <div class="deposit-list" v-if="g.deposits.length">
            <div v-for="d in g.deposits" :key="d.id" class="deposit-item">
              <div class="deposit-info">
                <b class="deposit-amount">+¥{{ money(d.amount) }}</b>
                <span class="deposit-time">{{ depositLabel(d) }}</span>
              </div>
              <button class="link-btn danger" @click="removeDeposit(g, d)">删除</button>
            </div>
          </div>
          <div v-else class="deposit-empty">暂无存入记录，完成第一笔存入后这里会显示明细。</div>
        </div>
      </div>
    </div>

    <div class="card empty" v-if="goals.length === 0">
      <p>还没有储蓄目标，点击右上角「新建目标」开始规划。</p>
    </div>

    <Modal title="新建储蓄目标" @close="modalOpen = false" v-if="modalOpen">
      <form id="goal-form" @submit.prevent="submit" class="form">
        <label class="field">
          <span>目标名称</span>
          <input v-model="form.name" required placeholder="如：家庭应急金" />
        </label>
        <label class="field">
          <span>目标金额</span>
          <input v-model.number="form.targetAmount" type="number" min="0.01" step="0.01" required placeholder="10000" />
        </label>
        <label class="field">
          <span>目标日期</span>
          <input v-model="form.targetDate" type="date" required />
        </label>
        <label class="field">
          <span>当前已存</span>
          <input v-model.number="form.savedAmount" type="number" min="0" step="0.01" placeholder="0.00" />
        </label>
      </form>

        <template #footer>
          <button type="button" class="btn" @click="modalOpen = false">取消</button>
          <button type="submit" class="btn btn-primary" form="goal-form">创建目标</button>
        </template>
    </Modal>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { useStore, refreshKeys, controllersApi } from '../data/store.js'
import { money, formatDateTime } from '../core/utils.js'
import ProgressRing from '../components/ProgressRing.vue'
import Modal from '../components/Modal.vue'

const store = useStore()
const { savingsGoal: goalApi } = controllersApi

const modalOpen = ref(false)
const form = reactive(goalApi.emptyGoalForm())

const depositLabel = (d) => {
  const time = Number(d.createdAt) > 0 ? formatDateTime(d.createdAt) : ''
  return d.kind === 'initial' ? `初始已存${time ? ' · ' + time : ''}` : time
}

const goals = computed(() =>
  store.goals.map((g) => {
    const leftDays = Math.max(0, Math.ceil((new Date(g.targetDate + 'T23:59:59') - new Date()) / 86400000))
    const remainingAmount = Math.max(0, g.targetAmount - g.savedAmount)
    const percent = g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0
    return {
      ...g,
      deposits: [...(g.deposits || [])].sort((a, b) => Number(b.createdAt) - Number(a.createdAt)),
      leftDays,
      remainingAmount,
      percent,
      depositInput: 0,
      status: percent >= 100 ? 'done' : 'active',
      monthlyAmount: leftDays > 0 ? remainingAmount / Math.max(1, Math.round(leftDays / 30)) : 0,
      weeklyAmount: leftDays > 0 ? remainingAmount / Math.max(1, Math.round(leftDays / 7)) : 0,
      dailyAmount: leftDays > 0 ? remainingAmount / leftDays : 0
    }
  })
)

const openCreate = () => {
  Object.assign(form, goalApi.emptyGoalForm())
  modalOpen.value = true
}

const submit = () => {
  if (!form.name || !form.targetAmount || !form.targetDate) return
  goalApi.addGoal(form)
  refreshKeys('goals')
  modalOpen.value = false
  controllersApi.achievement.updateAchievements()
  refreshKeys('achievements')
}

const addSaving = (g) => {
  const amount = Number(g.depositInput)
  if (!amount || amount <= 0) return
  goalApi.addGoalSaving(g.id, amount)
  refreshKeys('goals')
  controllersApi.achievement.updateAchievements()
  refreshKeys('achievements')
}

const remove = (g) => {
  if (goalApi.removeGoal(g.id)) refreshKeys('goals')
}

const removeDeposit = (g, d) => {
  if (goalApi.removeGoalSaving(g.id, d.id)) {
    refreshKeys('goals')
    controllersApi.achievement.updateAchievements()
    refreshKeys('achievements')
  }
}
</script>

<style scoped>
.goals-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 14px;
}
.goal-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.goal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.goal-head h3 {
  margin: 0;
  font-size: 16px;
}
.goal-ring-row {
  display: flex;
  gap: 18px;
  align-items: center;
}
.ring-wrap {
  position: relative;
  flex-shrink: 0;
}
.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.ring-center b {
  font-size: 22px;
}
.ring-center span {
  font-size: 11px;
  color: var(--text-secondary);
}
.goal-nums {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.goal-nums div {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
}
.goal-nums b {
  color: var(--text-primary);
  font-size: 13px;
}
.advice {
  background: rgba(79, 141, 249, 0.08);
  border: 1px dashed var(--accent);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.7;
}
.advice strong {
  display: block;
  color: var(--accent);
  font-size: 13px;
}
.advice.done {
  background: rgba(87, 199, 133, 0.1);
  border-color: var(--income);
  color: var(--income);
  font-weight: 700;
}
.add-save {
  display: flex;
  gap: 8px;
}
.add-save input {
  flex: 1;
  padding: 9px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--bg-elevated);
  color: var(--text-primary);
  min-width: 0;
}
.deposit-history {
  border-top: 1px solid var(--border-color);
  padding-top: 10px;
}
.deposit-history-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 8px;
}
.deposit-history-head em {
  font-style: normal;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-secondary);
}
.deposit-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}
.deposit-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--bg-elevated);
}
.deposit-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.deposit-amount {
  font-size: 13px;
  color: var(--income);
}
.deposit-time {
  font-size: 11px;
  color: var(--text-secondary);
}
.deposit-empty {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 2px;
}
</style>
