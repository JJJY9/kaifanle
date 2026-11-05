import * as mock from './mock'
import type {
  Category,
  CreateOrderPayload,
  Dish,
  Order,
  OrderStatus
} from './types'

// 先跑 mock 数据，微信开发者工具导入即可预览。
// 配好云开发环境、部署云函数后改成 true，即切换到真实后端。
const USE_CLOUD = false

async function callCloud<T = any>(name: string, data?: any): Promise<T> {
  const res: any = await wx.cloud.callFunction({ name, data })
  return res.result as T
}

export async function getCategories(): Promise<Category[]> {
  if (USE_CLOUD) {
    return callCloud<Category[]>('getCategories')
  }
  return mock.getCategories()
}

export async function getDishes(): Promise<Dish[]> {
  if (USE_CLOUD) {
    return callCloud<Dish[]>('getDishes')
  }
  return mock.getDishes()
}

export async function getDish(id: string): Promise<Dish | null> {
  if (USE_CLOUD) {
    return callCloud<Dish | null>('getDish', { id })
  }
  return mock.getDish(id)
}

export async function toggleDishStatus(id: string): Promise<Dish | null> {
  if (USE_CLOUD) {
    return callCloud<Dish | null>('toggleDishStatus', { id })
  }
  return mock.toggleDishStatus(id)
}

export async function getOrders(): Promise<Order[]> {
  if (USE_CLOUD) {
    return callCloud<Order[]>('getOrders')
  }
  return mock.getOrders()
}

export async function getOrder(id: string): Promise<Order | null> {
  if (USE_CLOUD) {
    return callCloud<Order | null>('getOrder', { id })
  }
  return mock.getOrder(id)
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  if (USE_CLOUD) {
    return callCloud<Order>('createOrder', payload)
  }
  return mock.createOrder(payload)
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<Order | null> {
  if (USE_CLOUD) {
    return callCloud<Order | null>('updateOrderStatus', { id, status })
  }
  return mock.updateOrderStatus(id, status)
}
