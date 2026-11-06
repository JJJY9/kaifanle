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
  stock?: number
  isRecommended?: boolean
  image?: string
  emoji?: string
  cartoon?: string
  recipe?: string
}

export interface Category {
  id: string
  name: string
  color: string
}

export interface DishInput {
  id?: string
  name: string
  desc: string
  price: number
  categoryId: string
  tags: string[]
  spicyLevels: string[]
  addons: Addon[]
  color: string
  meals: MealId[]
  status: 'on' | 'soldout' | 'off'
  stock: number
  isRecommended: boolean
  image?: string
  recipe?: string
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
  address?: string
  scheduledDate?: string
  profile?: {
    dislikes: string[]
    tastes: string[]
  }
  status: OrderStatus
  timeline: TimelineEntry[]
  createdAt: number
  urgedAt?: number
  urgeCount?: number
  rating?: number
  feedback?: string
  ratedAt?: number
}

export interface CreateOrderPayload {
  items: OrderItem[]
  amount: number
  meal: MealId
  expectedTime: string
  mode: string
  note: string
  address?: string
  scheduledDate?: string
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

export type WishStatus = 'pending' | 'planned' | 'done'

export interface Wish {
  id: string
  content: string
  status: WishStatus
  plannedDate: string
  reply: string
  createdAt: number
  updatedAt: number
}

export interface MealBusiness {
  open: boolean
  deadline: string
}

export interface Business {
  breakfast: MealBusiness
  lunch: MealBusiness
  dinner: MealBusiness
  closedNote: string
  notice?: string
  closedDates?: string[]
  weeklyClosed?: number[]
}

export interface UserProfile {
  dislikes: string[]
  tastes: string[]
  address: string
}

export interface StoreStats {
  orderCount: number
  completed: number
  revenue: number
  topDish: string
  topQty: number
  totalOrders?: number
}

export interface MyStats {
  total: number
  month: number
  favorite: string
}

export type CouponStatus = 'unused' | 'used'

export interface Coupon {
  id: string
  title: string
  note: string
  status: CouponStatus
  owner: string
  createdAt: number
  claimedAt: number
  usedAt: number
}

export interface DailyMenu {
  exists: boolean
  date: string
  meal: MealId
  dishIds: string[]
  open: boolean
}
