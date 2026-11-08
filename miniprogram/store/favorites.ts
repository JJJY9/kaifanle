import type { Dish, FavoritesCloudData } from '../services/types'
import { getFavoritesCloud, saveFavoritesCloud } from '../services/api'

type Listener = (ids: string[]) => void

const FAVORITES_KEY = 'kfl_favorites_v1'
const FAVORITES_TIMES_KEY = 'kfl_favorites_times_v1'
const FAVORITES_REMOVED_KEY = 'kfl_favorites_removed_v1'
const FAVORITES_SYNC_KEY = 'kfl_favorites_sync_v1'
const SYNC_DEBOUNCE = 1200
const SYNC_PULL_TTL = 60 * 1000
const SYNC_TOMBSTONE_TTL = 90 * 24 * 60 * 60 * 1000

interface FavoriteState {
  ids: string[]
  times: Record<string, number>
  removed: Record<string, number>
}

function mergeFavoriteState(
  a: Partial<FavoriteState> | null,
  b: Partial<FavoriteState> | null
): FavoriteState {
  const favAt: Record<string, number> = {}
  const removedAt: Record<string, number> = {}
  ;[a, b].forEach(src => {
    const item: any = src || {}
    ;(item.ids || []).forEach((id: string) => {
      const at = Number((item.times || {})[id] || 0) || 1
      if (!favAt[id] || at > favAt[id]) {
        favAt[id] = at
      }
    })
    Object.keys(item.removed || {}).forEach(id => {
      const at = Number(item.removed[id] || 0)
      if (at > (removedAt[id] || 0)) {
        removedAt[id] = at
      }
    })
  })
  const ids = Object.keys(favAt)
    .filter(id => (favAt[id] || 0) > (removedAt[id] || 0))
    .sort((x, y) => (favAt[x] || 0) - (favAt[y] || 0))
  const times: Record<string, number> = {}
  ids.forEach(id => {
    times[id] = favAt[id]
  })
  const cutoff = Date.now() - SYNC_TOMBSTONE_TTL
  const removed: Record<string, number> = {}
  Object.keys(removedAt).forEach(id => {
    if ((removedAt[id] || 0) >= (favAt[id] || 0) && removedAt[id] > cutoff) {
      removed[id] = removedAt[id]
    }
  })
  return { ids, times, removed }
}

function sameFavoriteState(a: FavoriteState, b: FavoriteState): boolean {
  if (a.ids.length !== b.ids.length) {
    return false
  }
  for (let i = 0; i < a.ids.length; i++) {
    if (a.ids[i] !== b.ids[i]) {
      return false
    }
    if (Number(a.times[a.ids[i]] || 0) !== Number(b.times[b.ids[i]] || 0)) {
      return false
    }
  }
  const aKeys = Object.keys(a.removed)
  const bKeys = Object.keys(b.removed)
  if (aKeys.length !== bKeys.length) {
    return false
  }
  return aKeys.every(key => Number(a.removed[key]) === Number(b.removed[key]))
}

class FavoritesStore {
  private ids: string[] = []
  private times: Record<string, number> = {}
  private removed: Record<string, number> = {}
  private listeners: Listener[] = []
  private syncedAt = 0
  private lastPullAt = 0
  private syncTimer: any = null
  private pushing = false

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
      const rawRemoved = wx.getStorageSync(FAVORITES_REMOVED_KEY)
      if (rawRemoved) {
        const removed = JSON.parse(rawRemoved)
        if (removed && typeof removed === 'object') {
          Object.keys(removed).forEach(id => {
            const value = Number(removed[id])
            if (isFinite(value) && value > 0) {
              this.removed[id] = value
            }
          })
        }
      }
      const rawSync = wx.getStorageSync(FAVORITES_SYNC_KEY)
      if (rawSync) {
        const meta = JSON.parse(rawSync)
        const at = Number(meta && meta.updatedAt)
        if (isFinite(at) && at > 0) {
          this.syncedAt = at
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
      this.removed[id] = Date.now()
    } else {
      this.ids.push(id)
      this.times[id] = Date.now()
      delete this.removed[id]
    }
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
    const at = Date.now()
    this.ids.forEach(id => {
      this.removed[id] = at
    })
    this.ids = []
    this.times = {}
    this.persist()
    this.emit()
    this.scheduleSync()
  }

