// 从主包派生「轻量版」：**只保留字重 + 排版**，字体与字号都删掉。
//
// 主包现在只提供 字体族 / 字重 / 排版（字号已在 strip-size.mjs 里移除）。
// 轻量版在此之上再剥掉字体族设置，得到一个只补官方缺口的极简插件。
//
//   node tools/build-lite.mjs
//
// 产物：<repo>/lite/{client.js,index.js,package.json,cordis.patch.yml,README.md,LICENSE}
import fs from 'node:fs'
import path from 'node:path'

const ROOT = 'G:/DSH/_ext/dsh-font-probe'
const LITE = path.join(ROOT, 'lite')
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8')
const done = []

function cutText(src, needle, label) {
  const n = src.split(needle).length - 1
  if (n !== 1) throw new Error(`[${label}] 需要恰好命中 1 次，实际 ${n} 次`)
  done.push(label)
  return src.replace(needle, '')
}
function subText(src, from, to, label) {
  const n = src.split(from).length - 1
  if (n !== 1) throw new Error(`[${label}] 需要恰好命中 1 次，实际 ${n} 次`)
  done.push(label)
  return src.replace(from, to)
}
/** 删掉 [startMark, endMark) 之间（含 startMark，不含 endMark） */
function cutRange(src, startMark, endMark, label) {
  const i = src.indexOf(startMark)
  if (i < 0) throw new Error(`[${label}] 找不到 startMark`)
  const j = src.indexOf(endMark, i + startMark.length)
  if (j < 0) throw new Error(`[${label}] 找不到 endMark`)
  done.push(label)
  return src.slice(0, i) + src.slice(j)
}

let c = read('client.js')
const before = c.length

/* 1. 字体助手：FONT_CHOICES / isFamilyAvailable / 栈构造 / 兜底栈 */
c = cutRange(c, '    /**\n     * 常用可选字体。', '    /* ---------- 运行时状态 ---------- */', 'helpers.fonts')

/* 2. 默认值与运行时状态的字体字段 */
c = cutText(c, `      fontFamily: '',
      latinFontFamily: '',
      codeFontFamily: '',
`, 'DEFAULTS.fonts')
c = cutText(c, `      fontFamily: DEFAULTS.fontFamily,
      latinFontFamily: DEFAULTS.latinFontFamily,
      codeFontFamily: DEFAULTS.codeFontFamily,
`, 'state.fonts')

/* 3. applyNow 的字体部分 */
c = cutRange(c, '      /* 界面字体栈由「英文字体 + 中文字体」合成：任一非空即视为启用覆盖。 */',
  '      /* ---------- 排版四项：只作用于正文（Markdown 区域）----------', 'applyNow.fonts')

/* 4. 样式表里的 :root / body 规则（字体令牌） */
c = cutText(c, `        (declarations.length > 0 ? \`:root { \${declarations.join(' ')} }\\n\` : '') +
        (declarations.length > 0 || bodyDeclarations.length > 0
          ? \`body { \${[...declarations, ...bodyDeclarations].join(' ')} }\\n\`
          : '') +
`, 'css.rootBody')

/* 5. 通道 2（inline）—— 轻量版没有字体令牌要写，整块去掉 */
c = cutRange(c, '      // 通道 2：inline + important —— 压过一切样式表。',
  '    }\n\n    /* ---------- 可订阅的最小 store ---------- */', 'inline.channel')

/* 6. syncFromForm 的字体字段 */
c = cutText(c, `        fontFamily: str(value.fontFamily, '') !== '' ? value.fontFamily : DEFAULTS.fontFamily,
        latinFontFamily: str(value.latinFontFamily, DEFAULTS.latinFontFamily),
        codeFontFamily: str(value.codeFontFamily, DEFAULTS.codeFontFamily),
`, 'sync.fonts')

/* 7. 草稿状态 */
c = cutText(c, `      const [draft, setDraft] = React.useState(snapshot.fontFamily)
      const [draftLatin, setDraftLatin] = React.useState(snapshot.latinFontFamily)
      const [draftCode, setDraftCode] = React.useState(snapshot.codeFontFamily)
`, 'draft.fonts')

