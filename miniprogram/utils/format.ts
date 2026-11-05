import type { MealId } from '../services/types'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function formatDate(ts: number = Date.now()): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日 · ${WEEK[d.getDay()]}`
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return '这么晚，饿不饿？'
  if (h < 10) return '早上好呀'
  if (h < 14) return '中午吃点啥'
  if (h < 18) return '下午好呀'
  return '晚上吃点啥'
}

export function currentMeal(): MealId {
  const h = new Date().getHours()
  if (h < 10) return 'breakfast'
  if (h < 15) return 'lunch'
  return 'dinner'
}

export function isOpenNow(): boolean {
  const h = new Date().getHours()
  return h >= 6 && h < 22
}

export function formatPrice(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function dateInputString(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateLabel(
  dateString: string,
  todayString?: string
): string {
  if (!dateString) {
    return '今天'
  }
  const today = todayString || dateInputString()
  const target = new Date(dateString + 'T00:00:00')
  const base = new Date(today + 'T00:00:00')
  if (isNaN(target.getTime())) {
    return dateString
  }
  const diff = Math.round(
    (target.getTime() - base.getTime()) / (24 * 60 * 60 * 1000)
  )
  if (diff < 0) {
    return diff === -1
      ? '昨天'
      : `${target.getMonth() + 1}月${target.getDate()}日`
  }
  if (diff === 0) {
    return '今天'
  }
  if (diff === 1) {
    return '明天'
  }
  if (diff === 2) {
    return '后天'
  }
  return `${target.getMonth() + 1}月${target.getDate()}日`
}

export function itemSummary(names: string[]): string {
  if (!names.length) return ''
  return names.length > 1 ? `${names[0]} 等 ${names.length} 样` : names[0]
}
