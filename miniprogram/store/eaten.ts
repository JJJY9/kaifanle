const EATEN_KEY = 'kfl_eaten_v1'

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
  try {
    wx.setStorageSync(EATEN_KEY, JSON.stringify(map))
  } catch (e) {
    // 忽略存储失败
  }
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
  try {
    wx.setStorageSync(EATEN_KEY, JSON.stringify(map))
  } catch (e) {
    // 忽略存储失败
  }
}

export function getLastEatenMap(): Record<string, number> {
  return read()
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
