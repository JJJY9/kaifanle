import type { CartLine } from '../services/types'

type Listener = (lines: CartLine[]) => void

const CART_KEY = 'kfl_cart_v1'

class CartStore {
  private lines: CartLine[] = []
  private listeners: Listener[] = []

  constructor() {
    try {
      const raw = wx.getStorageSync(CART_KEY)
      if (raw) {
        const lines = JSON.parse(raw)
        if (Array.isArray(lines)) {
          this.lines = lines
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
    const key =
      line.key || [line.dishId, line.specs.join('|'), line.note].join('::')
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
