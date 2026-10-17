# 实现笔记 / Internals

这份文档记录**为什么代码长成现在这样**，尤其是那些踩过一次就不想再踩的坑。
面向想改这个插件、或者照着它写别的 DSH 客户端插件的人。

---

## 结构

```
dsh-font-probe/
├── package.json        # dsh.client（客户端声明）+ dsh.bundle.patch（插入 bundles）
├── cordis.patch.yml    # - insert: [{ id: font-probe, name: dsh-font-probe }]
├── index.js            # host 半体：导出 apply / Config / SETTINGS_ENTRY / FIELD_DEFAULTS
└── client.js           # client 半体：设置页、样式注入、诊断属性
```

两个半体：

- **host**（`index.js`）只负责**声明配置 schema**，让宿主的设置服务知道有哪些可写字段；
- **client**（`client.js`）负责**界面与样式**，通过 `window.__ModuleLoader__.load({ id, factory })` 注册。

`package.json` 的 `exports` 必须同时暴露两者：

```json
"exports": { ".": "./index.js", "./client": "./client.js" }
```

`dsh.client` 里的 bundle id 必须与**包名**一致，`<id>/client` 与裸 id 解析到同一个模块。

---

## 七条踩坑记录

### 1. host 半体必须是 ESM，且真的导出 `apply`

第一版 host 写成了 CommonJS。表现极具误导性：设置行**挂载不上**，
而 `dsh-app-boot` 报的是 `"failed to import"` —— 看起来像路径错或语法错。

真实原因是 `fiber === undefined`（没有 `apply` 可调用），而加载器的 `_init()` 里：

```js
catch (error) { this.ctx.logger.error(error); return }
```

**把真正的异常吞掉了**。所以排这种"行列不出来"的问题，先确认 `apply` 存在，
再去怀疑路径。

修法：`"type": "module"` + `export function apply() {}`。

### 2. 配置字段必须 `.volatile()` 才可写

`@deepseek-ai/dsh-settings` 的 `write()` 开头就是：

```js
const form = volatileForm(schema)
if (form === void 0) throw new Error(`Plugin entry "${ns}" has no volatile fields`)
```

之后每个字段路径还要过 `isVolatilePath(schema, path)`。
也就是说**只有 `meta.volatile` 为真的字段能经这条路径写盘**。

普通 `z.string()` 不可写。症状：界面能改、字体立即生效，
但 profile 的 `cordis.patch.yml` 永远不更新，而且错误被 remote 层吞掉，
**前端一句报错都看不到**。

> ⚠️ 验证时不要用 `Config.toJSON()` —— 它返回 `{ uid, refs }`，
> meta 已被剥掉，`[].every(...)` 会**空真通过**。
> 要查就查活的 `Config.dict.<field>.meta.volatile === true`。

### 3. `configForms.get()` 对**任何**命名空间都返回惰性视图

它不会告诉你"这个 namespace 不存在"，永远给你一个对象。
所以"拿到了 form 对象"根本不代表成功 —— 必须看快照的 `status`。

`status` 是 `ready` 才绑定，否则返回 `null` 等下一轮重试。
错误地绑到 `include:<id>`（而不是 `<id>`）会导致**永久 `unavailable`**，
诊断行会显示 `include:unavailable` 紧挨着 `served=…font-probe`。

### 4. `ConfigFormController.set` 收的是**单个字段名**

`set(payload)` 传一个对象进去不会报错，但也不会生效。
要一次写多个字段用 `mutate(ops)`。

### 5. 服务可能晚到，别"第一次没拿到就放弃"

最初的 `apply` 里无条件设了 `applied = true`，
结果第一次 retry 时 `slots` 还没就绪，拿到 `undefined` 之后**再也不重试**，
设置分区永远不出现。

修法：有界重试 + 在 `dsh.client.inject` 里声明依赖的服务。

### 6. 不要在自己声明某个令牌的规则里引用它自己

```css
/* ❌ 自引用，整条声明判无效 */
--dsw-font-family: var(--dsw-font-family), "Noto Sans SC";
```

要兜底就把应用自带的字体栈**抄成字面量**。

同理，不要在 `:root` 里无条件重声明 `--dsw-font-family` ——
那会盖掉第三方主题（比如 `dsh-theme-endfield`）对挂件字体的设置。
本插件的策略是**留空即不覆盖**，什么都不配时对界面零影响。

### 7. 把"界面显示 / 实际生效 / 已落盘"三层分开

调试这类插件时这三件事经常不一致：

| 层 | 怎么看 |
|---|---|
| 控件显示什么 | 页面上输入框的 value |
| 界面真的变了没 | `<html>` 上 `--dsw-font-family` 的计算值 |
| 配置存下来没 | profile 的 `cordis.patch.yml` |

