import type { EatenCloudData } from '../services/types'
import { getEatenCloud, saveEatenCloud } from '../services/api'

const EATEN_KEY = 'kfl_eaten_v1'
const EATEN_OPS_KEY = 'kfl_eaten_ops_v1'
const EATEN_REMOVED_KEY = 'kfl_eaten_removed_v1'
const EATEN_SYNC_KEY = 'kfl_eaten_sync_v1'
const SYNC_DEBOUNCE = 1200
const SYNC_PULL_TTL = 60 * 1000
const SYNC_TOMBSTONE_TTL = 90 * 24 * 60 * 60 * 1000

interface EatenState {
  map: Record<string, number>
  ops: Record<string, number>
  removed: Record<string, number>
}

let syncedAt = 0
let metaLoaded = false
let lastPullAt = 0
let syncTimer: any = null
let pushing = false

function readSyncMeta() {
  if (metaLoaded) {
    return
  }
  metaLoaded = true
  try {
    const raw = wx.getStorageSync(EATEN_SYNC_KEY)
    const meta = raw ? JSON.parse(raw) : null
    const at = Number(meta && meta.updatedAt)
    if (isFinite(at) && at > 0) {
      syncedAt = at
    }
  } catch (e) {
    // 忽略同步元数据损坏
  }
}

function readNumberMap(key: string): Record<string, number> {
  try {
    const raw = wx.getStorageSync(key)
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

function state(): EatenState {
  readSyncMeta()
  const map = readNumberMap(EATEN_KEY)
  const rawOps = readNumberMap(EATEN_OPS_KEY)
  const ops: Record<string, number> = {}
  Object.keys(map).forEach(id => {
    ops[id] = Number(rawOps[id] || map[id])
  })
  return {
    map,
    ops,
    removed: readNumberMap(EATEN_REMOVED_KEY)
  }
}

function mergeEatenState(
  a: Partial<EatenState> | null,
  b: Partial<EatenState> | null
): EatenState {
  const eatAt: Record<string, number> = {}
  const eatOp: Record<string, number> = {}
  const cancelOp: Record<string, number> = {}
  ;[a, b].forEach(src => {
    const item: any = src || {}
    Object.keys(item.map || {}).forEach(id => {
      const at = Number(item.map[id] || 0)
      const op = Number((item.ops || {})[id] || 0) || at
      if (
        op > (eatOp[id] || 0) ||
        (op === (eatOp[id] || 0) && at > (eatAt[id] || 0))
      ) {
        eatAt[id] = at
        eatOp[id] = op
      }
    })
    Object.keys(item.removed || {}).forEach(id => {
      const at = Number(item.removed[id] || 0)
      if (at > (cancelOp[id] || 0)) {
        cancelOp[id] = at
      }
    })
  })
  const map: Record<string, number> = {}
  const ops: Record<string, number> = {}
  Object.keys(eatAt).forEach(id => {
    const op = eatOp[id] || 0
    const cancel = cancelOp[id] || 0
    if (cancel && cancel >= op) {
      return
    }
    map[id] = eatAt[id]
    ops[id] = op
  })
  const cutoff = Date.now() - SYNC_TOMBSTONE_TTL
  const removed: Record<string, number> = {}
  Object.keys(cancelOp).forEach(id => {
    const cancel = cancelOp[id] || 0
    const op = eatOp[id] || 0
    if (cancel >= op && cancel > cutoff) {
      removed[id] = cancel
    }
  })
  return { map, ops, removed }
}

function sameEatenState(a: EatenState, b: EatenState): boolean {
  const keys = ['map', 'ops', 'removed'] as const
  for (const field of keys) {
    const aKeys = Object.keys(a[field])
    const bKeys = Object.keys(b[field])
    if (aKeys.length !== bKeys.length) {
      return false
    }
    if (
      !aKeys.every(key => Number(a[field][key]) === Number(b[field][key]))
    ) {
      return false
    }
  }
  return true
}

function persist(next: EatenState) {
  try {
    wx.setStorageSync(EATEN_KEY, JSON.stringify(next.map))
    wx.setStorageSync(EATEN_OPS_KEY, JSON.stringify(next.ops))
    wx.setStorageSync(EATEN_REMOVED_KEY, JSON.stringify(next.removed))
    wx.setStorageSync(EATEN_SYNC_KEY, JSON.stringify({ updatedAt: syncedAt }))
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
  if (pushing) {
    return
  }
  pushing = true
  readSyncMeta()
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const local = state()
      const res: any = await saveEatenCloud({
        map: local.map,
        ops: local.ops,
        removed: local.removed,
        updatedAt: syncedAt,
        baseUpdatedAt: syncedAt
      })
      if (!res) {
        return
      }
      const remoteState: EatenState = {
        map: Object.assign({}, res.map || {}),
        ops: Object.assign({}, res.ops || {}),
        removed: Object.assign({}, res.removed || {})
      }
      if (res.conflict) {
        const merged = mergeEatenState(state(), remoteState)
        syncedAt = Number(res.updatedAt || 0)
        persist(merged)
        continue
      }
      const merged = mergeEatenState(state(), remoteState)
      syncedAt = Number(res.updatedAt || 0)
      persist(merged)
      if (sameEatenState(merged, remoteState)) {
        return
      }
      // 推送期间本地又有改动，继续把新改动推上去
    }
  } catch (e) {
    // 推送失败时保留本地，下次改动再试
  } finally {
    pushing = false
  }
}

export function recordEaten(dishIds: string[], at: number = Date.now()) {
  const current = state()
  const now = Date.now()
  let changed = false
  ;(dishIds || []).forEach(id => {
    const key = String(id || '').trim()
    if (!key) {
      return
    }
    const existing = Number(current.map[key] || 0)
    // 未来餐期不覆盖今天或更早的真实记录
    if (at > now && existing && existing <= now) {
      return
    }
    current.map[key] = at
    current.ops[key] = now
    delete current.removed[key]
    changed = true
  })
  if (!changed) {
    return
  }
  persist(current)
  scheduleSync()
}

export function removeEaten(dishIds: string[], at: number) {
  const current = state()
  let changed = false
  ;(dishIds || []).forEach(id => {
    const key = String(id || '').trim()
    if (key && Number(current.map[key] || 0) === Number(at)) {
      delete current.map[key]
      delete current.ops[key]
      current.removed[key] = Date.now()
      changed = true
    }
  })
  if (!changed) {
    return
  }
  persist(current)
  scheduleSync()
}

export function getLastEatenMap(): Record<string, number> {
  return readNumberMap(EATEN_KEY)
}

// 拉取云端「吃过」记录并按条合并；本地有未上云改动时回推。返回本地是否变化
export async function syncEatenFromCloud(force = false): Promise<boolean> {
  readSyncMeta()
  if (!force && Date.now() - lastPullAt < SYNC_PULL_TTL) {
    return false
  }
  try {
    const remote = await getEatenCloud()
    lastPullAt = Date.now()
    if (!remote) {
      return false
    }
    const local = state()
    const remoteState: EatenState = {
      map: Object.assign({}, remote.map || {}),
      ops: Object.assign({}, remote.ops || {}),
      removed: Object.assign({}, remote.removed || {})
    }
    const merged = mergeEatenState(local, remoteState)
    const changed = !sameEatenState(merged, local)
    syncedAt = Number(remote.updatedAt || 0)
    persist(merged)
    if (!sameEatenState(merged, remoteState)) {
      await pushEaten()
    }
    return changed
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
