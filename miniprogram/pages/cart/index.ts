import type { CartLine, MealId } from '../../services/types'
import { cart } from '../../store/cart'
import { mealName } from '../../utils/constants'
import { dateInputString, dateLabel } from '../../utils/format'
import { dishEmoji } from '../../utils/dish-emoji'

const MEAL_ORDER: MealId[] = ['breakfast', 'lunch', 'dinner']

interface CartItemView extends CartLine {
  char: string
  specText: string
  lineTotal: number
}

interface CartGroupView {
  key: string
  date: string
  meal: MealId
  dateText: string
  mealText: string
  past: boolean
  items: CartItemView[]
  count: number
  total: number
}

Page({
  data: {
    groups: [] as CartGroupView[],
    count: 0,
    total: 0
  },

  onShow() {
    this.render()
  },

  render() {
    const lines = cart.getLines()
    const map: Record<string, CartLine[]> = {}
    lines.forEach(line => {
      const key = `${line.date}::${line.meal}`
      if (!map[key]) {
        map[key] = []
      }
      map[key].push(line)
    })
    const today = dateInputString()
    const groups: CartGroupView[] = Object.keys(map)
      .sort((a, b) => {
        const [dateA, mealA] = a.split('::')
        const [dateB, mealB] = b.split('::')
        if (dateA !== dateB) {
          return dateA < dateB ? -1 : 1
        }
        return MEAL_ORDER.indexOf(mealA as MealId) - MEAL_ORDER.indexOf(mealB as MealId)
      })
      .map(key => {
        const [date, meal] = key.split('::')
        const items = map[key].map(line => ({
          ...line,
          char: dishEmoji(line.name),
          specText: line.specs.join(' / '),
          lineTotal: line.price * line.qty
        }))
        return {
          key,
          date,
          meal: meal as MealId,
          dateText: dateLabel(date, today),
          mealText: mealName(meal as MealId),
          past: date < today,
          items,
          count: items.reduce((sum, item) => sum + item.qty, 0),
          total: items.reduce((sum, item) => sum + item.lineTotal, 0)
        }
      })
    this.setData({
      groups,
      count: groups.reduce((sum, group) => sum + group.count, 0),
      total: groups.reduce((sum, group) => sum + group.total, 0)
    })
  },

  onChangeQty(e: any) {
    const key = e.currentTarget.dataset.key
    const delta = Number(e.currentTarget.dataset.delta)
    if (!key || !delta) {
      return
    }
    cart.changeQty(key, delta)
    this.render()
  },

  onRemove(e: any) {
    const key = e.currentTarget.dataset.key
    if (!key) {
      return
    }
    cart.remove(key)
    this.render()
  },

  onClearGroup(e: any) {
    const meal = e.currentTarget.dataset.meal as MealId
    const date = e.currentTarget.dataset.date
    if (!meal || !date) {
      return
    }
    cart.clearSlot(meal, date)
    this.render()
  },

  onCheckout(e: any) {
    const meal = e.currentTarget.dataset.meal
    const date = e.currentTarget.dataset.date
    if (!meal || !date) {
      return
    }
    wx.navigateTo({
      url: `/pages/checkout/index?meal=${meal}&date=${date}`
    })
  },

  onGoHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
