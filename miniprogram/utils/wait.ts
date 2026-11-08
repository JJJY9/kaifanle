// 「已等 N 分钟」文案：仅当天创建的有效订单才计算，跨天预订单不显示，
// 避免凌晨把今天的预订标成已等几百分钟。
export function sameDayWaitText(
  createdAt: number,
  now: number = Date.now(),
  minMinutes = 1
): string {
  const at = Number(createdAt || 0)
  if (!at) {
    return ''
  }
  const created = new Date(at)
  const current = new Date(now)
  if (created.toDateString() !== current.toDateString()) {
    return ''
  }
  const minutes = Math.floor((current.getTime() - at) / 60000)
  return minutes >= minMinutes ? `已等 ${minutes} 分钟` : ''
}
