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
import path from 'node:path'

/** profile 里的行 id；DSH 的 configForms 就是按它取表单。 */
const SETTINGS_ENTRY = 'font-probe-lite'

/** 与客户端半体的默认值保持一致。 */
const FIELD_DEFAULTS = {
  /* 字重：界面（含正文）/ 标题。存字符串，空 = 不覆盖。 */
  fontWeight: '',
  headingFontWeight: '',
  /* 排版四项。都存成字符串；空串或「0」都表示"不覆盖"。 */
  letterSpacing: '',
  lineHeight: '',
  paragraphSpacing: '',
  firstLineIndent: '',
}

/**
 * 候选解析根目录。
 *
 * 背景：`@deepseek-ai/schemastery` **不在插件自己的目录里**，所以
 * `createRequire(import.meta.url)` 直接 `require('@deepseek-ai/schemastery')`
 * 会 MODULE_NOT_FOUND，Config 变成 undefined（设置表单投射不出来）。
 *
 * 更强的做法（借鉴 `dsh-theme-endfield` 的实现）：
 * 不用"从某个文件 require"，而是 `require.resolve(spec, { paths: [root...] })`
 * —— 语义就是"**如果从这些目录出发去找**"。这样能覆盖三种装法：
 *
 *   1. 插件被装进 profile（`link:` / `file:` / npm）→ 从插件自身目录往上找；
 *   2. `dsh web` 从 profile 目录启动 → 工作目录、argv 里的 profiles 路径；
 *   3. **应用自带**（Electron 把 DSH 打进 app.asar）→ 从进程入口 /
 *      `require.main` 所在的安装树去找。这条路是最后兜底，也是最关键的一条：
 *      profile 的 node_modules 会被 pnpm 清理，而 app 自己的依赖不会。
 *
 * 最后再给一个手动逃生口：`DSH_SCHEMA_ROOT` 环境变量。
 */
function resolutionRoots() {
  const roots = []
  const push = (dir) => {
    if (typeof dir !== 'string' || dir.length === 0) return
    const norm = dir.replace(/[\\/]+$/, '')
    if (!roots.includes(norm)) roots.push(norm)
  }

  const selfDir = fileURLToPath(new URL('.', import.meta.url))

  // ① 插件自身及其祖先（处理"装在 profile 里"和"仓库在深层目录"两种）
  push(selfDir)
  let dir = selfDir
  for (let i = 0; i < 6; i += 1) {
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
    push(dir)
  }

  // ② 进程上下文：工作目录、argv 里的 profiles 路径、DSH_PROFILE_DIR
  try { push(process.cwd()) } catch (error) { /* 无 cwd */ }
  for (const value of [process.argv0, ...(process.argv || [])]) {
    if (typeof value !== 'string') continue
    const hit = /[\\/]profiles[\\/][^\\/]+/.exec(value)
    if (hit !== null) push(value.slice(0, hit.index + hit[0].length))
  }
  push(process.env.DSH_PROFILE_DIR)

  // ③ DSH 安装树：入口脚本所在目录、其祖先、以及 require.main
  for (const entry of [process.argv && process.argv[1], process.mainModule && process.mainModule.filename]) {
    if (typeof entry !== 'string' || entry.length === 0) continue
    try {
      let d = path.dirname(entry)
      for (let i = 0; i < 4; i += 1) {
        push(d)
        const parent = path.dirname(d)
        if (parent === d) break
        d = parent
      }
    } catch (error) { /* 忽略 */ }
  }

  /* ④ Electron 打包形态：DSH 被塞进 app.asar，schemastery 在
        app.asar/node_modules 与 app.asar/dsh/node_modules 里各有一份。
        注意：**只有 Electron 打过补丁的 fs 才能解析 asar 内部路径**，
        所以这些根在普通 node 里只是"不存在"，会快速跳过。 */
  try {
    if (typeof process.resourcesPath === 'string' && process.resourcesPath.length > 0) {
      push(path.join(process.resourcesPath, 'app.asar', 'dsh'))
      push(path.join(process.resourcesPath, 'app.asar'))
      push(path.join(process.resourcesPath, 'app', 'dsh'))
      push(path.join(process.resourcesPath, 'app'))
      push(process.resourcesPath)
    }
  } catch (error) { /* 无 resourcesPath */ }
  try {
    const execDir = path.dirname(process.execPath)
    push(execDir)
    push(path.join(execDir, 'resources', 'app.asar', 'dsh'))
    push(path.join(execDir, 'resources', 'app.asar'))
    push(path.join(execDir, 'resources', 'app'))
  } catch (error) { /* 无 execPath */ }

  // ⑤ 手动逃生口
  push(process.env.DSH_SCHEMA_ROOT)

  return roots
}

/**
 * 从宿主 realm 懒加载 schemastery。
 *
 * 两条硬要求：
 *   1. 必须找得到（否则 Config 为 undefined，设置表单投射不出来）；
 *   2. **必须带 `.volatile()`**。DSH 0.1.7+ 的可写表单只认 volatile 字段；
 *      只有裸 `schemastery`（3.18，没有 `.volatile()`）时宁可不给 Config ——
 *      否则会出现"界面能改、写不进去"的静默失败，正是这个插件早期踩过的坑。
 *
 * 找不到就返回 undefined：字体覆盖本身照常工作，只是没有设置页。
 */
function loadSchemaBuilder() {
  const base = createRequire(import.meta.url)
  const roots = resolutionRoots()
  const specs = ['@deepseek-ai/schemastery', 'schemastery']

  for (const root of roots) {
    for (const id of specs) {
      let resolved
      try {
        resolved = base.resolve(id, { paths: [root] })
      } catch (error) {
        continue /* 这个根下没有，换下一个 */
      }
      try {
        const mod = base(resolved)
        const z = mod && mod.default ? mod.default : mod
        if (!z || typeof z.object !== 'function' || typeof z.string !== 'function') continue
        /* 只接受真正带 .volatile() 的构建器 */
        const probe = typeof z.string === 'function' ? z.string() : null
        if (!probe || typeof probe.volatile !== 'function') continue
        return z
      } catch (error) {
        /* 加载失败，换下一个 */
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
    fontWeight: str(FIELD_DEFAULTS.fontWeight),
    headingFontWeight: str(FIELD_DEFAULTS.headingFontWeight),
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
