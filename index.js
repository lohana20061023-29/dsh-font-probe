/**
 * @local/font-probe — Host 半体。
 *
 * 形状对齐官方模板（`cordis-plugin-development/templates/decoration/`）：
 *   "type": "module"  +  `export function apply() {}`
 *
 * 这个形状不是可选的。实测：第一版写成 CommonJS 的
 * `module.exports = { name }`（没有 apply），结果是该行 **enabled: true 但
 * fiberPhase: null** —— fiber 从未实例化、行不进 loader 活树，于是 client-modules
 * 扫描时看不到它，浏览器启动图里没有它，页面上的 `window.__ModuleLoader__.load`
 * 永远不执行，字体自然不变。而且它**不报错**：`dsh-app-boot` 的 inactiveEntries
 * 对 `fiber === undefined` 只回一句误导性的 "failed to import"，真正原因在
 * loader 的 `_init()` 里被 `catch { this.ctx.logger.error(error); return }` 吞掉了。
 *
 * 这里额外导出 `Config`：DSH 读 loader 条目的 `Config` 并据此投射出设置表单，
 * 客户端半体再通过命名空间把改动写回 profile（命名空间 = profile 行 id）。
 */

import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

/** profile 里的行 id；DSH 的 configForms 就是按它取表单。 */
const SETTINGS_ENTRY = 'font-probe'

/** 与客户端半体的默认值保持一致。 */
const FIELD_DEFAULTS = {
  fontFamily: '',
  latinFontFamily: '',
  fontSize: '',
  codeFontFamily: '',
  codeFontSize: '',
  /* 排版四项。都存成字符串；空串或「0」都表示"不覆盖"。 */
  letterSpacing: '',
  lineHeight: '',
  paragraphSpacing: '',
  firstLineIndent: '',
}

/**
 * 候选解析锚点。`schemastery` 装在 **profile** 的 node_modules 里，不在插件自己的
 * 目录里，所以 `createRequire(import.meta.url)` 解析不到它（实测：Config 变成
 * undefined）。按"最可能命中"的顺序收集锚点：进程参数里的 profiles 路径、
 * DSH_PROFILE_DIR、以及从插件自身路径往上的 profiles 段，最后兜底插件自身。
 */
function configRequireAnchors() {
  const anchors = []
  const push = (value) => {
    if (typeof value !== 'string' || value.length === 0) return
    const norm = value.replace(/[\\/]+$/, '')
    if (!anchors.includes(norm)) anchors.push(norm)
  }

  for (const value of [process.argv0, ...(process.argv || [])]) {
    if (typeof value !== 'string') continue
    const hit = /[\\/]profiles[\\/][^\\/]+/.exec(value)
    if (hit !== null) push(value.slice(0, hit.index + hit[0].length))
  }

  push(process.env.DSH_PROFILE_DIR)

  const selfDir = fileURLToPath(new URL('.', import.meta.url))
  const selfHit = /[\\/]profiles[\\/][^\\/]+/.exec(selfDir)
  if (selfHit !== null) push(selfDir.slice(0, selfHit.index + selfHit[0].length))

  push(selfDir)
  return anchors
}

/**
 * 从宿主 realm 懒加载 schemastery。
 * 找不到就返回 undefined —— 那样条目投射不出设置表单，但字体覆盖本身照常工作
 * （客户端用内存默认值）。这样"设置页没出来"不会连累"字体没生效"。
 */
function loadSchemaBuilder() {
  for (const anchor of configRequireAnchors()) {
    let req
    try {
      req = createRequire(anchor + '/package.json')
    } catch (error) {
      continue
    }
    for (const id of ['@deepseek-ai/schemastery', 'schemastery']) {
      try {
        const mod = req(id)
        const z = mod && mod.default ? mod.default : mod
        if (z && typeof z.object === 'function' && typeof z.string === 'function') return z
      } catch (error) {
        /* 下一个候选 */
      }
    }
  }
  return undefined
}

function buildConfig() {
  const z = loadSchemaBuilder()
  if (z === undefined) return undefined

  /**
   * 构造一个可写字段。
   *
   * **`.volatile()` 是必需的，不是装饰。** 踩坑记录：`@deepseek-ai/dsh-settings`
   * 的 `write()` 开头就是
   *     const form = volatileForm(schema)
   *     if (form === void 0) throw new Error(`Plugin entry "${ns}" has no volatile fields`)
   * 然后每个字段路径还要过 `isVolatilePath(schema, path)`。
   * 也就是说**只有 meta.volatile 为真的字段能经这条路径写盘**。
   * 普通 `z.string()` 的字段不可写 —— 表现是界面能改、字体立即生效，
   * 但 profile 的 cordis.patch.yml 永远不更新，而且错误被 remote 层吞掉，
   * 前端连一句报错都看不到。
   *
   * `.default()` 和 `.volatile()` 都按能力探测，缺哪个就跳过哪个。
   */
  const str = (fallback) => {
    let field = z.string()
    if (typeof field.default === 'function') field = field.default(fallback)
    if (typeof field.volatile === 'function') field = field.volatile()
    return field
  }

  return z.object({
    fontFamily: str(FIELD_DEFAULTS.fontFamily),
    latinFontFamily: str(FIELD_DEFAULTS.latinFontFamily),
    fontSize: str(FIELD_DEFAULTS.fontSize),
    codeFontFamily: str(FIELD_DEFAULTS.codeFontFamily),
    codeFontSize: str(FIELD_DEFAULTS.codeFontSize),
    letterSpacing: str(FIELD_DEFAULTS.letterSpacing),
    lineHeight: str(FIELD_DEFAULTS.lineHeight),
    paragraphSpacing: str(FIELD_DEFAULTS.paragraphSpacing),
    firstLineIndent: str(FIELD_DEFAULTS.firstLineIndent),
  })
}

const Config = buildConfig()

export { Config, SETTINGS_ENTRY, FIELD_DEFAULTS }

/** 所有行为都在客户端半体；这里只需要一个存在的 apply 让行得以挂载。 */
export function apply() {}
