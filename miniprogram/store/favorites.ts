import type { Dish } from '../services/types'

type Listener = (ids: string[]) => void

const FAVORITES_KEY = 'kfl_favorites_v1'
const FAVORITES_TIMES_KEY = 'kfl_favorites_times_v1'

class FavoritesStore {
  private ids: string[] = []
  private times: Record<string, number> = {}
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
      const rawTimes = wx.getStorageSync(FAVORITES_TIMES_KEY)
      if (rawTimes) {
        const times = JSON.parse(rawTimes)
        if (times && typeof times === 'object') {
          Object.keys(times).forEach(id => {
            const value = Number(times[id])
            if (isFinite(value) && value > 0) {
              this.times[id] = value
            }
          })
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
      delete this.times[id]
    } else {
      this.ids.push(id)
      this.times[id] = Date.now()
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

  getTime(id: string): number {
    return Number(this.times[id] || 0)
  }

  clear(): void {
    this.ids = []
    this.times = {}
    this.persist()
    this.emit()
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
      wx.setStorageSync(FAVORITES_TIMES_KEY, JSON.stringify(this.times))
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
