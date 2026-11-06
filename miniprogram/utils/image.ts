// 菜品图片上传前的压缩：超过 300KB 的图先压到 70/50 质量，
// 控制云存储占用和上传时间；压缩失败时退回原图，不阻断上传。
export const IMAGE_MAX_BYTES = 300 * 1024

export function needsCompress(size: number): boolean {
  return Number(size) > IMAGE_MAX_BYTES
}

function fileSize(path: string): Promise<number> {
  return new Promise(resolve => {
    wx.getFileSystemManager().getFileInfo({
      filePath: path,
      success: res => resolve(Number(res.size || 0)),
      fail: () => resolve(0)
    })
  })
}

function compressOnce(path: string, quality: number): Promise<string> {
  return new Promise(resolve => {
    wx.compressImage({
      src: path,
      quality,
      success: res => resolve(res.tempFilePath || path),
      fail: () => resolve(path)
    })
  })
}

export async function prepareImageForUpload(path: string): Promise<string> {
  if (!path) {
    return path
  }
  let current = path
  let size = await fileSize(current)
  if (size > 0 && !needsCompress(size)) {
    return current
  }
  for (const quality of [70, 50]) {
    if (size > 0 && !needsCompress(size)) {
      break
    }
    const next = await compressOnce(current, quality)
    if (next && next !== current) {
      current = next
      size = await fileSize(current)
    }
  }
  return current
}