/* 8. 草稿同步块（字体三项一次性删掉；代码字体的同步块也在同一段里） */
c = cutRange(c, '      const [syncedFrom, setSyncedFrom] = React.useState(snapshot.fontFamily)',
  '      const [syncedWeight, setSyncedWeight] = React.useState(snapshot.fontWeight)', 'draft.sync.fonts')

/* 9. hasChanges */
c = cutText(c, `        asDraft(draft) !== asDraft(snapshot.fontFamily) ||
        asDraft(draftLatin) !== asDraft(snapshot.latinFontFamily) ||
`, 'hasChanges.fonts')
c = cutText(c, '        asDraft(draftCode) !== asDraft(snapshot.codeFontFamily) ||\n', 'hasChanges.code')

/* 10. confirmAll 字段 */
c = cutText(c, `            fontFamily: draft,
            latinFontFamily: draftLatin,
`, 'confirm.fonts')
c = cutText(c, '            codeFontFamily: draftCode,\n', 'confirm.code')

/* 10b. 触发按钮的显示名（只服务被删掉的字体行） */
c = cutRange(c, '      /* 触发按钮上显示的名字：命中预设就显示预设的友好名称，否则原样显示族名。 */',
  '      const hasChanges =', 'dead.currentFamilyLabel')

/* 10c. 诊断行不再报告字体 */
c = subText(c, "        parts.push('value.fontFamily=' + JSON.stringify(snapshot.value.fontFamily))",
  "        parts.push('value.fontWeight=' + JSON.stringify(snapshot.value.fontWeight))", 'debug.value')
c = subText(c, "      parts.push('applied=' + JSON.stringify(state.fontFamily))",
  "      parts.push('applied=' + JSON.stringify(state.fontWeight))", 'debug.applied')

/* 11. resetDrafts */
c = cutText(c, `        setDraft(DEFAULTS.fontFamily)
        setDraftLatin(DEFAULTS.latinFontFamily)
`, 'reset.fonts')
c = cutText(c, '        setDraftCode(DEFAULTS.codeFontFamily)\n', 'reset.code')

/* 12. 预览：字体族与代码字体栈 */
c = cutText(c, '            fontFamily: buildUiStack(draftLatin, draft) || APP_FALLBACK_STACK,\n', 'preview.fontFamily')
c = cutText(c, '              fontFamily: stackFor(draftCode, APP_CODE_FALLBACK_STACK),\n', 'preview.codeFont')

/* 13. UI：marquee / 字体列表 / 三行字体设置 */
c = cutRange(c, '      /* ---------- 当前字体名的横向滚动（marquee）----------',
  '      const rows = []', 'ui.fontMachinery')
c = cutRange(c, "      rows.push(\n        React.createElement('div', { key: 'family'",
  '      /* ---------- 字重：界面（含正文）/ 标题 并排一行', 'ui.fontRows')

/* 14. 身份：section id / label / 命名空间 / sheet marker */
c = subText(c, "id: 'font-probe'", "id: 'font-probe-lite'", 'section.id')
c = subText(c, "label: '文字显示设置'", "label: '文字与排版（轻量）'", 'section.label')
// SHEET_MARKER 原本夹在字体栈那段里（已被删掉），这里补一个轻量版自己的
c = subText(c, '    /* ---------- 运行时状态 ---------- */',
  "    /** 样式表标记，用于诊断属性与样式去重。 */\n    const SHEET_MARKER = 'font-probe-lite/1.0.0-settings'\n\n    /* ---------- 运行时状态 ---------- */", 'sheet.marker')
c = subText(c, "const ENTRY_CANDIDATES = ['font-probe', 'include:font-probe']",
  "const ENTRY_CANDIDATES = ['font-probe-lite', 'include:font-probe-lite']", 'entry.candidates')
c = subText(c, "const LEGACY_NAMESPACE = 'dsh-font-probe'",
  "const LEGACY_NAMESPACE = 'dsh-font-probe-lite'", 'entry.legacy')

