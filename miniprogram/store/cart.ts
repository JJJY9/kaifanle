import type { CartLine, MealId } from '../services/types'
import { currentMeal, dateInputString } from '../utils/format'

type Listener = (lines: CartLine[]) => void

const CART_KEY = 'kfl_cart_v1'
const MEALS: MealId[] = ['breakfast', 'lunch', 'dinner']

function normalizeMeal(value: any): MealId {
  return MEALS.indexOf(value) > -1 ? value : currentMeal()
}

function normalizeDate(value: any): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    ? String(value)
    : dateInputString()
}

function lineKey(line: CartLine): string {
  return [line.date, line.meal, line.dishId, line.specs.join('|'), line.note].join('::')
}

class CartStore {
  private lines: CartLine[] = []
  private listeners: Listener[] = []

  constructor() {
    try {
      const raw = wx.getStorageSync(CART_KEY)
      if (raw) {
        const lines = JSON.parse(raw)
        if (Array.isArray(lines)) {
          // 旧版购物车没有 meal，按打开时的餐次迁移，并重算包含餐次的 key
          this.lines = lines
            .filter(line => line && line.dishId)
            .map(line => {
              const migrated: CartLine = {
                ...line,
                meal: normalizeMeal(line.meal),
                date: normalizeDate(line.date),
                specs: Array.isArray(line.specs) ? line.specs : [],
                qty: Math.max(1, Number(line.qty) || 1)
              }
              migrated.key = lineKey(migrated)
              return migrated
            })
        }
      }
    } catch (e) {
      // 本地购物车损坏时从空开始
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.push(fn)
    fn(this.snapshot())
    return () => {
      this.listeners = this.listeners.filter(item => item !== fn)
    }
  }

  add(line: CartLine): void {
    const key = lineKey(line)
    const found = this.lines.find(item => item.key === key)
    if (found) {
      found.qty += line.qty
    } else {
      this.lines.push({ ...line, key })
    }
    this.persist()
    this.emit()
  }

  changeQty(key: string, delta: number): void {
    const line = this.lines.find(item => item.key === key)
    if (!line) {
      return
    }
    line.qty += delta
    if (line.qty <= 0) {
      this.lines = this.lines.filter(item => item.key !== key)
    }
    this.persist()
    this.emit()
  }

  updatePrice(key: string, price: number): void {
    const line = this.lines.find(item => item.key === key)
    if (!line || line.price === price) {
      return
    }
    line.price = price
    this.persist()
    this.emit()
  }

  remove(key: string): void {
    this.lines = this.lines.filter(item => item.key !== key)
    this.persist()
    this.emit()
  }

  clear(): void {
    this.lines = []
    this.persist()
    this.emit()
  }

  clearMeal(meal: MealId): void {
    this.lines = this.lines.filter(line => line.meal !== meal)
    this.persist()
    this.emit()
  }

  clearSlot(meal: MealId, date: string): void {
    this.lines = this.lines.filter(
      line => !(line.meal === meal && line.date === date)
    )
    this.persist()
    this.emit()
  }

  getLines(): CartLine[] {
    return this.snapshot()
  }

  getCount(): number {
    return this.lines.reduce((sum, line) => sum + line.qty, 0)
  }

  getTotal(): number {
    return this.lines.reduce((sum, line) => sum + line.qty * line.price, 0)
  }

  private snapshot(): CartLine[] {
    return this.lines.map(line => ({ ...line, specs: [...line.specs] }))
  }

  private persist(): void {
    try {
      wx.setStorageSync(CART_KEY, JSON.stringify(this.lines))
    } catch (e) {
      // 忽略存储失败
    }
  }

  private emit(): void {
    const lines = this.snapshot()
    this.listeners.forEach(fn => fn(lines))
  }
}

export const cart = new CartStore()
