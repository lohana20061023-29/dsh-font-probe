# 发布指南

> 这份文档给**维护者**看，普通用户只需要读 [README](../README.md)。

## 一条硬规矩：README 是对外的

`README.md` 会被所有访客看到，**不要往里面写只有维护者才需要的话**，例如：

- ❌「想换图：覆盖 `docs/settings.png` 即可」
- ❌「记得上传后把占位符换掉」
- ❌「这份说明看完可以删掉」

这类内容一律写进本文件（或 `INTERNALS.md`）。理由是：那些句子在读者眼里是噪音，
而且每次发版都要手动删，很容易忘。

同理，**安装命令里不要留 `<your-name>` 这类占位符** —— 读者复制了会直接失败。
仓库地址固定为：

```
github:lohana20061023-29/dsh-font-probe
```

## 发布到哪里

DSH 没有官方插件市场，`dsh plugin` 只是 pnpm 的薄封装：

```
dsh plugin --profile <name> <pnpm 参数...>
```

所以"能装"的来源只有 pnpm 认识的那几种。社区目录则是**第三方**项目，
靠 GitHub 扫描自动收录。按优先级：

| # | 渠道 | 必需? | 作用 |
|---|---|---|---|
| ① | **GitHub 仓库** | 必须 | 唯一来源。`dsh plugin add github:user/repo` 直接读它 |
| ② | **仓库 topic `dsh-plugin`** | 强烈建议 | 两个社区注册表每 2 小时扫描一次这个 topic，**自动收录** |
| ③ | **npm** | 可选 | 让安装变成一条命令 `dsh plugin add dsh-font-probe`，不依赖 GitHub |
| ④ | 社区目录手动提交 | 可选 | 拿 `curated`（已审核）标记，排名更靠前 |

### ② 为什么加 topic 就够了

社区注册表 `dsh-plugin-registry` 的自动发现逻辑（每 2 小时跑一次）：

1. GitHub 搜索 `topic:dsh-plugin`
2. 读每个仓库根目录的 `package.json`
3. **topic 命中** 且满足以下之一即收录：
   - 有 `dsh.bundle`（`patch` 是相对路径、不含 `..`）← **本项目符合**
   - 有 `dsh.plugin`
   - 名称或简介明显与 DSH 相关

也就是说：**加完 topic，什么都不用做，两小时内会自动出现在目录里。**

### ③ npm 名字已确认可用

`dsh-font-probe` 在 npm 上返回 404，未被占用。
（对比：`dsh-fonttune` 已被占用 —— 那是另一个同类插件。）

## 1. 建仓库

GitHub 新建**空仓库**（不要勾 Add README / .gitignore / license，这些本地都有）。

- **Repository name**：`dsh-font-probe`（与 `package.json` 的 `name` 一致）
- **Description**（直接复制）：

  ```
  DSH 字体插件：中英文字体分设、正文字号与代码字号、字距/行距/段距/首行缩进四根滑块，吸底总预览 + 确认制，配置写回 profile，不动 app.asar。
  ```

- Public

## 2. 上传文件

仓库是空的，推荐网页上传，不需要装 Git：

1. 仓库页点 **uploading an existing file**
2. 把项目目录下的全部文件与 `docs/` 拖进去
3. Commit message 填 `v1.4.1`
4. 提交

清单：

```
.gitignore        CHANGELOG.md      LICENSE           README.md
client.js         cordis.patch.yml  index.js          package.json
docs/capture.ps1  docs/INTERNALS.md docs/PUBLISHING.md docs/settings.png
```

⚠️ 别把 `*.zip` 提交进去（`.gitignore` 已挡），发布包走 Release 附件。

### 或者用 Git

```bash
cd /path/to/dsh-font-probe
git init
git add .
git commit -m "v1.4.1"
git branch -M main
git remote add origin https://github.com/<你的用户名>/dsh-font-probe.git
git push -u origin main
```

## 3. 加 topic（关键，别漏）

仓库页右上 **⚙️ → Topics**，填：

```
dsh-plugin
```

可选再加：`dsh` `deepseek-harness` `font` `typography` `cjk`

**这一步决定了会不会被社区目录发现**，比写多少文档都管用。

## 4. 打 Release

**Releases → Create a new release**

- **Tag**：`v1.4.1`（选 Create new tag on publish）
- **Title**：`v1.4.1`
- **Describe**：贴 `CHANGELOG.md` 里对应那段
- **Attach binaries**：上传 `dsh-font-probe-v1.4.1.zip`

## 5. 分发：tarball 优先，npm 可选

### 5.1 tarball（首选，零门槛）

`pnpm pack` 产出的 `.tgz` 就是 npm 包本体。把它挂到 Release 上，
用户就能**一条命令安装、不需要 git、不需要 npm 账号**：

```bash
dsh plugin --profile desktop add https://github.com/lohana20061023-29/dsh-font-probe/releases/download/v1.5.1/dsh-font-probe-1.5.1.tgz
```

pnpm 支持从远程 URL 装 tarball，这条路径已验证可行。

打包：