/* ---------------- index.js ---------------- */
let x = read('index.js')
x = subText(x, "const SETTINGS_ENTRY = 'font-probe'", "const SETTINGS_ENTRY = 'font-probe-lite'", 'host.entry')
x = cutText(x, "  fontFamily: '',\n  latinFontFamily: '',\n", 'host.defaults.fonts')
x = cutText(x, "  codeFontFamily: '',\n", 'host.defaults.code')
x = cutText(x, "    fontFamily: str(FIELD_DEFAULTS.fontFamily),\n    latinFontFamily: str(FIELD_DEFAULTS.latinFontFamily),\n", 'host.schema.fonts')
x = cutText(x, "    codeFontFamily: str(FIELD_DEFAULTS.codeFontFamily),\n", 'host.schema.code')

/* ---------------- 写出 ---------------- */
fs.mkdirSync(LITE, { recursive: true })
fs.writeFileSync(path.join(LITE, 'client.js'), c, 'utf8')
fs.writeFileSync(path.join(LITE, 'index.js'), x, 'utf8')

const pkg = JSON.parse(read('package.json'))
fs.writeFileSync(path.join(LITE, 'package.json'), JSON.stringify({
  name: 'dsh-font-probe-lite',
  version: '1.0.0',
  description: 'Minimal companion plugin for DSH: only font weights (interface + headings) and typography (letter-spacing, line-height, paragraph spacing, first-line indent) — the parts the official Appearance settings do not provide.',
  license: 'MIT',
  type: 'module',
  author: pkg.author,
  homepage: pkg.homepage,
  repository: pkg.repository,
  bugs: pkg.bugs,
  keywords: pkg.keywords,
  exports: pkg.exports,
  dsh: pkg.dsh,
  files: pkg.files.filter((f) => f !== 'CHANGELOG.md'),
  engines: pkg.engines,
}, null, 2) + '\n', 'utf8')

fs.writeFileSync(path.join(LITE, 'cordis.patch.yml'), `# dsh-font-probe-lite bundle patch
#
# 轻量版：只提供字重与排版。字体族、字号都交给 DSH 官方的「设置 → 通用 → 外观」。
# 与 dsh-font-probe 使用不同的 id / 设置命名空间，二者可以共存且不冲突
# （轻量版不写任何字体或字号令牌）。
- insert:
    - id: font-probe-lite
      name: dsh-font-probe-lite
`, 'utf8')

fs.copyFileSync(path.join(ROOT, 'LICENSE'), path.join(LITE, 'LICENSE'))

fs.writeFileSync(path.join(LITE, 'README.md'), `# dsh-font-probe-lite

**只补官方缺口的极简插件**：字重 + 排版。不含字体族，也不含字号。

DSH 官方从 v0.2.1-alpha.2 起已经在 **设置 → 通用 → 外观** 里提供字体族与字号
（字体那几项折叠在「字号大小」行右侧的小箭头里）。所以这些**不再重复造**。

## 只做这两件事

| 能力 | 官方有吗 |
|---|---|
| **界面字重**（正文/界面文字，300–900） | ❌ 没有 |
| **标题字重**（Markdown h1–h6，可单独设） | ❌ 没有 |
| **字距** 0–3px | ❌ 没有 |
| **行距** 0–12px（在应用自身行高上叠加） | ❌ 没有 |
| **段距** 0–24px | ❌ 没有 |
| **首行缩进** 0–4em | ❌ 没有 |
| 吸底总预览 + 草稿确认制 | ❌ 没有 |

## 不做的

- 字体族（官方「正文字体 / 代码字体 / 终端字体」）
- 字号（官方「字号大小 / 代码字号 / 终端字号」）

## 安装

\`\`\`bash
dsh plugin --profile desktop add dsh-font-probe-lite
\`\`\`

装完重启应用（托盘右键 → 退出应用 → 重新打开）：
设置里会出现「**文字与排版（轻量）**」。

> 与完整版 \`dsh-font-probe\` 的命名空间不同，可以并存：
> 完整版管字体，轻量版管字重与排版，两者不写同一个令牌。
`, 'utf8')

console.log(`轻量版已生成：${LITE}`)
console.log(`client.js ${before} → ${c.length} 字符（-${before - c.length}）`)
for (const d of done) console.log('  -', d)
