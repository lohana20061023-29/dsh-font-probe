/**
 * @local/font-probe — 客户端半体（浏览器侧）。
 *
 * 形状对齐官方模板 cordis-plugin-development/templates/decoration/client.js：
 * 工厂返回 `{ inject, apply }`。注册 id 必须等于包名（`<id>/client` 与裸包名归一）。
 *
 * ---- 它改的是什么（逐条从安装态 app.asar 读出，不是猜的）----
 * `@deepseek-ai/dsh-client-ui-theme` 的 `base.css` 是唯一声明字体令牌的地方，且只在 `:root`：
 *     :root { --dsw-font-family: -apple-system, …, "Microsoft YaHei", … }
 * 把整个 ui-theme bundle 搜 `dsw-font-family`，其余命中全是 `var(...)` 消费；
 * **没有一条 `font-family: var(--dsw-font-family)`**。所以改这一个令牌就是改全局字体。
 *
 * ---- 稳定性取舍 ----
 * 字体应用分两条通道（样式表 + inline important），后者压过一切样式表，
 * 用来排除层叠 / 加载顺序 / 选择器带来的不确定性。
 * 持久化失败（例如非 loopback 页面的内存模式）不会让字体失效，只记进 DOM 诊断属性。
 */

window.__ModuleLoader__.load({
  id: 'dsh-font-probe',
  factory(require) {
    const React = (typeof window !== 'undefined' && window.React) || require('react')

    /* ---------- 默认值（与 host 半体 index.js 的 FIELD_DEFAULTS 保持一致）---------- */
    const DEFAULTS = {
      fontFamily: '',
      latinFontFamily: '',
      codeFontFamily: '',
      /* 字重：空 = 不覆盖 */
      fontWeight: '',
      headingFontWeight: '',
      /* 排版四项：空串或 "0" 都按"不覆盖"处理 */
      letterSpacing: '',
      lineHeight: '',
      paragraphSpacing: '',
      firstLineIndent: '',
    }

    /* 排版项定义：一份数据驱动出四行滑块。value 存字符串，0 表示不覆盖。 */
    const METRICS = [
      { key: 'letterSpacing', label: '字距', hint: '整段文字的字符间距', unit: 'px', min: 0, max: 3, step: 0.1 },
      { key: 'lineHeight', label: '行距', hint: '在应用自身行高之上额外增加', unit: 'px', min: 0, max: 12, step: 1 },
      { key: 'paragraphSpacing', label: '段距', hint: '段落之间的额外间距', unit: 'px', min: 0, max: 24, step: 2 },
      { key: 'firstLineIndent', label: '首行缩进', hint: '段落首行缩进，单位 em（随字号缩放）', unit: 'em', min: 0, max: 4, step: 0.5 },
    ]
    const METRIC_KEYS = METRICS.map((m) => m.key)

    /** 把 "0" / "" / 非数字都归一成 0；有效正数原样返回。 */
    const metricValue = (raw) => {
      const n = Number(typeof raw === 'string' ? raw.trim() : raw)
      return Number.isFinite(n) && n > 0 ? n : 0
    }

    /** 字重归一：只接受 100–900 的整百，其它一律 0（= 不覆盖）。 */
    const weightValue = (raw) => {
      const n = Number(String(raw == null ? '' : raw).trim())
      return Number.isFinite(n) && n >= 100 && n <= 900 && n % 100 === 0 ? n : 0
    }

    /* 可选字重。用了 select 而不是滑块：字重是离散档位，滑块中间值没有意义。 */
    const WEIGHT_OPTIONS = [
      { value: '', label: '默认' },
      { value: '300', label: '300 细体' },
      { value: '400', label: '400 常规' },
      { value: '500', label: '500 中等' },
      { value: '600', label: '600 半粗' },
      { value: '700', label: '700 粗体' },
      { value: '800', label: '800 特粗' },
      { value: '900', label: '900 黑体' },
    ]

    /** 从任意来源（快照 / 默认值）抽取四个排版数值。 */
    const pickMetrics = (src) => {
      const out = {}
      for (const k of METRIC_KEYS) out[k] = metricValue(src ? src[k] : 0)
      return out
    }

    /** 用于"宿主值是否变了"的指纹，避免每次渲染都重设草稿。 */
    const metricSignature = (src) => METRIC_KEYS.map((k) => String(metricValue(src ? src[k] : 0))).join('|')

    /**
     * 常用可选字体。
     *
     * `downloadUrl` 只在**确认过官方页面**的条目上填：缺字体时列表里会长出一个「下载」，
     * 直接开官方页。填第三方下载站不如不填 —— 那些站点的包来源不可控。
     *
     * `system: true` 表示操作系统自带（Windows 中文版预装 / 系统 UI 字体），
     * 没有合法的单独下载页，缺了就只提示，不给按钮。
     */
    const FONT_CHOICES = [
      {
        label: '阿里妈妈数黑体（Alimama ShuHeiTi）',
        value: 'Alimama ShuHeiTi',
        /* 必须链**页面**而不是 zip：字体包的 CDN（fonts.alibabadesign.com）开了
           防盗链，只认 alibabadesign.com / alibabafonts.com 的 Referer。
           直接访问 zip 会得到 403 "denied by Referer ACL"（实测：无 Referer 403，
           带该域 Referer 才 206）。从门户页点下载时 Referer 才是对的。 */
        downloadUrl: 'https://www.alibabafonts.com/#/more',
      },
      { label: '微软雅黑（Microsoft YaHei）', value: 'Microsoft YaHei', system: true },
      {
        label: '思源黑体（Noto Sans SC）',
        value: 'Noto Sans SC',
        downloadUrl: 'https://fonts.google.com/noto/specimen/Noto+Sans+SC',
      },
      {
        label: '思源宋体（Noto Serif SC）',
        value: 'Noto Serif SC',
        downloadUrl: 'https://fonts.google.com/noto/specimen/Noto+Serif+SC',
      },
      { label: '黑体（SimHei）', value: 'SimHei', system: true },
      { label: '宋体（SimSun）', value: 'SimSun', system: true },
      { label: 'Segoe UI（仅拉丁）', value: 'Segoe UI', system: true },
      {
        label: '霞鹜文楷（LXGW WenKai）',
        value: 'LXGW WenKai',
        aliases: ['霞鹜文楷'],
        downloadUrl: 'https://github.com/lxgw/LxgwWenKai',
        /* 开源（OFL） */
      },
      {
        label: '霞鹜文楷 屏幕阅读版',
        value: 'LXGW WenKai Screen',
        aliases: ['霞鹜文楷屏幕阅读版'],
        downloadUrl: 'https://github.com/lxgw/LxgwWenKai-Screen',
        /* 开源（OFL），笔画更清晰 */
      },
      {
        label: '霞鹜文楷 GB',
        value: 'LXGW WenKai GB',
        aliases: ['霞鹜文楷GB'],
        downloadUrl: 'https://github.com/lxgw/LxgwWenKaiGB',
        /* 开源（OFL），简体字形 */
      },
      {
        label: '月星楷',
        value: '月星楷',
        aliases: ['MoonStarsKai', 'YueXingKai'],
        downloadUrl: 'https://github.com/GuiWonder/MoonStarsKai',
        /* 开源 */
      },
      {
        label: '香萃等粗宋',
        value: '香萃等粗宋',
        aliases: ['Xiangcui Dengcusong', 'XiangCuiDengCuSong'],
        downloadUrl: 'https://github.com/Miiiller/Xiangcui-Dengcusong',
        /* 开源 */
      },
      {
        label: '方正魏碑',
        value: '方正魏碑',
        aliases: ['方正魏碑简体', 'FZWeiBei-S03'],
        downloadUrl: 'https://www.foundertype.com/index.php/FontList/index?keyword=%E9%AD%8F%E7%A2%91',
        /* 商用需授权 */
      },
      {
        label: '方正粗金陵',
        value: '方正粗金陵',
        aliases: ['方正粗金陵简体', 'FZCuJinLin'],
        downloadUrl: 'https://www.foundertype.com/index.php/FontList/index?keyword=%E7%B2%97%E9%87%91%E9%99%B5',
        /* 商用需授权 */
      },
      {
        label: '方正行楷',
        value: '方正行楷',
        aliases: ['方正行楷简体', 'FZXingKai-S04'],
        downloadUrl: 'https://www.foundertype.com/index.php/FontList/index?keyword=%E8%A1%8C%E6%A5%B7',
        /* 商用需授权 */
      },
   ]

    /**
     * 判断某个字体族本机是否真的可用。
     *
     * 不用 `document.fonts.check()`：它对不存在的家族也返回 true（没有要加载的
     * 字体就算"通过"）。改用**宽度比对** —— 同一个字符串，先用 monospace 量一次，
     * 再用「目标字体 + monospace」量一次；找不到该字体时会回落到 monospace，
     * 两次宽度相等，据此判定"未安装"。
     *
     * 环境不支持 canvas 时返回 true（当作已安装），宁可少显示按钮也不误报。
     */
    const isFamilyAvailable = (family) => {
      try {
        if (typeof document === 'undefined' || typeof document.createElement !== 'function') return true
        const canvas = document.createElement('canvas')
        if (!canvas || typeof canvas.getContext !== 'function') return true
        const ctx = canvas.getContext('2d')
        if (!ctx || typeof ctx.measureText !== 'function') return true
        const probe = '中文ABCabc012'
        ctx.font = '40px monospace'
        const baseWidth = ctx.measureText(probe).width
        ctx.font = `40px "${family}", monospace`
        const testWidth = ctx.measureText(probe).width
        if (!Number.isFinite(baseWidth) || !Number.isFinite(testWidth)) return true
        return Math.abs(testWidth - baseWidth) > 0.5
      } catch (error) {
        return true
      }
    }

    /** 一个预设对应的全部真实族名（主名 + 别名）。没有对应预设时就是它自己。 */
    const familiesOf = (family) => {
      const name = typeof family === 'string' ? family.trim() : ''
      if (name === '') return []
      const choice = FONT_CHOICES.find(
        (c) => c.value === name || (c.aliases || []).indexOf(name) >= 0,
      )
      if (!choice) return [name]
      return [choice.value].concat(choice.aliases || [])
    }

    /** 任一别名装上就算装了 —— 中文字体常以中/英两种族名安装。 */
    const isChoiceAvailable = (family) => familiesOf(family).some(isFamilyAvailable)

    /* 应用自带字体栈，抄成字面量当兜底。**不能**写 var(--dsw-font-family)：
       那是在声明该令牌的规则里引用它自己，属于自引用，整条声明判无效。 */
    const APP_FALLBACK_STACK =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif'

    const APP_CODE_FALLBACK_STACK =
      '"SF Mono", "JetBrains Mono", "Fira Code", Consolas, "Liberation Mono", Menlo, Courier, "PingFang SC", "Microsoft YaHei"'

    const SHEET_MARKER = 'font-probe/1.0.0-settings'

    /** 单个族名 → 可安全放进 CSS 的值（纯英文含空格的需要引号）。 */
    const quoteOne = (name) => (/^[A-Za-z][A-Za-z0-9 _-]*$/.test(name) ? `"${name}"` : name)

    /** 字体族名 → CSS 值。预设会把全部别名一起列出来，浏览器挑装了的那个。 */
    const quoteFamily = (family) => {
      const names = familiesOf(family)
      if (names.length === 0) return ''
      return names.filter((n) => n !== '').map(quoteOne).join(', ')
    }

    /** 把一个字体族名包成栈：选择在前，应用自带栈兜底。 */
    const stackFor = (family, fallback) => {
      const quoted = quoteFamily(family)
      if (quoted === '') return fallback
      return `${quoted}, ${fallback}`
    }

    /**
     * 界面正文字体栈：**拉丁字体排在前面，中文字体排在后面**。
     *
     * 浏览器逐个尝试字体栈里的族，第一个含该字符的字体胜出。中文字体通常也
     * 带拉丁字形，所以如果把中文放在前面，英文就永远走不到拉丁字体 ——
     * 顺序反过来才成立：英文/数字命中拉丁字体，汉字因为拉丁字体没有而回落到中文字体。
     *
     * 两者都留空时返回空串，表示"不覆盖"。
     */
    const buildUiStack = (latinFamily, cjkFamily) => {
      const parts = [quoteFamily(latinFamily), quoteFamily(cjkFamily)].filter((v) => v !== '')
      if (parts.length === 0) return ''
      return `${parts.join(', ')}, ${APP_FALLBACK_STACK}`
    }

    /* ---------- 运行时状态 ---------- */
    const state = {
      fontFamily: DEFAULTS.fontFamily,
      latinFontFamily: DEFAULTS.latinFontFamily,
      codeFontFamily: DEFAULTS.codeFontFamily,
      fontWeight: DEFAULTS.fontWeight,
      headingFontWeight: DEFAULTS.headingFontWeight,
      letterSpacing: DEFAULTS.letterSpacing,
      lineHeight: DEFAULTS.lineHeight,
      paragraphSpacing: DEFAULTS.paragraphSpacing,
      firstLineIndent: DEFAULTS.firstLineIndent,
    }

    const errors = []
    function note(where, error) {
      const text = error && error.message ? error.message : String(error)
      errors.push(`${where}: ${text}`)
      if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.setAttribute('data-dsh-font-override-errors', JSON.stringify(errors))
      }
      try { console.error('[font-probe]', where, error) } catch (e) { /* console may be absent */ }
    }

    /* ---------- 字体应用 ---------- */
    let sheetMode = null // null | 'runtime' | 'element'
    let sheetElement = null
    let sheetDispose = null

    function applyNow() {
      /* 界面字体栈由「英文字体 + 中文字体」合成：任一非空即视为启用覆盖。 */
      const uiStack = buildUiStack(state.latinFontFamily, state.fontFamily)
      const hasUiFont = uiStack !== ''
      const hasCodeFont = typeof state.codeFontFamily === 'string' && state.codeFontFamily.trim() !== ''
      const codeStack = stackFor(state.codeFontFamily, APP_CODE_FALLBACK_STACK)

      /* 留空 = **不覆盖**，而不是覆盖成应用默认栈。
         这样"什么都没配"时本插件对界面完全无影响，也不会跟别的主题抢令牌。 */
      const declarations = []
      if (hasUiFont) declarations.push(`--dsw-font-family: ${uiStack};`)
      if (hasCodeFont) declarations.push(`--ds-font-family-code: ${codeStack};`)
      const bodyDeclarations = []

      /* ---------- 排版四项：只作用于正文（Markdown 区域）----------
         容器是 `<div class="<hash>_markdown">`（primitives 的 Markdown 组件）。
         CSS Module 的类名是「哈希 + _ + 局部名」，所以用 [class*="_markdown"]
         做钩子：跨构建稳定，且不会误伤设置面板自己的 <p>。
         刻意不用全局 `p` —— 那会把插件自己的说明文字也缩进。 */
      const MD = '[class*="_markdown"]'
      const metricRules = []

      const letterSpacing = metricValue(state.letterSpacing)
      if (letterSpacing > 0) {
        metricRules.push(`${MD} { letter-spacing: ${letterSpacing}px; }`)
      }

      const lineExtra = metricValue(state.lineHeight)
      if (lineExtra > 0) {
        // 在应用自身的行高（24px + 内容字号增量）之上再加 Xpx
        metricRules.push(
          `${MD} p, ${MD} li, ${MD} blockquote, ${MD} td, ${MD} h1, ${MD} h2, ${MD} h3, ${MD} h4 ` +
          `{ line-height: calc(24px + var(--dsh-content-font-delta, 0px) + ${lineExtra}px) !important; }`,
        )
      }

      const paragraphSpacing = metricValue(state.paragraphSpacing)
      if (paragraphSpacing > 0) {
        metricRules.push(`${MD} p { margin-block: ${paragraphSpacing}px !important; }`)
      }

      const firstLineIndent = metricValue(state.firstLineIndent)
      if (firstLineIndent > 0) {
        metricRules.push(`${MD} p { text-indent: ${firstLineIndent}em !important; }`)
      }

      /* ---------- 字重 ----------
         界面字重：挂 body（低特异性）→ 只影响**继承**的文本，组件自己声明的
         字重仍然优先。这样不会把"粗体标题 vs 常规正文"的层级压平。
         正文段落再单独压一次，因为 Markdown 段落常由 font 简写连带指定字重。
         标题字重：必须 !important —— 应用用 font 简写（含 weight）写在类规则里。 */
      const uiWeight = weightValue(state.fontWeight)
      if (uiWeight > 0) {
        metricRules.push(`body { font-weight: ${uiWeight}; }`)
        metricRules.push(`${MD} p, ${MD} li, ${MD} blockquote, ${MD} td { font-weight: ${uiWeight} !important; }`)
      }

      const headingWeight = weightValue(state.headingFontWeight)
      if (headingWeight > 0) {
        metricRules.push(
          `${MD} h1, ${MD} h2, ${MD} h3, ${MD} h4, ${MD} h5, ${MD} h6 { font-weight: ${headingWeight} !important; }`,
        )
      }

      const css =
        `/* ${SHEET_MARKER} */\n` +
        /* 字体名的横向缓慢滑动。位移量由设置页写入 --fp-marquee-x（实测溢出像素），
           两端往返，所以用 alternate。这段与用户配置无关，恒定存在。 */
        '@keyframes fp-marquee { from { transform: translateX(0); } to { transform: translateX(var(--fp-marquee-x, 0px)); } }\n' +
        (declarations.length > 0 ? `:root { ${declarations.join(' ')} }\n` : '') +
        (declarations.length > 0 || bodyDeclarations.length > 0
          ? `body { ${[...declarations, ...bodyDeclarations].join(' ')} }\n`
          : '') +
        metricRules.map((rule) => rule + '\n').join('')

      // 通道 1：样式表（保证以后新挂载的元素也能拿到令牌）。
      // 只挂一份：再次应用时更新内容，绝不堆叠。
      try {
        if (sheetMode === null) {
          if (typeof styles !== 'undefined' && styles && typeof styles.insert === 'function') {
            sheetDispose = styles.insert(css)
            sheetMode = 'runtime'
          } else if (typeof document !== 'undefined') {
            const el = document.createElement('style')
            el.setAttribute('data-plugin', 'font-probe')
            el.textContent = css
            document.head.appendChild(el)
            sheetElement = el
            sheetMode = 'element'
          }
        } else if (sheetMode === 'runtime') {
          try { if (typeof sheetDispose === 'function') sheetDispose() } catch (error) { /* already gone */ }
          sheetDispose = styles.insert(css)
        } else if (sheetElement !== null && typeof sheetElement.textContent === 'string') {
          sheetElement.textContent = css
        }
      } catch (error) {
        note('insertCss', error)
      }

      // 通道 2：inline + important —— 压过一切样式表。
      // 只写字体族：字号由官方的「通用 → 外观」负责，这里不碰。
      try {
        if (typeof document !== 'undefined') {
          const html = document.documentElement
          const body = document.body
          const applyInline = (el, property, value, on) => {
            if (!el || !el.style) return
            if (on) el.style.setProperty(property, value, 'important')
            else el.style.removeProperty(property)
          }
          for (const el of [html, body]) {
            applyInline(el, '--dsw-font-family', uiStack, hasUiFont)
            applyInline(el, '--ds-font-family-code', codeStack, hasCodeFont)
          }
          if (html) {
            html.setAttribute('data-dsh-font-override', SHEET_MARKER)
            html.setAttribute('data-dsh-font-family', (hasUiFont ? state.fontFamily : '') || '(default)')
          }
        }
      } catch (error) {
        note('inline setProperty', error)
      }
    }

    /* ---------- 可订阅的最小 store ---------- */
    function createStore(initial) {
      let snapshot = initial
      const listeners = new Set()
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        set(next) {
          snapshot = next
          for (const listener of [...listeners]) {
            try { listener() } catch (error) { note('store listener', error) }
          }
        },
      }
    }

    /** 持久化状态：显示在设置页顶部，让"到底存不存得进去"可见。 */
    let formStatus = 'pending'
    /** 诊断串：宿主实际服务的命名空间 + 快照真实内容。必须在使用前声明（TDZ）。 */
    let debugInfo = 'describe: (未读取)'
    function setFormStatus(next) {
      formStatus = next
      try { store.set({ ...state, formStatus, debugInfo }) } catch (error) { /* store not ready yet */ }
      try {
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.setAttribute('data-dsh-font-override-form', next)
        }
      } catch (error) { /* no DOM */ }
    }

    const store = createStore({ ...DEFAULTS, formStatus, debugInfo: 'describe: (未读取)' })

    function update(patch, persist) {
      Object.assign(state, patch)
      applyNow()
      store.set({ ...state, formStatus, debugInfo })
      if (persist) persistNow()
    }

    /* ---------- 持久化：profile 的 configForms / settingsScope ---------- */
    /**
     * `configForms` 按 **Host 插件条目 id** 取表单，不是包名、也不是 patchId。
     * `list_plugins` 里本插件的 entryId 是 `include:font-probe`（bundle 插入的行
     * 带 `include:` 前缀），所以它排第一。
     */
    /** 候选命名空间。真实 ns 是 `entry.options.id`（profile 行 id）——不带 `include:`。 */
    const ENTRY_CANDIDATES = ['font-probe', 'include:font-probe']
    const LEGACY_NAMESPACE = 'dsh-font-probe'

    let form = null
    let formUnsubscribe = null
    let pendingWrite = Promise.resolve()
    /** 未就绪时上一次看到的快照状态，供诊断显示。 */
    let pendingNote = ''
    let dirty = false
    /** 表单绑定与清理 effect 只做一次。 */
    let bound = false
    /** 诊断用：保留 configForms 服务句柄，供 refreshDebug 读 served 列表。 */
    let formsRef = null

    /**
     * 取设置表单。
     * 踩坑记录（两条，都很隐蔽）：
     *
     * A. `inject` 留空、只在 apply 里试探 `ctx.configForms`，服务没就绪就永久放弃。
     *    现在改成就绪重试。
     *
     * B. **`forms.get(ns)` 永远返回一个 lazy view，不校验该 ns 是否真被服务。**
     *    所以"拿到了 form"不等于"就绪"——必须看 `getSnapshot().status === 'ready'`。
     *    第一版据此乐观判定，状态行显示"会保存"却实际写不进去。
     *
     * 命名空间优先从 describe 镜像里找（`view.namespaces[].ns`），它才是 Host
     * 真正服务的名字；找不到再退回候选列表。
     */
    function listServedNamespaces(forms) {
      try {
        if (typeof forms.describe !== 'function') return []
        const describe = forms.describe()
        if (!describe || typeof describe.getSnapshot !== 'function') return []
        const snapshot = describe.getSnapshot()
        const namespaces = snapshot && snapshot.view && Array.isArray(snapshot.view.namespaces) ? snapshot.view.namespaces : []
        return namespaces.map((entry) => entry && entry.ns).filter((ns) => typeof ns === 'string')
      } catch (error) {
        return []
      }
    }

    function acquireForm(ctx) {
      let forms
      try { forms = ctx.configForms } catch (e) { forms = undefined }
      if (forms === undefined || forms === null) {
        try { forms = ctx.get('configForms') } catch (e) { forms = undefined }
      }
      formsRef = forms

      if (forms !== undefined && forms !== null && typeof forms.get === 'function') {
        const served = listServedNamespaces(forms).filter((ns) => ns === 'font-probe' || ns.endsWith('font-probe'))
        const candidates = served.length > 0 ? served : ENTRY_CANDIDATES

        /** 只有快照 status === 'ready' 才算真正就绪。 */
        const readyForm = (ns) => {
          try {
            const candidate = forms.get(ns)
            if (!candidate || typeof candidate.getSnapshot !== 'function') return null
            const snapshot = candidate.getSnapshot()
            return snapshot && snapshot.status === 'ready' ? candidate : null
          } catch (e) { return null }
        }

        for (const ns of candidates) {
          const candidate = readyForm(ns)
          if (candidate !== null) {
            setFormStatus(ns + ':ready')
            return candidate
          }
        }

        /* 没就绪就**不要绑定**。
           踩坑：`get()` 对任何 namespace 都返回一个 lazy view，所以"先拿一个
           凑合着用、靠 subscribe 等它就绪"是错的 —— 如果那个 namespace 根本不是
           宿主服务的名字（例如把 `include:font-probe` 当成 ns），它的快照会
           **永久 unavailable**，订阅再多次也救不回来。状态行于是卡在
           `include:unavailable`，而 served 列表里明明有正确的 `font-probe`。
           正确做法：返回 null，交给 bindFormWhenReady 继续重试。 */
        let lastSeen = ''
        for (const ns of candidates) {
          try {
            const candidate = forms.get(ns)
            if (!candidate || typeof candidate.getSnapshot !== 'function') continue
            const snapshot = candidate.getSnapshot()
            lastSeen = String(snapshot && snapshot.status ? snapshot.status : 'unknown')
          } catch (e) { /* 下一个候选 */ }
        }
        pendingNote = lastSeen === '' ? 'none-of:' + ENTRY_CANDIDATES.join('|') : 'waiting:' + lastSeen
        setFormStatus('pending')
        return null
      }

      setFormStatus('no-configForms')

      // 旧版：settingsScope.bind({ namespace })
      let binder
      try { binder = ctx.settingsScope } catch (e) { binder = undefined }
      if (binder === undefined || binder === null) {
        try { binder = ctx.get('settingsScope') } catch (e) { binder = undefined }
      }
      if (binder && typeof binder.bind === 'function') {
        try {
          const scope = binder.bind({ namespace: LEGACY_NAMESPACE })
          if (scope && typeof scope.getSnapshot === 'function') {
            setFormStatus('settingsScope')
            return scope
          }
        } catch (e) { /* 放弃持久化 */ }
      }
      return null
    }

    /* ---------- 诊断：把宿主实际服务的命名空间与快照内容摊在页面上 ----------
       排查"设了不生效/存不进去"时，最缺的就是这两样东西。它们不依赖控制台，
       打开设置页就能读到。稳定后可以删，但代价是下次再出问题又得靠猜。 */
    function refreshDebug(forms, snapshot) {
      const parts = []
      try {
        const served = listServedNamespaces(forms)
        parts.push('served=' + (served.length ? served.join(',') : '(空)'))
      } catch (error) {
        parts.push('served=ERR')
      }
      if (snapshot) {
        parts.push('status=' + String(snapshot.status))
        if (snapshot.value) {
          parts.push('value.fontFamily=' + JSON.stringify(snapshot.value.fontFamily))
        } else {
          parts.push('value=(无)')
        }
      }
      // 关键：区分"宿主给了什么"和"我们实际应用了什么"
      parts.push('applied=' + JSON.stringify(state.fontFamily))
      parts.push('dirty=' + String(dirty))
      if (pendingNote) parts.push('pending=' + pendingNote)
      try {
        const inlineVar = typeof document !== 'undefined' && document.documentElement && document.documentElement.style
          ? document.documentElement.style.getPropertyValue('--dsw-font-family')
          : ''
        parts.push('inlineVar=' + JSON.stringify(String(inlineVar).slice(0, 34)))
      } catch (error) { parts.push('inlineVar=ERR') }
      if (errors.length > 0) parts.push('errors=' + JSON.stringify(errors.slice(-3)))
      debugInfo = parts.join('  ')
      try { store.set({ ...state, formStatus, debugInfo }) } catch (error) { /* store not ready */ }
    }
    function syncFromForm() {
      if (!form || typeof form.getSnapshot !== 'function') return
      let snapshot
      try { snapshot = form.getSnapshot() } catch (error) { note('form.getSnapshot', error); return }
      if (!snapshot) return
      // 诊断先行：不管 ready 与否都把宿主真实状态摊出来
      refreshDebug(formsRef, snapshot)
      // 状态以快照为准：loading / unavailable / ready
      if (snapshot.status !== 'ready') {
        setFormStatus((formStatus.split(':')[0] || 'font-probe') + ':' + snapshot.status)
        return
      }
      if (!snapshot.value) return
      const value = snapshot.value
      if (dirty) return
      /* 字符串字段统一走这里的宽松读取：非字符串一律按默认（空）处理。 */
      const str = (v, fallback) => (typeof v === 'string' ? v : fallback)
      Object.assign(state, {
        fontFamily: str(value.fontFamily, '') !== '' ? value.fontFamily : DEFAULTS.fontFamily,
        latinFontFamily: str(value.latinFontFamily, DEFAULTS.latinFontFamily),
        codeFontFamily: str(value.codeFontFamily, DEFAULTS.codeFontFamily),
        fontWeight: str(value.fontWeight, DEFAULTS.fontWeight),
        headingFontWeight: str(value.headingFontWeight, DEFAULTS.headingFontWeight),
        letterSpacing: str(value.letterSpacing, DEFAULTS.letterSpacing),
        lineHeight: str(value.lineHeight, DEFAULTS.lineHeight),
        paragraphSpacing: str(value.paragraphSpacing, DEFAULTS.paragraphSpacing),
        firstLineIndent: str(value.firstLineIndent, DEFAULTS.firstLineIndent),
      })
      applyNow()
      refreshDebug(formsRef, snapshot)
    }

    function bindForm(ctx) {
      form = acquireForm(ctx)
      if (!form) return false
      syncFromForm()
      if (typeof form.subscribe === 'function') formUnsubscribe = form.subscribe(syncFromForm)
      return true
    }

    /**
     * 等 `configForms` 就绪再绑定。
     * 和 `slots` 完全同一类坑：apply 那一刻服务可能还没装好，只试一次就永久放弃，
     * 结果是界面能改字体、`persistNow()` 却因为 `form === null` 直接 return ——
     * 设置永远不落盘，而且没有任何报错。
     */
    let bindTimer = null
    function bindFormWhenReady(ctx, attempt) {
      if (disposed || form !== null) return
      let ok = false
      try { ok = bindForm(ctx) } catch (error) { note('bindForm', error) }
      if (ok) return
      if (attempt < 120) {
        bindTimer = setTimeout(() => bindFormWhenReady(ctx, attempt + 1), 250)
        if (bindTimer && typeof bindTimer.unref === 'function') bindTimer.unref()
      } else {
        note('configForms', new Error('等待 configForms 服务超时；设置不会落盘（字体仍生效）'))
      }
    }

    /**
     * 串行写入。
     *
     * **关键 API 事实**（从 `@deepseek-ai/dsh-client-ui-settings` 的
     * `ConfigFormController` 读出来的）：
     *     set(field, value)  →  mutate([{ op:"set", path:[field], value }])
     * 也就是说 `set` 收的是**单个字段名**，不是整个配置对象。
     * 第一版写成 `form.set({fontFamily, …})`，整个对象被当成"字段名"，
     * 于是什么都没写进去 —— 而且 `mutate` 内部报的错不会冒泡到这里，
     * 表现为"界面能改、文件永不更新"。现在改用 `mutate` 一次原子写入三个字段。
     */
    function persistNow() {
      if (!form) {
        note('form.set', new Error('设置表单尚未就绪，这次改动只在当前页面生效'))
        return
      }
      dirty = true
      const payload = { ...state }
      const ops = Object.keys(payload).map((field) => ({ op: 'set', path: [field], value: payload[field] }))

      pendingWrite = pendingWrite
        .then(async () => {
          if (typeof form.mutate === 'function') return form.mutate(ops)
          // 极老的形态：逐字段 set(field, value)
          if (typeof form.set === 'function') {
            for (const op of ops) await form.set(op.path[0], op.value)
            return true
          }
          throw new Error('表单既无 mutate 也无 set')
        })
        .then((ok) => {
          if (ok === false) {
            setFormStatus((formStatus.split(':')[0] || 'font-probe') + ':refused')
            note('form.set', new Error('宿主拒绝了这次写入（字段未标 volatile / 非 loopback 的 memory 模式 / revision 冲突）'))
          } else {
            // 写成功后本地状态与宿主一致，解除 dirty，让后续宿主推送能再同步回来。
            dirty = false
            setFormStatus((formStatus.split(':')[0] || 'font-probe') + ':saved')
          }
        })
        .catch((error) => {
          setFormStatus((formStatus.split(':')[0] || 'font-probe') + ':error')
          note('form.set', error)
        })
      return pendingWrite
    }

    /* ---------- 设置页 UI ---------- */
    const rowStyle = {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '16px 0',
      borderBottom: '0.5px solid var(--dsw-alias-border-l2)',
      /* 页面是列向 flex；同样禁止被压扁，否则高滚动容器里行会被挤压重叠 */
      flexShrink: 0,
    }
    const labelStyle = {
      display: 'block',
      color: 'var(--dsw-alias-label-primary)',
      fontSize: '14px',
      lineHeight: '22px',
    }
    const hintStyle = {
      display: 'block',
      color: 'var(--dsw-alias-label-tertiary)',
      fontSize: '12px',
      lineHeight: '18px',
      marginTop: '2px',
    }
    const controlStyle = {
      font: 'inherit',
      fontSize: '13px',
      color: 'var(--dsw-alias-label-primary)',
      background: 'var(--dsw-alias-bg-layer-1)',
      border: '0.5px solid var(--dsw-alias-border-l3)',
      borderRadius: 'var(--dsw-radius-md)',
      padding: '6px 10px',
      minWidth: '260px',
      boxSizing: 'border-box',
    }
    const buttonStyle = {
      font: 'inherit',
      fontSize: '13px',
      color: 'var(--dsw-alias-label-primary)',
      background: 'var(--dsw-alias-interactive-bg-hover)',
      border: '0.5px solid var(--dsw-alias-border-l3)',
      borderRadius: 'var(--dsw-radius-md)',
      padding: '6px 14px',
      cursor: 'pointer',
    }


    function FontSettingsPage() {
      const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
      const [draft, setDraft] = React.useState(snapshot.fontFamily)
      const [draftLatin, setDraftLatin] = React.useState(snapshot.latinFontFamily)
      const [draftCode, setDraftCode] = React.useState(snapshot.codeFontFamily)
      const [draftWeight, setDraftWeight] = React.useState(snapshot.fontWeight)
      const [draftHeadingWeight, setDraftHeadingWeight] = React.useState(snapshot.headingFontWeight)

      /* ---------- 采样设置面板的真实底色 ----------
         渐隐带必须"淹没"在设置面板里，任何猜错的令牌都会露出一道色带。
         与其猜 --dsw-alias-bg-* 里的哪一个，不如从本段往上走，
         取第一个真正有底色的祖先算出来的 backgroundColor。
         这样深浅色主题、第三方主题、以及面板内部再多包几层都能自动对上。 */
      const useRefSafe = typeof React.useRef === 'function' ? React.useRef : () => ({ current: null })
      const useEffectSafe = typeof React.useEffect === 'function' ? React.useEffect : () => {}
      const rootRef = useRefSafe(null)
      const [panelBg, setPanelBg] = React.useState('')

      useEffectSafe(() => {
        const node = rootRef.current
        if (!node || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return
        /** 'transparent' 与全透明 rgba 都表示"没画底色"，继续往上找。 */
        const opaque = (value) => typeof value === 'string' && value !== '' && value !== 'transparent'
          && !/^rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(value)
        let el = node.parentElement
        let depth = 0
        while (el && depth < 12) {
          let bg = ''
          try { bg = window.getComputedStyle(el).backgroundColor || '' } catch (error) { bg = '' }
          if (opaque(bg)) { setPanelBg(bg); return }
          el = el.parentElement
          depth++
        }
      }, [])

      /* 采样成功就用面板真实底色；拿不到就退回应用基础背景令牌。
         两个派生色都从它算：渐隐末端 86%，卡片 92%（略实一点，边界更清楚）。 */
      const panelColor = panelBg || 'var(--dsw-alias-bg-base, Canvas)'

      /* useState 的初始值只在挂载时取一次；宿主值晚到或外部改动后，
         输入框会一直显示旧值（用户以为"还是阿里妈妈"其实是控件没同步）。
         这里把 draft 跟随快照更新，编辑期间由本地 setDraft 覆盖。 */
      const [syncedFrom, setSyncedFrom] = React.useState(snapshot.fontFamily)
      if (syncedFrom !== snapshot.fontFamily) {
        setSyncedFrom(snapshot.fontFamily)
        setDraft(snapshot.fontFamily)
      }
      const [syncedLatin, setSyncedLatin] = React.useState(snapshot.latinFontFamily)
      if (syncedLatin !== snapshot.latinFontFamily) {
        setSyncedLatin(snapshot.latinFontFamily)
        setDraftLatin(snapshot.latinFontFamily)
      }

      /* ---------- 草稿 → 确认 的提交模型 ----------
         控件只改本地草稿，界面与 profile 都不动；点「确认应用」才一次性生效并写盘。
         好处：可以先把字体挑好、在预览里看准了再提交，避免每动一下就改全局。 */
      const [syncedCode, setSyncedCode] = React.useState(snapshot.codeFontFamily)
      if (syncedCode !== snapshot.codeFontFamily) {
        setSyncedCode(snapshot.codeFontFamily)
        setDraftCode(snapshot.codeFontFamily)
      }
      const [syncedWeight, setSyncedWeight] = React.useState(snapshot.fontWeight)
      if (syncedWeight !== snapshot.fontWeight) {
        setSyncedWeight(snapshot.fontWeight)
        setDraftWeight(snapshot.fontWeight)
      }
      const [syncedHeadingWeight, setSyncedHeadingWeight] = React.useState(snapshot.headingFontWeight)
      if (syncedHeadingWeight !== snapshot.headingFontWeight) {
        setSyncedHeadingWeight(snapshot.headingFontWeight)
        setDraftHeadingWeight(snapshot.headingFontWeight)
      }

      /* 排版四项合成**一个**草稿对象：字段同构，逐项 useState 只会堆样板。 */
      const [metrics, setMetrics] = React.useState(() => pickMetrics(snapshot))
      const metricSig = metricSignature(snapshot)
      const [syncedMetricSig, setSyncedMetricSig] = React.useState(metricSig)
      if (syncedMetricSig !== metricSig) {
        setSyncedMetricSig(metricSig)
        setMetrics(pickMetrics(snapshot))
      }

      /* 总预览的样张：两段（中文 / 拉丁+数字）。
         保留两段是因为单段看不出「段距」；混排那段只是重复信息，占地方就够了。 */
      const previewParagraphs = [
        '永和九年，岁在癸丑，暮春之初，会于会稽山阴之兰亭，修禊事也。',
        'The quick brown fox jumps over the lazy dog — 0123456789',
      ]

      /* 字号交给官方「外观」，预览按应用默认尺寸渲染：
         正文 14px、标题 h2 19/28px、代码 12px；只有行距会带动行高。 */
      const baseLineHeight = 24
      const previewLineHeight = baseLineHeight + (metrics.lineHeight || 0)
      const previewFontSize = 14
      const previewBodyWeight = weightValue(draftWeight) || 400
      const previewHeadingWeight = weightValue(draftHeadingWeight) || 700
      const previewHeadingSize = 19
      const previewHeadingLineHeight = 28
      const previewCodeFontSize = 12
      const previewCodeLineHeight = Math.round(previewCodeFontSize * 1.6)

      /* 反引号在单引号字符串里是普通字符，不会被当成模板插值 */
      const previewCodeSample = [
        'const greet = (name) => `Hi, ${name}`',
        '// 0123 ABCdef + 中文标点，。！？',
      ].join('\n')

      const asDraft = (v) => (typeof v === 'string' ? v : '')

      /* 触发按钮上显示的名字：命中预设就显示预设的友好名称，否则原样显示族名。 */
      const draftFamily = asDraft(draft)
      const matchedChoice = FONT_CHOICES.find(
        (c) => c.value === draftFamily || (c.aliases || []).indexOf(draftFamily) >= 0,
      )
      const currentFamilyLabel = draftFamily === ''
        ? '默认（应用自带字体）'
        : (matchedChoice ? matchedChoice.label : draftFamily)
      const hasChanges =
        asDraft(draft) !== asDraft(snapshot.fontFamily) ||
        asDraft(draftLatin) !== asDraft(snapshot.latinFontFamily) ||
        asDraft(draftCode) !== asDraft(snapshot.codeFontFamily) ||
        asDraft(draftWeight) !== asDraft(snapshot.fontWeight) ||
        asDraft(draftHeadingWeight) !== asDraft(snapshot.headingFontWeight) ||
        METRIC_KEYS.some((k) => metrics[k] !== metricValue(snapshot[k]))

      /** 字重只接受 100–900 的整百，其它一律存空。 */
      const weightOrEmpty = (v) => {
        const n = weightValue(v)
        return n > 0 ? String(n) : ''
      }

      const confirmAll = () => {
        const metricPayload = {}
        for (const k of METRIC_KEYS) metricPayload[k] = metrics[k] > 0 ? String(metrics[k]) : ''
        update(
          {
            fontFamily: draft,
            latinFontFamily: draftLatin,
            codeFontFamily: draftCode,
            fontWeight: weightOrEmpty(draftWeight),
            headingFontWeight: weightOrEmpty(draftHeadingWeight),
            ...metricPayload,
          },
          true,
        )
      }

      /** 恢复默认只重置草稿，同样需要点确认才生效。 */
      const resetDrafts = () => {
        setDraft(DEFAULTS.fontFamily)
        setDraftLatin(DEFAULTS.latinFontFamily)
        setDraftCode(DEFAULTS.codeFontFamily)
        setDraftWeight(DEFAULTS.fontWeight)
        setDraftHeadingWeight(DEFAULTS.headingFontWeight)
        setMetrics(pickMetrics(DEFAULTS))
      }

      /* ---------- 预览的尺寸偏好（可拖动 / 可隐藏）----------
         字号和行距一调大，预览会把吸底卡片顶得很高。给一条拖动条和一个隐藏开关，
         偏好存进 localStorage：**不动 host schema，所以不需要重启**。 */
      const PREVIEW_PREF_KEY = 'dsh-font-probe.preview-pref'
      const readPreviewPref = () => {
        const fallback = { height: 176, hidden: false }
        try {
          if (typeof window === 'undefined' || !window.localStorage) return fallback
          const raw = window.localStorage.getItem(PREVIEW_PREF_KEY)
          if (!raw) return fallback
          const parsed = JSON.parse(raw) || {}
          const height = Number(parsed.height)
          return {
            height: Number.isFinite(height) && height >= 60 ? Math.min(600, Math.round(height)) : fallback.height,
            hidden: parsed.hidden === true,
          }
        } catch (error) {
          return fallback
        }
      }
      const [previewPref, setPreviewPref] = React.useState(readPreviewPref)

      const persistPreviewPref = (next) => {
        setPreviewPref(next)
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(PREVIEW_PREF_KEY, JSON.stringify(next))
          }
        } catch (error) { /* 隐私模式下可能抛错，忽略即可 */ }
      }

      /** 向上拖 = 变高。拖动过程只更新状态，松手才落盘，避免每次 mousemove 都写 localStorage。 */
      const startPreviewResize = (event) => {
        if (typeof window === 'undefined' || !window.addEventListener) return
        event.preventDefault()
        const startY = event.clientY
        const startHeight = previewPref.height
        const hiddenAtStart = previewPref.hidden
        let latest = startHeight
        const onMove = (moveEvent) => {
          latest = Math.round(Math.max(80, Math.min(560, startHeight + (startY - moveEvent.clientY))))
          setPreviewPref((prev) => (prev.height === latest ? prev : { ...prev, height: latest }))
        }
        const onUp = () => {
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
          persistPreviewPref({ height: latest, hidden: hiddenAtStart })
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
      }

      /* ---------- 当前字体名的横向滚动（marquee）----------
         字体族名经常比控件宽，原生 <select> 只会把它截断，无法做动画。
         所以换成自绘触发按钮：名字放在 overflow:hidden 的容器里，
         实测溢出量后写进 CSS 变量，交给 @keyframes 缓慢左右往返。 */
      const [presetMenuOpen, setPresetMenuOpen] = React.useState(false)
      const nameWrapRef = useRefSafe(null)
      const [nameOverflow, setNameOverflow] = React.useState(0)

      /* 不传依赖数组：每次渲染后都重新量一次（字体加载完、窗口变化都会影响宽度）。
         值没变时 setState 会被 React 短路，不会造成循环。 */
      useEffectSafe(() => {
        const el = nameWrapRef.current
        if (!el) return
        const overflow = (el.scrollWidth || 0) - (el.clientWidth || 0)
        setNameOverflow(overflow > 2 ? Math.round(overflow) : 0)
      })

      /* ---------- 系统字体列表（Local Font Access API）----------
         `queryLocalFonts()` 需要用户手势，所以只在点击「浏览本机字体」时调用。
         权限：DSH 主窗口的 permission handler 对非 media 权限直接放行，因此这里
         通常不需要弹窗；若环境不支持或用户拒绝，就退回手输字体族名。 */
      const [pickerOpen, setPickerOpen] = React.useState(false)
      /** 这次打开列表是要选哪一个：'cjk'（界面字体）还是 'latin'（英文字体）。 */
      const [pickerFor, setPickerFor] = React.useState('cjk')
      const [fontList, setFontList] = React.useState(null)   // string[] | null
      const [fontListState, setFontListState] = React.useState('idle') // idle|loading|ready|unsupported|denied
      const [fontQuery, setFontQuery] = React.useState('')

      const loadSystemFonts = async () => {
        const api = typeof window !== 'undefined' ? window.queryLocalFonts : undefined
        if (typeof api !== 'function') { setFontListState('unsupported'); return }
        setFontListState('loading')
        try {
          const fonts = await api.call(window)
          const families = Array.from(new Set((fonts || []).map((f) => f && f.family).filter((n) => typeof n === 'string' && n.trim() !== '')))
          families.sort((a, b) => a.localeCompare(b, 'zh-Hans-CN', { sensitivity: 'base' }))
          setFontList(families)
          setFontListState(families.length > 0 ? 'ready' : 'unsupported')
        } catch (error) {
          note('queryLocalFonts', error)
          setFontListState('denied')
        }
      }

      const onBrowse = (target) => {
        const wanted = target === 'latin' ? 'latin' : target === 'code' ? 'code' : 'cjk'
        // 已打开且选的是同一目标 → 收起；换了目标 → 只切换目标，不收起
        if (pickerOpen && pickerFor === wanted) { setPickerOpen(false); return }
        setPickerFor(wanted)
        setPickerOpen(true)
        if (fontList === null && fontListState !== 'loading') loadSystemFonts()
      }

      /** 列表点选：写进当前目标对应的草稿（三行共用同一份列表）。 */
      const pickFamily = (family) => {
        if (pickerFor === 'latin') setDraftLatin(family)
        else if (pickerFor === 'code') setDraftCode(family)
        else setDraft(family)
        setPickerOpen(false)
      }

      /** 当前目标的草稿值 —— 用于列表里的高亮判定。 */
      const currentPickValue = asDraft(
        pickerFor === 'latin' ? draftLatin : pickerFor === 'code' ? draftCode : draft,
      )

      const filteredFamilies = (() => {
        if (!fontList) return []
        const q = fontQuery.trim().toLowerCase()
        return (q === '' ? fontList : fontList.filter((f) => f.toLowerCase().includes(q))).slice(0, 300)
      })()

      /* 字体列表：两行（界面字体 / 英文字体）共用同一份 UI，
         谁被点开就渲染在谁自己下方 —— 之前写死在界面字体行里，
         点英文字体时面板却从上面弹出，很怪。 */
      const renderFontPicker = () => (
React.createElement('div', {
                key: 'picker',
                style: {
                  marginTop: '10px',
                  width: '100%',
                  boxSizing: 'border-box',
                  border: '0.5px solid var(--dsw-alias-border-l3)',
                  borderRadius: 'var(--dsw-radius-lg)',
                  background: 'var(--dsw-alias-bg-layer-1)',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                },
              }, [
                React.createElement('input', {
                  key: 'q',
                  type: 'text',
                  'aria-label': '筛选字体',
                  placeholder: '输入名称筛选，例如 yahei / noto / 黑体',
                  value: fontQuery,
                  onChange: (event) => setFontQuery(event.target.value),
                  style: { ...controlStyle, minWidth: '0', width: '100%', boxSizing: 'border-box' },
                }),
                React.createElement('span', { key: 'st', style: hintStyle },
                  fontListState === 'loading' ? '正在读取系统字体…'
                    : fontListState === 'unsupported' ? '当前环境不支持字体枚举（需要 Chromium 的 Local Font Access API），请直接在上面输入字体族名。'
                      : fontListState === 'denied' ? '读取系统字体被拒绝，请直接输入字体族名。'
                        : fontListState === 'ready' ? `共 ${fontList.length} 个字体族，显示 ${filteredFamilies.length} 个`
                          : ''),
                React.createElement('div', {
                  key: 'list',
                  style: { maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' },
                }, filteredFamilies.map((family) => React.createElement(
                  'button',
                  {
                    key: family,
                    type: 'button',
                    title: family,
                    onClick: () => pickFamily(family),
                    style: {
                      font: 'inherit',
                      fontSize: '15px',
                      /* 行高给足：CJK 字体的 ascent/descent 比拉丁大，行太矮会切掉上下 */
                      lineHeight: '1.7',
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'var(--dsw-alias-label-primary)',
                      fontFamily: `"${family}", sans-serif`,
                      background: family === currentPickValue ? 'var(--dsw-alias-bg-module-platform)' : 'transparent',
                      border: '0.5px solid ' + (family === currentPickValue ? 'var(--dsw-static-neutral-bluish-400)' : 'transparent'),
                      borderRadius: 'var(--dsw-radius-md)',
                      padding: '9px 12px',
                      minHeight: '46px',
                      boxSizing: 'border-box',
                      /* 关键：列表是 max-height 的列向 flex 容器，子项默认
                         flex-shrink:1 会被压扁（内容溢出、边框穿字）。必须禁止收缩，
                         让容器正常滚动。 */
                      flexShrink: 0,
                      /* 长名字换行而不是被省略号截断 */
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                      wordBreak: 'break-word',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      alignItems: 'stretch',
                    },
                  },
                  [
                    React.createElement('span', { key: 'n', style: { display: 'block' } }, family),
                    React.createElement('span', {
                      key: 's',
                      style: {
                        display: 'block',
                        fontSize: '12px',
                        lineHeight: '1.7',
                        color: 'var(--dsw-alias-label-tertiary)',
                      },
                    }, 'Aa Bb 0123 中文示例'),
                  ],
                ))),
              ])
      )
      const rows = []

      rows.push(
        React.createElement('div', { key: 'family', style: { ...rowStyle, flexDirection: 'column' } }, [
          React.createElement('div', { key: 'head', style: { display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%' } }, [
            React.createElement('span', { key: 'l', style: { flex: '1 1 auto', minWidth: '0' } }, [
              React.createElement('span', { key: 't', style: labelStyle }, '中文字体'),
              React.createElement('span', { key: 'h', style: hintStyle }, '汉字使用的字体。改完点底部「确认应用」才生效。'),
            ]),
            /* 控件列固定成下面输入框的同一宽度（controlStyle.minWidth），
               否则三个控件会被各自内容撑成不同宽，右边缘参差。 */
            React.createElement('div', {
              key: 'c',
              style: {
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                flex: '0 0 auto',
                width: controlStyle.minWidth,
              },
            }, [
              /* 触发按钮：显示当前字体族名，超出宽度时缓慢左右滑动 */
              React.createElement('button', {
                key: 'sel',
                type: 'button',
                'aria-label': '中文字体',
                'aria-expanded': presetMenuOpen ? 'true' : 'false',
                title: currentFamilyLabel,
                onClick: () => setPresetMenuOpen((open) => !open),
                style: {
                  ...controlStyle,
                  minWidth: 0,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  overflow: 'hidden',
                },
              }, [
                React.createElement('span', {
                  key: 'w',
                  ref: nameWrapRef,
                  style: {
                    flex: '1 1 auto',
                    minWidth: 0,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    /* 动画距离由实测溢出量决定，交给 keyframes 消费 */
                    '--fp-marquee-x': `-${nameOverflow}px`,
                  },
                }, React.createElement('span', {
                  key: 'n',
                  style: {
                    display: 'inline-block',
                    whiteSpace: 'nowrap',
                    animation: nameOverflow > 0 ? 'fp-marquee 6s ease-in-out infinite alternate' : undefined,
                  },
                }, currentFamilyLabel)),
                React.createElement('span', {
                  key: 'arrow',
                  'aria-hidden': 'true',
                  style: { flex: '0 0 auto', opacity: 0.55, fontSize: '11px' },
                }, presetMenuOpen ? '▴' : '▾'),
              ]),

              /* 预设下拉：自绘，原生 select 无法做滚动动画 */
              presetMenuOpen
                ? React.createElement('div', {
                    key: 'menu',
                    style: {
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '4px',
                      zIndex: 20,
                      maxHeight: '240px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '4px',
                      gap: '2px',
                      background: 'var(--dsw-alias-bg-layer-1)',
                      border: '0.5px solid var(--dsw-alias-border-l3)',
                      borderRadius: 'var(--dsw-radius-md)',
                      boxShadow: '0 8px 24px rgb(0 0 0 / 0.18)',
                    },
                  }, FONT_CHOICES.map((choice) => {
                    /* 每次展开菜单时实测哪些没装：7 个族各量一次宽度，开销可忽略。
                       只在菜单打开时算，关着的时候完全不碰 canvas。 */
                    const installed = isChoiceAvailable(choice.value)
                    const showDownload = !installed && typeof choice.downloadUrl === 'string'
                    return React.createElement('div', {
                      key: choice.value,
                      style: { display: 'flex', alignItems: 'center', gap: '4px' },
                    }, [
                      React.createElement('button', {
                        key: 'pick',
                        type: 'button',
                        onClick: () => {
                          setDraft(choice.value)
                          setPresetMenuOpen(false)
                        },
                        style: {
                          font: 'inherit',
                          fontSize: '13px',
                          lineHeight: '20px',
                          textAlign: 'left',
                          padding: '6px 8px',
                          borderRadius: 'var(--dsw-radius-sm, 4px)',
                          border: 'none',
                          cursor: 'pointer',
                          flex: '1 1 auto',
                          minWidth: '0',
                          color: installed ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-tertiary)',
                          background: choice.value === asDraft(draft)
                            ? 'var(--dsw-alias-bg-module-platform)'
                            : 'transparent',
                        },
                      }, choice.label),

                      /* 没装 + 有官方页 → 直接开官方下载 */
                      showDownload
                        ? React.createElement('a', {
                            key: 'dl',
                            href: choice.downloadUrl,
                            target: '_blank',
                            rel: 'noreferrer noopener',
                            title: '打开官方下载页',
                            onClick: (event) => event.stopPropagation(),
                            style: {
                              flex: '0 0 auto',
                              fontSize: '11px',
                              lineHeight: '18px',
                              padding: '1px 7px',
                              borderRadius: '999px',
                              textDecoration: 'none',
                              color: 'var(--dsw-alias-label-primary)',
                              background: 'var(--dsw-alias-interactive-bg-hover)',
                              border: '0.5px solid var(--dsw-alias-border-l3)',
                            },
                          }, '下载')
                        : null,

                      /* 没装但是系统自带（或没有确认过官方页）→ 只给一个不可点的提示 */
                      !installed && !showDownload
                        ? React.createElement('span', {
                            key: 'miss',
                            title: choice.system ? '操作系统自带，通常已随系统安装' : '本机未安装',
                            style: {
                              flex: '0 0 auto',
                              fontSize: '11px',
                              lineHeight: '18px',
                              padding: '1px 7px',
                              borderRadius: '999px',
                              color: 'var(--dsw-alias-label-tertiary)',
                              border: '0.5px dashed var(--dsw-alias-border-l3)',
                            },
                          }, choice.system ? '系统自带' : '未安装')
                        : null,
                    ])
                  }))
                : null,

              /* 不再提供手输框：自定义族名统一走「浏览本机字体…」，
                 避免同一个名字有两种输入途径、状态各自为政。 */
              React.createElement(
                'button',
                {
                  key: 'browse',
                  type: 'button',
                  style: { ...buttonStyle, minWidth: 0, width: '100%' },
                  onClick: () => onBrowse('cjk'),
                },
                pickerOpen && pickerFor === 'cjk' ? '收起字体列表' : '浏览本机字体…',
              ),
            ]),
          ]),

          pickerOpen && pickerFor === 'cjk' ? renderFontPicker() : null,
        ]),
      )

      /* 英文字体：和代码字体一样是独立一项。
         合成栈时拉丁字体排在中文字体**前面**，这样字母/数字命中它，
         汉字因为它没有字形而回落到界面字体。 */
      rows.push(
        React.createElement('div', { key: 'latin', style: { ...rowStyle, flexDirection: 'column' } }, [
          React.createElement('div', { key: 'head', style: { display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%' } }, [
            React.createElement('span', { key: 'l', style: { flex: '1 1 auto', minWidth: '0' } }, [
              React.createElement('span', { key: 't', style: labelStyle }, '英文字体'),
              React.createElement('span', { key: 'h', style: hintStyle }, '只作用于拉丁字母与数字；汉字仍用上面的中文字体。留空则不区分。'),
            ]),
            React.createElement('span', { key: 'c', style: { display: 'flex', flexDirection: 'column', gap: '6px', flex: '0 0 auto' } }, [
              React.createElement('input', {
                key: 'i',
                type: 'text',
                'aria-label': '英文字体',
                placeholder: '例如 Segoe UI / Inter',
                value: draftLatin,
                style: controlStyle,
                onChange: (event) => setDraftLatin(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') confirmAll()
                },
              }),
              React.createElement(
                'button',
                {
                  key: 'browse',
                  type: 'button',
                  style: { ...buttonStyle, minWidth: controlStyle.minWidth },
                  onClick: () => onBrowse('latin'),
                },
                pickerOpen && pickerFor === 'latin' ? '收起字体列表' : '浏览本机字体…',
              ),
            ]),
          ]),

          // 面板渲染在**自己这一行**下方：谁被点开就长在谁下面
          pickerOpen && pickerFor === 'latin' ? renderFontPicker() : null,
        ]),
      )

      /* 预览不再单独占一行：它被并进底部吸底卡片，和确认按钮待在同一个框里，
         这样滚动时"看效果"和"确认"始终在同一处，不用上下找。 */

      /* 代码字体：与英文字体同构 —— 输入框 + 「浏览本机字体…」，
         点开时列表就展开在自己这一行下方。 */
      rows.push(
        React.createElement('div', { key: 'code', style: { ...rowStyle, flexDirection: 'column' } }, [
          React.createElement('div', { key: 'head', style: { display: 'flex', alignItems: 'flex-start', gap: '12px', width: '100%' } }, [
            React.createElement('span', { key: 'l', style: { flex: '1 1 auto', minWidth: '0' } }, [
              React.createElement('span', { key: 't', style: labelStyle }, '代码字体'),
              React.createElement('span', { key: 'h', style: hintStyle }, '代码块 / 终端 / 行号的等宽字体。留空用应用自带栈。'),
            ]),
            React.createElement('span', { key: 'c', style: { display: 'flex', flexDirection: 'column', gap: '6px', flex: '0 0 auto' } }, [
              React.createElement('input', {
                key: 'i',
                type: 'text',
                'aria-label': '代码字体',
                placeholder: '例如 Consolas',
                value: draftCode,
                style: controlStyle,
                onChange: (event) => setDraftCode(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') confirmAll()
                },
              }),
              React.createElement(
                'button',
                {
                  key: 'browse',
                  type: 'button',
                  style: { ...buttonStyle, minWidth: controlStyle.minWidth },
                  onClick: () => onBrowse('code'),
                },
                pickerOpen && pickerFor === 'code' ? '收起字体列表' : '浏览本机字体…',
              ),
            ]),
          ]),

          pickerOpen && pickerFor === 'code' ? renderFontPicker() : null,
        ]),
      )

      /* ---------- 字重：界面（含正文）/ 标题 并排一行 ----------
         用 select 而不是滑块：字重是离散档位，滑块中间值没有意义。
         标题字重留空时跟随界面字重，所以"只调一处"也能整体变粗细。 */
      const weightField = (key, label, hint, ariaLabel, value, onChange) =>
        React.createElement('div', {
          key,
          style: { flex: '1 1 0', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '6px' },
        }, [
          React.createElement('span', { key: 'l' }, [
            React.createElement('span', { key: 't', style: labelStyle }, label),
            React.createElement('span', { key: 'h', style: hintStyle }, hint),
          ]),
          React.createElement('select', {
            key: 's',
            'aria-label': ariaLabel,
            value: weightOrEmpty(value),
            style: { ...controlStyle, minWidth: '0', width: '100%' },
            onChange,
          }, WEIGHT_OPTIONS.map((opt) => React.createElement('option', { key: opt.value || 'default', value: opt.value }, opt.label))),
        ])

      rows.push(
        React.createElement('div', { key: 'weights', style: { ...rowStyle, alignItems: 'stretch', gap: '16px' } }, [
          weightField('bodyWeight', '界面字重', '正文与界面文字；留空为默认', '界面字重', draftWeight,
            (event) => setDraftWeight(event.target.value)),
          React.createElement('div', {
            key: 'divider',
            'aria-hidden': true,
            style: { flex: '0 0 auto', width: '0.5px', alignSelf: 'stretch', background: 'var(--dsw-alias-border-l2)' },
          }),
          weightField('headingWeight', '标题字重', '仅 Markdown 标题；留空跟随界面字重', '标题字重', draftHeadingWeight,
            (event) => setDraftHeadingWeight(event.target.value)),
        ]),
      )

      /* ---------- 排版四项（滑块）----------
          只作用于正文 Markdown 区，不碰设置界面自己的文字（见 applyNow 里的
         [class*="_markdown"] 选择器）。滑块拖到最左（0）即"不覆盖"。 */
      for (const metric of METRICS) {
        const value = metrics[metric.key] || 0
        const sliderId = 'fp-metric-' + metric.key
        rows.push(
          React.createElement('div', { key: metric.key, style: { ...rowStyle, flexDirection: 'column', gap: '6px' } }, [
            React.createElement('div', { key: 'head', style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', width: '100%' } }, [
              React.createElement('span', { key: 'l', style: { flex: '1 1 auto', minWidth: '0' } }, [
                React.createElement('label', { key: 't', htmlFor: sliderId, style: { ...labelStyle, cursor: 'pointer' } }, metric.label),
                React.createElement('span', { key: 'h', style: hintStyle }, metric.hint),
              ]),
              React.createElement('span', {
                key: 'v',
                style: {
                  flex: '0 0 auto',
                  fontSize: '13px',
                  fontVariantNumeric: 'tabular-nums',
                  color: value > 0 ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-tertiary)',
                },
              }, value > 0 ? `${value}${metric.unit}` : '默认'),
            ]),
            React.createElement('input', {
              key: 's',
              id: sliderId,
              type: 'range',
              min: metric.min,
              max: metric.max,
              step: metric.step,
              value,
              'aria-label': metric.label,
              style: { width: '100%', accentColor: 'var(--dsw-alias-state-business-primary, auto)', cursor: 'pointer' },
              onChange: (event) => {
                const next = Number(event.target.value)
                setMetrics((prev) => ({ ...prev, [metric.key]: Number.isFinite(next) ? next : 0 }))
              },
            }),
          ]),
        )
      }

      /* ---------- 吸底操作栏 ----------
         设置项还会继续增加，操作栏必须始终可见，不能让人滚半天才找到「确认」。
         用 position: sticky + bottom: 0 贴住设置面板可视区底部。

         造型跟「预览」那一块保持一致：圆角 + 细描边 + 面板底色。
         之前是一条通栏加顶部细线，左右两端直抵面板边缘，看着像被切断的横条；
         做成卡片后四个角都是圆的，跟其它块统一。

         背景仍带一点透明度并叠 backdrop-filter：滚动时后面的行会从卡片下
         掠过，纯实色会因为底色差一点点而显出接缝，半透明能把背景色吸收掉。 */
      /* 两层结构：外层负责"吸底 + 自动下压"，内层是视觉上的圆角卡片。
         不能只写一层 —— marginTop:auto（内容短时压到底）与 margin 简写（留间距）
         会互相覆盖，分成两层才两者兼得。 */
      /* ---------- 底部渐隐 + 操作卡片（两层） ----------
         外层负责三件事，都跟"整段过渡"有关：
           1. position: sticky + bottom: 0 —— 贴住设置面板可视区底边；
           2. paddingTop 34px —— 这段高度专门留给渐隐，内容滚到这里逐渐消失；
           3. 自身背景就是那条渐变 —— 从顶部全透明，到面板底色收尾。
         这样渐隐是从**面板最边缘**一路过渡到卡片上方，而不是卡片上缘贴一条窄带；
         卡片落在渐变的不透明段上，边界清晰。

         不能只写一层：marginTop:auto（内容短时压到底）与 margin 简写会互相覆盖。 */
      const footer = React.createElement('div', {
        key: 'actions',
        style: {
          position: 'sticky',
          bottom: 0,
          zIndex: 3,
          flexShrink: 0,
          marginTop: 'auto',
          boxSizing: 'border-box',
          paddingTop: '34px',
          /* 卡片下方的留白：22px → 11px，让框整体下移到原来剩余空隙的一半位置。
             这段高度同时也是底部渐隐的收尾区，所以别设成 0 —— 否则淡出会被截断。 */
          paddingBottom: '11px',
          /* 一条渐变负责整段过渡，两端都淡到透明：
               0%  透明        内容从这里开始被"吃掉"
               ~26% 半实       压在卡片上缘
               ~72% 接近实色   卡片下缘
               100% 透明       底边淡回去，不留硬边
             之前底边停在 96% 就结束，下面没有绘制，于是出现一道清晰水平线。
             颜色全部来自运行时采样的面板底色，浅色/深色/第三方主题都能自动吻合。 */
          background: `linear-gradient(to bottom, transparent 0%, color-mix(in srgb, ${panelColor} 62%, transparent) 26%, color-mix(in srgb, ${panelColor} 96%, transparent) 72%, transparent 100%)`,
        },
      }, React.createElement('div', {
        key: 'card',
        style: {
          boxSizing: 'border-box',
          /* 合并后是竖向：上半预览、下半按钮行 */
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          padding: '12px 14px',
          border: '0.5px solid var(--dsw-alias-border-l2)',
          borderRadius: 'var(--dsw-radius-lg)',
          background: 'color-mix(in srgb, var(--dsw-alias-bg-layer-1) 92%, transparent)',
          backdropFilter: 'var(--dsw-menu-backdrop-filter, blur(20px) saturate(150%))',
          WebkitBackdropFilter: 'var(--dsw-menu-backdrop-filter, blur(20px) saturate(150%))',
        },
      }, [
        /* ---------- 总预览 ----------
           不只是字体：字距 / 行距 / 段距 / 首行缩进全部按**草稿**渲染，
           所以确认前看到的就接近真实效果。
           行高基准与应用一致（24px + 字号增量），再叠加草稿里的行距增量，
           这样"改字号 → 行高跟着变"的关系在预览里也成立。

           高度可拖动、可隐藏：字号和行距调大时预览会顶得很高，
           所以给它一个 maxHeight + 滚动，以及顶层的一条拖动条。 */
        React.createElement('div', {
          key: 'resizer',
          title: '拖动调整预览高度',
          'aria-label': '拖动调整预览高度',
          role: 'separator',
          'aria-orientation': 'horizontal',
          onMouseDown: startPreviewResize,
          style: {
            /* 负边距抵消卡片 padding，让拖动条贴住卡片上缘 */
            margin: '-12px -14px 8px',
            height: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'ns-resize',
            flexShrink: 0,
          },
        }, React.createElement('div', {
          key: 'grip',
          style: {
            width: '36px',
            height: '3px',
            borderRadius: '999px',
            background: 'var(--dsw-alias-border-l3)',
          },
        })),

        React.createElement('div', {
          key: 'previewHead',
          style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
        }, [
          React.createElement('span', {
            key: 'label',
            style: {
              fontSize: '11px',
              lineHeight: '16px',
              letterSpacing: '0.08em',
              color: 'var(--dsw-alias-label-tertiary)',
            },
          }, previewPref.hidden ? '总预览（已隐藏）' : '总预览'),
          React.createElement('button', {
            key: 'toggle',
            type: 'button',
            onClick: () => persistPreviewPref({ ...previewPref, hidden: !previewPref.hidden }),
            style: {
              font: 'inherit',
              fontSize: '11px',
              lineHeight: '16px',
              padding: '0 4px',
              border: 'none',
              background: 'transparent',
              color: 'var(--dsw-alias-label-tertiary)',
              cursor: 'pointer',
            },
          }, previewPref.hidden ? '显示' : '隐藏'),
        ]),

        previewPref.hidden ? null : React.createElement('div', {
          key: 'preview',
          style: {
            display: 'flex',
            flexDirection: 'column',
            /* 超出用户设定的高度就在内部滚动，不再把卡片顶高 */
            maxHeight: `${previewPref.height}px`,
            overflowY: 'auto',
            fontFamily: buildUiStack(draftLatin, draft) || APP_FALLBACK_STACK,
            letterSpacing: metrics.letterSpacing > 0 ? `${metrics.letterSpacing}px` : undefined,
            /* 正文默认字重挂在容器上，段落继承；标题样张单独覆盖 */
            fontWeight: String(previewBodyWeight),
            color: 'var(--dsw-alias-label-primary)',
          },
        }, [
          /* 标题样张：验证「标题字重」。按 h2 的尺寸（19px + 字号增量 / 28px）渲染，
             默认字重 700 —— 与应用 --dsw-font-markdown-h1..h3 一致。
             没有它，「标题字重」在预览里完全没有体现。 */
          React.createElement('div', {
            key: 'heading',
            style: {
              margin: 0,
              marginBottom: '6px',
              fontSize: `${previewHeadingSize}px`,
              lineHeight: `${previewHeadingLineHeight}px`,
              fontWeight: String(previewHeadingWeight),
              color: 'var(--dsw-alias-label-primary)',
            },
          }, '标题示例 Heading'),

          ...previewParagraphs.map((text, index) => React.createElement('p', {
            key: 'p' + index,
            style: {
              margin: 0,
              marginTop: index === 0 ? 0 : `${metrics.paragraphSpacing}px`,
              lineHeight: `${previewLineHeight}px`,
              textIndent: metrics.firstLineIndent > 0 ? `${metrics.firstLineIndent}em` : undefined,
              /* 跟草稿字号走，而不是写死 —— 两段用同一字号，只有颜色区分主次 */
              fontSize: `${previewFontSize}px`,
              color: index === 0 ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
            },
          }, text)),

          /* 代码样张：验证「代码字体 / 代码字号」。
             字距、行距、段距、缩进**不套用** —— 那四项只作用于正文段落（MD p），
             套到代码上会让预览失真。 */
          React.createElement('pre', {
            key: 'code',
            style: {
              margin: 0,
              marginTop: '10px',
              padding: '8px 10px',
              borderRadius: 'var(--dsw-radius-md)',
              background: 'color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent)',
              fontFamily: stackFor(draftCode, APP_CODE_FALLBACK_STACK),
              fontSize: `${previewCodeFontSize}px`,
              lineHeight: `${previewCodeLineHeight}px`,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              color: 'var(--dsw-alias-label-primary)',
            },
          }, previewCodeSample),
        ]),

        /* 按钮行：和预览之间用一条细线分开 */
        React.createElement('div', {
          key: 'actionRow',
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            borderTop: '0.5px solid var(--dsw-alias-border-l2)',
            paddingTop: '10px',
          },
        }, [
        // 左：待应用提示
        React.createElement('span', {
          key: 'hint',
          style: {
            fontSize: '12px',
            lineHeight: '18px',
            minWidth: '0',
            color: hasChanges ? 'var(--dsw-alias-state-warn-primary, #b26a00)' : 'var(--dsw-alias-label-tertiary)',
          },
        }, hasChanges ? '有未应用的改动，点右侧「确认应用」后生效' : '当前已与已保存的设置一致'),

        // 右：恢复默认（只重置草稿）+ 确认应用
        React.createElement('span', { key: 'btns', style: { display: 'flex', gap: '8px', flex: '0 0 auto' } }, [
          React.createElement(
            'button',
            { key: 'reset', type: 'button', style: buttonStyle, onClick: resetDrafts },
            '恢复默认',
          ),
          React.createElement(
            'button',
            {
              key: 'confirm',
              type: 'button',
              disabled: !hasChanges,
              onClick: confirmAll,
              style: {
                ...buttonStyle,
                fontWeight: 600,
                color: hasChanges ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-tertiary)',
                background: hasChanges
                  ? 'var(--dsw-alias-state-business-tertiary, var(--dsw-alias-interactive-bg-hover))'
                  : 'var(--dsw-alias-interactive-bg-hover)',
                borderColor: hasChanges
                  ? 'var(--dsw-alias-state-business-primary, var(--dsw-alias-border-l3))'
                  : 'var(--dsw-alias-border-l3)',
                cursor: hasChanges ? 'pointer' : 'not-allowed',
                opacity: hasChanges ? 1 : 0.6,
              },
            },
            '确认应用',
          ),
        ]),
      ]),
      ]),
      )

      /* 持久化状态条：把"能不能存进去"变成页面上看得见的一行。
         排查写入失败时靠的就是这一行——没有它，写入失败是完全静默的。
         状态来自表单快照的真实 status（ready / loading / unavailable），
         不是"拿到了 form 对象"就算成功（lazy view 永远拿得到）。 */
      const status = snapshot.formStatus
      const statusReady = status === 'settingsScope' || /:(ready|saved)$/.test(status) || status === 'ready' || status === 'saved'
      const statusText = statusReady
        ? (/:saved$/.test(status) ? '已保存到当前 profile ✓' : '设置会保存到当前 profile（跨重启保留）')
        : status === 'pending'
          ? '正在连接设置服务…'
          : /:refused$/.test(status)
            ? '⚠ 宿主拒绝了写入：字段未标 volatile（需重启应用加载新 schema）'
            : /:error$/.test(status)
              ? '⚠ 写入报错（详情见 data-dsh-font-override-errors）'
              : '⚠ 设置服务未就绪，改动只在本次会话生效（诊断：' + status + '）'

      return React.createElement(
        'div',
        {
          className: 'font-probe-settings',
          ref: rootRef,
          style: {
            width: '100%',
            maxWidth: '720px',
            /* 撑满可视高度，短内容时靠 footer 的 margin-top:auto 把操作栏压到底部 */
            minHeight: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          },
        },
        [
          React.createElement('h3', { key: 'h', style: { margin: '0 0 4px', fontSize: '18px', fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } }, '文字显示设置'),
          React.createElement('p', { key: 'i', style: { margin: '0 0 8px', fontSize: '13px', color: 'var(--dsw-alias-label-tertiary)' } }, '字体、字号与排版。改动先作为草稿预览，点底部「确认应用」后生效并写回 profile。'),
          React.createElement(
            'p',
            {
              key: 'status',
              style: {
                margin: '0 0 12px',
                fontSize: '12px',
                lineHeight: '18px',
                color: statusReady ? 'var(--dsw-alias-label-tertiary)' : 'var(--dsw-alias-state-warn-primary, #b26a00)',
              },
            },
            statusText,
          ),
          // 诊断行只在真出问题时出现：正常状态下面板保持干净，
          // 一旦未就绪或有错误就把它摊出来（排查时不用开控制台）。
          (statusReady && snapshot.debugInfo.indexOf('errors=') === -1)
            ? null
            : React.createElement(
                'code',
                {
                  key: 'debug',
                  style: {
                    display: 'block',
                    margin: '0 0 12px',
                    fontSize: '11px',
                    lineHeight: '16px',
                    color: 'var(--dsw-alias-label-tertiary)',
                    fontFamily: 'var(--ds-font-family-code)',
                    wordBreak: 'break-all',
                  },
                },
                '诊断 / ' + status + ' / ' + String(snapshot.debugInfo || ''),
              ),
          ...rows,
          footer,
        ],
      )
    }

    /* ---------- 插件入口 ----------
       实测教训（务必保留这段注释）：
       第一版 `dsh.client.inject` 是空数组、apply 里又无条件把 applied 置 true，
       结果 bundle 在 `slots` 服务安装**之前**就加载了，`ctx.get('slots')` 拿到
       undefined，而 applied 已被置 true 再也不会重试 —— 字体本身不需要任何服务
       所以一直正常，设置页却静默地从未注册（槽位 occupants 里查不到）。
       修法：字体立即应用；槽位注册改为**等 slots 就绪再注册**，而不是指望
       加载顺序（`dsh.client.inject` 的改动还要重启才生效，这个重试不用）。 */
    let registered = false
    let disposed = false
    let disposeSection = null

    /** 两种取法都试：注入属性拼写，再 ctx.get。取不到返回 undefined，不抛。 */
    function getSlots(ctx) {
      try {
        const direct = ctx.slots
        if (direct !== undefined && direct !== null && typeof direct.inject === 'function') return direct
      } catch (error) { /* 服务尚未安装 */ }
      try {
        const viaGet = ctx.get('slots')
        if (viaGet !== undefined && viaGet !== null && typeof viaGet.inject === 'function') return viaGet
      } catch (error) { /* 服务尚未安装 */ }
      return undefined
    }

    function registerSectionWhenReady(ctx, attempt) {
      if (disposed || registered) return

      const slots = getSlots(ctx)
      if (slots === undefined) {
        // 服务还没装好：有界重试（最多 ~30 秒），绝不静默放弃。
        if (attempt < 120) {
          const timer = setTimeout(() => registerSectionWhenReady(ctx, attempt + 1), 250)
          if (timer && typeof timer.unref === 'function') timer.unref()
        } else {
          note('slots', new Error('等待 slots 服务超时；设置页未注册（字体不受影响）'))
        }
        return
      }

      try {
        disposeSection = slots.inject('settings.section', () =>
          slots.register(
            { name: 'settings.section', id: 'font-probe', order: 36, label: '文字显示设置' },
            FontSettingsPage,
          ),
        )
        registered = true
        try { document.documentElement.setAttribute('data-dsh-font-override-section', 'registered') } catch (e) { /* no DOM */ }
      } catch (error) {
        note('slots.inject', error)
      }
    }

    return {
      inject: [],
      apply(ctx) {
        if (disposed) return

        // 字体：不依赖任何服务，立即生效（重复 apply 时也只是幂等重设）。
        applyNow()

        if (!bound) {
          bound = true
          bindFormWhenReady(ctx, 0)

          ctx.effect(() => {
            // 清理时收回本节注册与订阅（effect 回调返回 disposer）
            return () => {
              disposed = true
              bound = false
              if (bindTimer !== null) { try { clearTimeout(bindTimer) } catch (error) { /* no timer */ } }
              bindTimer = null
              try { if (typeof disposeSection === 'function') disposeSection() } catch (error) { /* already gone */ }
              disposeSection = null
              registered = false
              try { if (typeof formUnsubscribe === 'function') formUnsubscribe() } catch (error) { /* already gone */ }
              formUnsubscribe = null
              form = null
              dirty = false
              try { if (typeof sheetDispose === 'function') sheetDispose() } catch (error) { /* already gone */ }
              sheetDispose = null
              if (sheetElement && typeof sheetElement.remove === 'function') {
                try { sheetElement.remove() } catch (error) { /* already gone */ }
              }
              sheetElement = null
              sheetMode = null
            }
          }, 'font-probe: cleanup')
        }

        registerSectionWhenReady(ctx, 0)
      },
    }
  },
})
