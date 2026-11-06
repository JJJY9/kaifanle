// 延迟返回上一页：页面在延迟期间被卸载/切走时不再误退别的页面
export function backAfter(delay = 500): void {
  const page = getCurrentPages().slice(-1)[0]
  setTimeout(() => {
    const top = getCurrentPages().slice(-1)[0]
    if (top && top === page) {
      wx.navigateBack({ delta: 1 })
    }
  }, delay)
}
