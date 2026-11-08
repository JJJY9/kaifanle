export function orderReceiptLines(order: any): any[] {
  return (order.items || []).map((item: any, index: number) => ({
    key: `${index}-${item.dishId || item.name}`,
    name: item.name,
    qty: Number(item.qty || 0),
    lineTotal: Number(item.price || 0) * Number(item.qty || 0),
    specText: Array.isArray(item.specs) ? item.specs.join(' / ') : '',
    allergenText: Array.isArray(item.allergens)
      ? item.allergens.join('、')
      : '',
    note: item.note || ''
  }))
}

export function receiptText(order: any, lines: any[]): string {
  const head = [`【张饱饭堂】#${order.no || ''}`]
  const meta = [order.dateText, order.mealText, order.mode, order.expectedTime]
    .filter(Boolean)
    .join(' · ')
  if (meta) {
    head.push(meta)
  }
  lines.forEach(line => {
    head.push(`${line.name} ×${line.qty}  ¥${line.lineTotal}`)
    if (line.specText) {
      head.push(`  规格：${line.specText}`)
    }
    if (line.allergenText) {
      head.push(`  含：${line.allergenText}`)
    }
    if (line.note) {
      head.push(`  备注：${line.note}`)
    }
  })
  head.push(
    `合计 ¥${order.amount} · 共 ${
      order.totalQty || lines.reduce((sum, line) => sum + line.qty, 0)
    } 份`
  )
  if (order.address) {
    head.push(`送到：${order.address}`)
  }
  if (order.note) {
    head.push(`整单备注：${order.note}`)
  }
  const rating = Number(order.rating)
  if ([1, 2, 3].indexOf(rating) > -1) {
    const emoji = rating === 3 ? '😋' : rating === 2 ? '🙂' : '😵'
    const label = rating === 3 ? '好吃' : rating === 2 ? '一般' : '翻车'
    const feedback = String(order.feedback || '').trim()
    head.push(`评价：${emoji} ${label}${feedback ? ` · ${feedback}` : ''}`)
  }
  if (order.ownerReply) {
    head.push(`掌勺人：${order.ownerReply}`)
  }
  return head.join('\n')
}
