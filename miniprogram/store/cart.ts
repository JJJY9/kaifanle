import type { CartLine } from '../services/types'

type Listener = (lines: CartLine[]) => void

class CartStore {
  private lines: CartLine[] = []
  private listeners: Listener[] = []

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
    this.emit()
  }

  remove(key: string): void {
    this.lines = this.lines.filter(item => item.key !== key)
    this.emit()
  }

  clear(): void {
    this.lines = []
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

  private emit(): void {
    const lines = this.snapshot()
    this.listeners.forEach(fn => fn(lines))
  }
}

export const cart = new CartStore()
