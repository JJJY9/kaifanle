import { getEatenCloud, saveEatenCloud } from '../services/api'

const EATEN_KEY = 'kfl_eaten_v1'
const EATEN_SYNC_KEY = 'kfl_eaten_sync_v1'
const SYNC_DEBOUNCE = 1200

let updatedAt = 0
let metaLoaded = false
let syncTimer: any = null

function readSyncMeta(): number {
  if (metaLoaded) {
    return updatedAt
  }
  metaLoaded = true
  try {
    const raw = wx.getStorageSync(EATEN_SYNC_KEY)
    const meta = raw ? JSON.parse(raw) : null
    const at = Number(meta && meta.updatedAt)
    if (isFinite(at) && at > 0) {
      updatedAt = at
    }
  } catch (e) {
    // 忽略同步元数据损坏
  }
  return updatedAt
}

function read(): Record<string, number> {
  try {
    const raw = wx.getStorageSync(EATEN_KEY)
    const data = raw ? JSON.parse(raw) : {}
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return {}
    }
    const result: Record<string, number> = {}
    Object.keys(data).forEach(id => {
      const at = Number(data[id])
      if (id && Number.isFinite(at) && at > 0) {
        result[id] = at
      }
    })
    return result
  } catch (e) {
    return {}
  }
}

function persist(map: Record<string, number>, touch: boolean) {
  readSyncMeta()
  if (touch) {
    updatedAt = Date.now()
  }
  try {
    wx.setStorageSync(EATEN_KEY, JSON.stringify(map))
    wx.setStorageSync(EATEN_SYNC_KEY, JSON.stringify({ updatedAt }))
  } catch (e) {
    // 忽略存储失败
  }
}

function scheduleSync() {
  if (syncTimer) {
    clearTimeout(syncTimer)
  }
  syncTimer = setTimeout(() => {
    syncTimer = null
    pushEaten()
  }, SYNC_DEBOUNCE)
}

async function pushEaten() {
  try {
    await saveEatenCloud({ map: read(), updatedAt })
  } catch (e) {
    // 推送失败时保留本地，下次改动再试
  }
}

export function recordEaten(dishIds: string[], at: number = Date.now()) {
  const map = read()
  const now = Date.now()
  let changed = false
  ;(dishIds || []).forEach(id => {
    const key = String(id || '').trim()
    if (!key) {
      return
    }
    const existing = Number(map[key] || 0)
    // 未来餐期不覆盖今天或更早的真实记录
    if (at > now && existing && existing <= now) {
      return
    }
    map[key] = at
    changed = true
  })
  if (!changed) {
    return
  }
  persist(map, true)
  scheduleSync()
}

export function removeEaten(dishIds: string[], at: number) {
  const map = read()
  let changed = false
  ;(dishIds || []).forEach(id => {
    const key = String(id || '').trim()
    if (key && Number(map[key] || 0) === Number(at)) {
      delete map[key]
      changed = true
    }
  })
  if (!changed) {
    return
  }
  persist(map, true)
  scheduleSync()
}

export function getLastEatenMap(): Record<string, number> {
  return read()
}

// 拉取云端「吃过」记录；本地更新更晚时改为推送本地。返回本地是否被覆盖
export async function syncEatenFromCloud(): Promise<boolean> {
  readSyncMeta()
  try {
    const remote = await getEatenCloud()
    if (!remote) {
      return false
    }
    const remoteAt = Number(remote.updatedAt || 0)
    if (remoteAt > updatedAt) {
      updatedAt = remoteAt
      try {
        wx.setStorageSync(EATEN_KEY, JSON.stringify(remote.map || {}))
        wx.setStorageSync(EATEN_SYNC_KEY, JSON.stringify({ updatedAt }))
      } catch (e) {
        // 忽略存储失败
      }
      return true
    }
    const local = read()
    if (!remoteAt && !updatedAt && Object.keys(local).length) {
      // 老版本本地记录没有同步时间，首次同步时推上去
      updatedAt = Date.now()
      persist(local, false)
      await pushEaten()
      return false
    }
    if (updatedAt > remoteAt && Object.keys(local).length) {
      await pushEaten()
    }
    return false
  } catch (e) {
    return false
  }
}

export function eatenText(at: number, now: number = Date.now()): string {
  if (!at) {
    return ''
  }
  const from = new Date(at)
  const to = new Date(now)
  from.setHours(0, 0, 0, 0)
  to.setHours(0, 0, 0, 0)
  const days = Math.round((to.getTime() - from.getTime()) / 86400000)
  if (days < 0) {
    return ''
  }
  if (days === 0) {
    return '今天吃过'
  }
  if (days === 1) {
    return '昨天吃过'
  }
  if (days <= 29) {
    return `${days} 天前吃过`
  }
  return ''
}
