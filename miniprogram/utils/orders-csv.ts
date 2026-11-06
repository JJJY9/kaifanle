import type { Order } from '../services/types'
import { STATUS_TEXT, mealName } from './constants'

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n)
}

function dateTime(ts: number): string {
  const d = new Date(Number(ts) || 0)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function cell(value: any): string {
  const text = String(value == null ? '' : value).replace(/"/g, '""')
  return `"${text}"`
}

export function ordersToCsv(orders: Order[]): string {
  const header = [
    '订单号',
    '状态',
    '餐次',
    '用餐日期',
    '下单时间',
    '菜品',
    '金额',
    '评分',
    '评价',
    '掌勺人回复',
    '整单备注',
    '地址'
  ]
  const lines = [header.map(cell).join(',')]
  orders.forEach(order => {
    const items = (order.items || [])
      .map(item => `${item.name}×${item.qty}`)
      .join('、')
    const rating =
      order.rating === 3 ? '好吃' : order.rating === 2 ? '一般' : order.rating === 1 ? '翻车' : ''
    lines.push(
      [
        order.no,
        STATUS_TEXT[order.status] || order.status,
        mealName(order.meal),
        order.scheduledDate || '',
        dateTime(order.createdAt),
        items,
        order.amount,
        rating,
        order.feedback || '',
        order.ownerReply || '',
        order.note || '',
        order.address || ''
      ]
        .map(cell)
        .join(',')
    )
  })
  return '﻿' + lines.join('\n')
}
