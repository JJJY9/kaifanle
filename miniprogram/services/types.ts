export type MealId = 'breakfast' | 'lunch' | 'dinner'

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'cooking'
  | 'ready'
  | 'completed'
  | 'cancelled'

export interface Addon {
  id: string
  name: string
  price: number
}

export interface Dish {
  id: string
  name: string
  char: string
  desc: string
  price: number
  categoryId: string
  tags: string[]
  spicyLevels: string[]
  addons: Addon[]
  status: 'on' | 'soldout' | 'off'
  color: string
  meals: MealId[]
  isRecommended?: boolean
}

export interface Category {
  id: string
  name: string
  color: string
}

export interface CartLine {
  key: string
  dishId: string
  name: string
  price: number
  qty: number
  specs: string[]
  note: string
  color: string
}

export interface OrderItem {
  dishId: string
  name: string
  price: number
  qty: number
  specs: string[]
  note: string
}

export interface TimelineEntry {
  status: OrderStatus
  title: string
  time: number
}

export interface Order {
  id: string
  no: string
  items: OrderItem[]
  amount: number
  meal: MealId
  expectedTime: string
  mode: string
  note: string
  status: OrderStatus
  timeline: TimelineEntry[]
  createdAt: number
}

export interface CreateOrderPayload {
  items: OrderItem[]
  amount: number
  meal: MealId
  expectedTime: string
  mode: string
  note: string
}

export interface MeInfo {
  openid: string
  isAdmin: boolean
  initialized: boolean
}

export interface InitResult {
  initialized: boolean
  already: boolean
  isAdmin: boolean
}
