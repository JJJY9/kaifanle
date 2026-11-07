export function saveImageToAlbum(
  filePath: string,
  successText = '已保存到相册'
): Promise<boolean> {
  return new Promise(resolve => {
    if (!filePath) {
      resolve(false)
      return
    }
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => {
        wx.showToast({ title: successText, icon: 'none' })
        resolve(true)
      },
      fail: () => {
        wx.showToast({ title: '保存失败，请允许相册权限', icon: 'none' })
        resolve(false)
      }
    })
  })
}
