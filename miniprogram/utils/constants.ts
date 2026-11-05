import type { MealId, OrderStatus } from '../services/types'

export const MEALS: Array<{ id: MealId; name: string }> = [
  { id: 'breakfast', name: '早餐' },
  { id: 'lunch', name: '午餐' },
  { id: 'dinner', name: '晚餐' }
]

export const STATUS_TEXT: Record<OrderStatus, string> = {
  pending: '待接单',
  accepted: '已接单',
  cooking: '制作中',
  ready: '待取餐',
  completed: '已完成',
  cancelled: '已取消'
}

export const STATUS_STEP_TEXT: Record<OrderStatus, string> = {
  pending: '已下单',
  accepted: '已接单 · 锅已热',
  cooking: '制作中 · 正在炒',
  ready: '出锅啦',
  completed: '已完成',
  cancelled: '已取消'
}

export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'accepted',
  accepted: 'cooking',
  cooking: 'ready',
  ready: 'completed'
}

export const NEXT_ACTION: Partial<Record<OrderStatus, string>> = {
  pending: '接单',
  accepted: '开火',
  cooking: '出锅',
  ready: '完成'
}

export function mealName(id: MealId): string {
  const meal = MEALS.find(item => item.id === id)
  return meal ? meal.name : ''
}