踩过的具体案例：`useState(snapshot.fontFamily)` 的初始值只在挂载时取一次，
宿主值晚到后输入框一直显示旧字体 —— **界面看着是对的，控件却是错的**。
修法是让草稿跟随快照同步（`syncedFrom !== snapshot.x` 就重置）。

同理，`dirty` 必须真的被设上，否则下一次 sync 会用宿主值覆盖用户正在编辑的草稿。

---

## 草稿 → 确认模型

所有控件只改**本地草稿**，界面、CSS 变量、profile 三者都不动。
点「确认应用」才一次性：

1. 合成字体栈 → 更新运行时状态
2. 重写注入的样式表（只此一份，绝不堆叠）
3. `mutate()` 把字段写回 profile

`hasChanges` 决定确认按钮的可用状态。
「恢复默认」只重置草稿，同样需要确认才生效 —— 否则它会变成一个"绕过确认的写入"。

字号字段写入前过一遍 `pxOrEmpty()`：只接受正的十进制数，其它一律存空，
避免 `fontSize: "abc"` 这种解析不了的值进 profile。

---

## 为什么排版只作用于 `[class*="_markdown"]`

应用的正文渲染在 `<div class="<hash>_markdown">` 里
（`@deepseek-ai/dsh-client-ui-primitives` 的 Markdown 组件）。
CSS Module 的类名是「哈希 + `_` + 局部名」，所以按 `_markdown` 后缀匹配
可以跨版本命中，又不会误伤别处。

**刻意没有用全局 `p` 选择器** —— 那会把插件自己的说明文字也缩进，很怪。

`data-markdown-variant` 只在 compact 变体出现，做不了通用钩子。

---

## 为什么行距是叠加而不是替换

应用算行高的方式是 `calc(24px + var(--dsh-content-font-delta))`，
其中 delta 由正文字号决定。所以：

```css
line-height: calc(24px + var(--dsh-content-font-delta, 0px) + <增量>px) !important;
```

改字号时行高仍等比变化，增量再叠上去。
直接写死 `line-height: 28px` 的话，改字号就脱节了。

## 为什么代码字号不用令牌

正文字号有 `--dsh-content-font-size` 可用；**代码字号没有对应令牌** ——
应用把代码块的尺寸写死在各自规则里（形如 `font: 400 11px/16px var(--ds-font-family-code)` 的简写），
没法用变量覆盖。只能直接压语义标签：

```css
pre, pre code, code, kbd, samp { font-size: … !important; }
```

`pre` / `code` / `kbd` / `samp` 本来就是"代码"语义，改它们不会波及普通正文。

---

## 长字体名的横向滑动

原生 `<select>` 只能截断，无法动画，所以中文字体那一格是自绘的触发按钮：

1. 名字放在 `overflow:hidden` + `white-space:nowrap` 的容器里；
2. 渲染后实测 `scrollWidth - clientWidth`，把溢出像素写进 `--fp-marquee-x`；
3. **只有真的溢出（> 2px）**才挂 `animation`。

```css
@keyframes fp-marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(var(--fp-marquee-x, 0px)); }
}
```

`alternate` 让它在两端往返，而不是跳回起点。
测量用的是**无依赖数组的 `useEffect`**（每次渲染后重测）：换字体、换主题、
改窗口宽度都会自动跟上；值没变时 `setState` 会被 React 短路，不会成环。

---

## 两个半体的更新方式

| 改了什么 | 怎么生效 |
|---|---|
| `client.js` | client-hmr 轮询文件 mtime（约 500ms），自动推送，**刷新即可** |
| `index.js` / `package.json` | **必须重启应用**（ESM 按 URL 缓存，热更换不掉 host） |

所以**新增配置字段后要重启一次**才能写入 —— 否则宿主旧 schema 里没有该字段，
写入会被拒绝，而且是静默的。

---

## 界面细节备忘

- 吸底操作栏用 `position: sticky; bottom: 0`，外层背景是一条**两端都淡到透明**的渐变。
  曾经让渐变在底边停在 96% 就结束，结果出现一道清晰的水平分界 —— 因为容器下面没有绘制，
  颜色从 96% 突然掉到 0。
- 渐变颜色不是猜令牌，而是**运行时采样**：从设置段往上走，取第一个真正有底色的祖先的
  `backgroundColor`。这样深浅色主题、第三方主题都能自动吻合。
- 字体列表容器是 `max-height` 的列向 flex，子项默认 `flex-shrink: 1` 会被压扁
  （内容溢出、边框穿字）。必须给每项 `flexShrink: 0`。
