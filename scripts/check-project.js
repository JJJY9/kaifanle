#!/usr/bin/env node
/**
 * 项目自检脚本：JSON 合法性、页面/组件文件完整性、WXML 标签配对。
 * 用法：node scripts/check-project.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'miniprogram')
const errors = []
const warnings = []

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else {
      out.push(full)
    }
  }
  return out
}

const files = walk(ROOT)

// 1. JSON 全部可解析
for (const file of files.filter(f => f.endsWith('.json'))) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    errors.push(`${path.relative(ROOT, file)}: JSON 解析失败 - ${e.message}`)
  }
}

// 2. app.json 页面四件套齐全
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
const exts = ['.ts', '.wxml', '.wxss', '.json']
for (const page of appJson.pages || []) {
  for (const ext of exts) {
    if (!fs.existsSync(path.join(ROOT, page + ext))) {
      errors.push(`页面缺少文件: ${page}${ext}`)
    }
  }
}

// 3. usingComponents 指向的组件文件存在
for (const file of files.filter(f => f.endsWith('.json'))) {
  let json
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    continue
  }
  const using = json.usingComponents || {}
  for (const name of Object.keys(using)) {
    const target = using[name]
    const base = target.startsWith('/')
      ? path.join(ROOT, target)
      : path.resolve(path.dirname(file), target)
    for (const ext of exts) {
      if (!fs.existsSync(base + ext)) {
        errors.push(`组件 ${name} 缺少文件: ${path.relative(ROOT, base + ext)}`)
      }
    }
  }
}

// 4. 自定义 tab bar 文件齐全
for (const ext of exts) {
  if (!fs.existsSync(path.join(ROOT, 'custom-tab-bar', 'index' + ext))) {
    errors.push(`custom-tab-bar 缺少文件: index${ext}`)
  }
}

// 5. WXML 标签配对
const SELF_CLOSING_OK = true
function checkWxml(file) {
  let source = fs.readFileSync(file, 'utf8')
  source = source.replace(/<!--[\s\S]*?-->/g, '')

  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g
  const stack = []
  let match
  while ((match = tagRe.exec(source))) {
    const closing = match[1] === '/'
    const name = match[2]
    const selfClosing = match[4] === '/'
    if (selfClosing) {
      continue
    }
    if (!closing) {
      stack.push({ name, index: match.index })
    } else {
      const top = stack.pop()
      if (!top || top.name !== name) {
        errors.push(
          `${path.relative(ROOT, file)}: 标签不配对 </${name}>，栈顶为 ${
            top ? top.name : '空'
          }`
        )
        return
      }
    }
  }
  if (stack.length) {
    errors.push(
      `${path.relative(ROOT, file)}: 未闭合标签 <${stack[stack.length - 1].name}>`
    )
  }
}

for (const file of files.filter(f => f.endsWith('.wxml'))) {
  checkWxml(file)
}

// 6. 简单的未使用文件提示
const referenced = new Set()
for (const page of appJson.pages || []) referenced.add(page)
for (const file of files.filter(f => f.endsWith('.json'))) {
  let json
  try {
    json = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    continue
  }
  for (const target of Object.values(json.usingComponents || {})) {
    referenced.add(target.replace(/^\//, ''))
  }
}
for (const file of files.filter(f => f.endsWith('.wxml'))) {
  const rel = path.relative(ROOT, file).replace(/\.wxml$/, '').replace(/\\/g, '/')
  if (
    !rel.startsWith('pages/') &&
    !rel.startsWith('components/') &&
    rel !== 'custom-tab-bar/index'
  ) {
    warnings.push(`未归类的 WXML: ${rel}`)
  }
}

// 7. 客户端 action 与服务端路由一致
const apiPath = path.join(__dirname, '..', 'miniprogram', 'services', 'api.ts')
const serverPath = path.join(__dirname, '..', 'cloudfunctions', 'api', 'index.js')
if (fs.existsSync(apiPath) && fs.existsSync(serverPath)) {
  const apiSource = fs.readFileSync(apiPath, 'utf8')
  const serverSource = fs.readFileSync(serverPath, 'utf8')
  const actionRe = /callApi(?:<[^>]*>)?\(\s*['"]([A-Za-z0-9_]+)['"]/g
  const actions = new Set()
  let actionMatch
  while ((actionMatch = actionRe.exec(apiSource))) {
    actions.add(actionMatch[1])
  }
  for (const action of actions) {
    if (!serverSource.includes(`case '${action}'`)) {
      errors.push(`客户端调用了未定义的服务端动作: ${action}`)
    }
  }
}

if (warnings.length) {
  console.log('提示:')
  warnings.forEach(w => console.log('  - ' + w))
}

if (errors.length) {
  console.error(`自检失败，共 ${errors.length} 个问题:`)
  errors.forEach(e => console.error('  - ' + e))
  process.exit(1)
}

console.log(
  `自检通过：${(appJson.pages || []).length} 个页面，${files.length} 个文件。`
)
