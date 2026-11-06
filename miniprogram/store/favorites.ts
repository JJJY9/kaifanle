import type { Dish } from '../services/types'

type Listener = (ids: string[]) => void

const FAVORITES_KEY = 'kfl_favorites_v1'

class FavoritesStore {
  private ids: string[] = []
  private listeners: Listener[] = []

  constructor() {
    try {
      const raw = wx.getStorageSync(FAVORITES_KEY)
      if (raw) {
        const ids = JSON.parse(raw)
        if (Array.isArray(ids)) {
          this.ids = ids.filter(id => typeof id === 'string')
        }
      }
    } catch (e) {
      // 本地数据损坏时从空开始
    }
  }

  has(id: string): boolean {
    return this.ids.indexOf(id) > -1
  }

  toggle(id: string): boolean {
    if (!id) {
      return false
    }
    const index = this.ids.indexOf(id)
    if (index > -1) {
      this.ids.splice(index, 1)
    } else {
      this.ids.push(id)
    }
    this.persist()
    this.emit()
    return this.has(id)
  }

  getIds(): string[] {
    return this.ids.slice()
  }

  count(): number {
    return this.ids.length
  }

  filter(dishes: Dish[]): Dish[] {
    return dishes.filter(dish => this.has(dish.id))
  }

  subscribe(fn: Listener): () => void {
    this.listeners.push(fn)
    fn(this.getIds())
    return () => {
      this.listeners = this.listeners.filter(item => item !== fn)
    }
  }

  private persist() {
    try {
      wx.setStorageSync(FAVORITES_KEY, JSON.stringify(this.ids))
    } catch (e) {
      // 忽略存储失败
    }
  }

  private emit() {
    const ids = this.getIds()
    this.listeners.forEach(fn => fn(ids))
  }
}

export const favorites = new FavoritesStore()