  snapshot(): FavoritesCloudData {
    return {
      ids: this.getIds(),
      times: Object.assign({}, this.times),
      removed: Object.assign({}, this.removed),
      updatedAt: this.syncedAt,
      baseUpdatedAt: this.syncedAt
    }
  }

  private state(): FavoriteState {
    return {
      ids: this.getIds(),
      times: Object.assign({}, this.times),
      removed: Object.assign({}, this.removed)
    }
  }

  private applyState(state: FavoriteState) {
    this.ids = state.ids.slice()
    this.times = Object.assign({}, state.times)
    this.removed = Object.assign({}, state.removed)
  }

  // 拉取云端并与本地按条合并；本地有未上云改动时回推。返回本地是否变化
  async syncFromCloud(force = false, strict = false): Promise<boolean> {
    if (!force && Date.now() - this.lastPullAt < SYNC_PULL_TTL) {
      return false
    }
    try {
      const remote = await getFavoritesCloud()
      this.lastPullAt = Date.now()
      if (!remote) {
        return false
      }
      const remoteState: FavoriteState = {
        ids: (remote.ids || []).filter(id => typeof id === 'string'),
        times: Object.assign({}, remote.times || {}),
        removed: Object.assign({}, remote.removed || {})
      }
      const local = this.state()
      const merged = mergeFavoriteState(local, remoteState)
      const changed = !sameFavoriteState(merged, local)
      this.applyState(merged)
      this.syncedAt = Number(remote.updatedAt || 0)
      this.persist()
      if (changed) {
        this.emit()
      }
      if (!sameFavoriteState(merged, remoteState)) {
        await this.pushToCloud(strict)
      }
      return changed
    } catch (e) {
      // 云端同步失败不影响本地收藏；手动同步时上抛让页面提示失败
      if (strict) {
        throw e
      }
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

  private async pushToCloud(strict = false): Promise<void> {
    if (this.pushing) {
      if (!strict) {
        return
      }
      for (let i = 0; i < 40 && this.pushing; i++) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      if (this.pushing) {
        throw new Error('正在同步，请稍后再试')
      }
    }
    this.pushing = true
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const res: any = await saveFavoritesCloud(this.snapshot())
        if (!res) {
          return
        }
        const remoteState: FavoriteState = {
          ids: (res.ids || []).filter((id: any) => typeof id === 'string'),
          times: Object.assign({}, res.times || {}),
          removed: Object.assign({}, res.removed || {})
        }
        if (res.conflict) {
          const merged = mergeFavoriteState(this.state(), remoteState)
          this.applyState(merged)
          this.syncedAt = Number(res.updatedAt || 0)
          this.persist()
          this.emit()
          continue
        }
        const merged = mergeFavoriteState(this.state(), remoteState)
        this.applyState(merged)
        this.syncedAt = Number(res.updatedAt || 0)
        this.persist()
        this.emit()
        if (sameFavoriteState(merged, remoteState)) {
          return
        }
        // 推送期间本地又有改动，继续把新改动推上去
      }
    } catch (e) {
      // 推送失败时保留本地，下次改动再试；手动同步时上抛
      if (strict) {
        throw e
      }
    } finally {
      this.pushing = false
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
      wx.setStorageSync(FAVORITES_REMOVED_KEY, JSON.stringify(this.removed))
      wx.setStorageSync(
        FAVORITES_SYNC_KEY,
        JSON.stringify({ updatedAt: this.syncedAt })
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
