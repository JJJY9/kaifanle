import type { Dish, FavoritesCloudData } from '../services/types'
import { getFavoritesCloud, saveFavoritesCloud } from '../services/api'

type Listener = (ids: string[]) => void

const FAVORITES_KEY = 'kfl_favorites_v1'
const FAVORITES_TIMES_KEY = 'kfl_favorites_times_v1'
const FAVORITES_SYNC_KEY = 'kfl_favorites_sync_v1'
const SYNC_DEBOUNCE = 1200

class FavoritesStore {
  private ids: string[] = []
  private times: Record<string, number> = {}
  private listeners: Listener[] = []
  private updatedAt = 0
  private syncTimer: any = null

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
      const rawSync = wx.getStorageSync(FAVORITES_SYNC_KEY)
      if (rawSync) {
        const meta = JSON.parse(rawSync)
        const at = Number(meta && meta.updatedAt)
        if (isFinite(at) && at > 0) {
          this.updatedAt = at
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
    this.updatedAt = Date.now()
    this.persist()
    this.emit()
    this.scheduleSync()
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
    this.updatedAt = Date.now()
    this.persist()
    this.emit()
    this.scheduleSync()
  }

  snapshot(): FavoritesCloudData {
    return {
      ids: this.getIds(),
      times: Object.assign({}, this.times),
      updatedAt: this.updatedAt
    }
  }

  // 拉取云端收藏；本地更新更晚时改为推送本地。返回本地是否被云端覆盖
  async syncFromCloud(): Promise<boolean> {
    try {
      const remote = await getFavoritesCloud()
      if (!remote) {
        return false
      }
      const remoteAt = Number(remote.updatedAt || 0)
      if (remoteAt > this.updatedAt) {
        this.ids = (remote.ids || []).filter(id => typeof id === 'string')
        this.times = {}
        this.ids.forEach(id => {
          const at = Number((remote.times || {})[id])
          if (isFinite(at) && at > 0) {
            this.times[id] = at
          }
        })
        this.updatedAt = remoteAt
        this.persist()
        this.emit()
        return true
      }
      if (!remoteAt && !this.updatedAt && this.ids.length) {
        // 老版本本地收藏没有同步时间，首次同步时推上去
        this.updatedAt = Date.now()
        this.persist()
        await this.pushToCloud()
        return false
      }
      if (this.updatedAt > remoteAt && this.ids.length) {
        await this.pushToCloud()
      }
      return false
    } catch (e) {
      // 云端同步失败不影响本地收藏
      return false
    }
  }

  private scheduleSync() {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer)
    }
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null
      this.pushToCloud()
    }, SYNC_DEBOUNCE)
  }

  private async pushToCloud(): Promise<void> {
    try {
      await saveFavoritesCloud(this.snapshot())
    } catch (e) {
      // 推送失败时保留本地，下次改动再试
    }
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
      wx.setStorageSync(
        FAVORITES_SYNC_KEY,
        JSON.stringify({ updatedAt: this.updatedAt })
      )
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
