# 发布指南

> 这份文档给**维护者**看，普通用户只需要读 [README](../README.md)。

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

## 5. （可选）发布到 npm

```bash
npm login
npm publish
```

`package.json` 里的 `files` 已经把范围限死在插件本身（不含 docs 与截图），
所以打出来的包很小。

发布后用户可以直接：

```bash
dsh plugin --profile desktop add dsh-font-probe
```

> 前提：`repository` / `homepage` / `bugs` 三个字段里的 `<your-name>` 要换成真实用户名，
> 否则 npm 页面上的链接是坏的。

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