```powershell
$node = 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$pnpm = 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.cjs'
cd G:\DSH\_ext\dsh-font-probe
& $node $pnpm pack        # 产出 dsh-font-probe-<version>.tgz
```

然后把 `.tgz` 传到对应 Release 的 Assets 里（和 zip 放一起）。

> 发新版时记得：`pnpm pack` 会生成新的 tgz，**README 里的 URL 版本号要同步改**。

### 5.2 npm（可选）

`dsh plugin --profile desktop add dsh-font-probe`

前提是能注册并使用 npm 账号。**注意**：部分地区访问 npmjs.com 受限，
注册会被拦（`访问暂时受限`）。这种情况不用纠结，tarball 那条已足够。

如果能用，本机没有 npm 也可以借 DSH 自带的 pnpm：

```powershell
$node = 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
$pnpm = 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.cjs'

cd G:\DSH\_ext\dsh-font-probe
& $node $pnpm login                       # 交互式，要自己开终端跑
& $node $pnpm publish --access public --no-git-checks
```

> `--no-git-checks` 是必需的：这个目录不是 git 仓库，pnpm 的分支检查会报错。
> `pnpm login` 是交互式的（要输用户名/密码/OTP），必须由人在终端里操作。

### ⚠️ 首次发布会进"暂存"，要批准才上线

npm 2026 年推的 **staged publishing**：新包第一次发布时**不会直接上线**，而是

1. 先发一个占位版本 `0.0.0-stage`（公开可见，内容只有一句话）
2. 真正的版本进暂存区，**必须由维护者 2FA 批准**才对公众可见

所以 `pnpm publish` 打印 `Published package dsh-font-probe@1.5.2` **不等于已经能用**——
此时 `dsh plugin add dsh-font-probe` 会拉到那个空占位包。

批准方式（推荐网页）：

```
https://www.npmjs.com/settings/~/packages   →  Staged Packages 标签页  →  Approve
```

命令行的对应做法是 `npm stage list` / `npm stage approve <stage-id>`，
但 pnpm 11.7 的 `stage list` 实测列不出条目，**网页更可靠**。

批准后 `dist-tags.latest` 才会从 `0.0.0-stage` 变成真实版本：

```powershell
& $node $pnpm view dsh-font-probe version   # 应显示真实版本号
```

> 那个 `0.0.0-stage` 会永久留在版本列表里，无害。

### 发布前检查（都通过才可以发）

```powershell
# 1. 看会打进包里哪些文件（应当只有 7 个，不含 docs/ 与截图）
& $node $pnpm pack --dry-run

# 2. 空跑一次发布，确认 registry 与版本号
& $node $pnpm publish --dry-run --access public --no-git-checks
```

期望的包内清单：

```
CHANGELOG.md  client.js  cordis.patch.yml  index.js  LICENSE  package.json  README.md
```

这是 `package.json` 的 `files` 白名单决定的 —— **docs/ 和截图不会进包**，所以 npm 包只有几十 KB。

### 发布后验证

```powershell
& $node $pnpm view dsh-font-probe version
```

## 6. （可选）手动提交到社区目录

- **dsplugin.app**（`vbarter/dsh-plugin-registry`）
  打开站点的 publish 页，输入 `owner/repo` 先跑预检，再提交 Issue；
  Actions 预检 → 开 PR → 维护者合并后数据更新。合并后标记为 `curated`。
- **DSH Plugin Marketplace**（`YELEBAI/dsh-plugin-marketplace`）
  同样自动扫 `topic:dsh-plugin`，但只展示**通过验证**的插件；
  会检查 manifest、bundle patch、loader entry、安装来源。
- **awesome-deepseek-harness**（`0xsline/awesome-deepseek-harness`）
  按 `contributing.md` 提 PR 加一行。

> 三个都是**第三方社区项目**，收录规则随时可能变，以其仓库说明为准。
> 加 topic 之后前两个大概率会自动收录，不必急着手动提交。

## 7. 装给自己 / 别人

```bash
# GitHub 来源
dsh plugin --profile desktop add github:<用户名>/dsh-font-probe

# npm 来源（若已发布）
dsh plugin --profile desktop add dsh-font-probe

# 本地目录（开发时）
dsh plugin --profile desktop add G:/path/to/dsh-font-probe
```

装完**重启应用**（托盘右键 → 退出应用 → 重新打开）。

## 8. 之后每次更新

1. 改代码 → 跑测试 → 升 `package.json` 的 `version`
2. `CHANGELOG.md` 顶部加一条
3. commit & push
4. 发新 Release，附上新 zip
5. 若发布了 npm：`npm publish`

> 记住：**新增配置字段的版本必须让用户重启一次**。
> 插件是双半体，热更新只推 client，宿主读不到新 schema，写入会被静默拒绝。

## 9. 更新截图

先打开 DSH 设置页并停在你想要的样子，然后：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File docs/capture.ps1
```

它用 `PrintWindow` 抓 DSH 窗口再按矩形裁剪，不需要浏览器调试接口。
窗口尺寸变了就改脚本里的 `-Crop`（相对窗口左上角的 x,y,w,h）。
