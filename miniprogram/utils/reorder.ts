import type { Dish, Order } from '../services/types'
import { cart } from '../store/cart'

export interface ReorderResult {
  added: number
  skipped: number
}

// 按当前菜价和供应状态把历史订单重新加购；下架/售罄/不供应这一餐的菜跳过
export function addOrderToCart(
  order: Order,
  date: string,
  dishes: Dish[] | null
): ReorderResult {
  const dishMap: Record<string, Dish> = {}
  if (dishes) {
    dishes.forEach(dish => {
      dishMap[dish.id] = dish
    })
  }
  let added = 0
  let skipped = 0
  order.items.forEach(item => {
    const dish = dishes ? dishMap[item.dishId] : null
    if (
      dishes &&
      (!dish ||
        dish.status !== 'on' ||
        (dish.meals || []).indexOf(order.meal) === -1)
    ) {
      skipped++
      return
    }
    let qty = item.qty
    if (dish && typeof dish.stock === 'number' && dish.stock >= 0) {
      qty = Math.min(qty, dish.stock)
    }
    if (qty <= 0) {
      skipped++
      return
    }
    cart.add({
      key: '',
      meal: order.meal,
      date,
      dishId: item.dishId,
      name: dish ? dish.name : item.name,
      price: dish
        ? dish.price +
          (dish.addons || [])
            .filter(addon => item.specs.indexOf(addon.name) > -1)
            .reduce((sum, addon) => sum + addon.price, 0)
        : item.price,
      qty,
      specs: item.specs,
      note: item.note,
      color: dish ? dish.color : '#FFD23F'
    })
    added++
  })
  return { added, skipped }
}
