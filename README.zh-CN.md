<p align="center">
  <img src="assets/icon.png" width="96" alt="GStars logo">
</p>

<h1 align="center">GStars</h1>

<p align="center">
  用自然语言检索任意 GitHub 用户的 star 仓库。
  <br>
  <a href="README.md">English</a> | 简体中文
</p>

---

GStars 在任意 GitHub 用户的 **Stars** 页面顶部加一个搜索框。输入你想找的东西，中文、英文或混着写都行，比如 `claude code 节约token skills`，它会从这个用户 star 过的全部仓库里找出相关的。

- **自然语言检索**：先用本地关键词索引召回，再用 TypeSafe 的 [Jev](https://docs.typesafe.ai) 决策模型按相关度重排。
- **适用于任何用户**：打开 `github.com/{user}?tab=stars` 或 `github.com/stars/{user}` 即可。
- **数据在本地**：star 列表、README 和搜索索引都存在浏览器的 IndexedDB 里，没有后端服务。
- **同步快**：README 通过 GraphQL 批量获取，1500 个仓库约 35 秒同步完；之后每 5 分钟静默做一次增量检查。
- **不用生成式 AI**：不翻译、不总结、不生成文字，Jev 只用来给相关度打分。

## 安装

- **Chrome 应用商店**：即将上架
- **Firefox 附加组件**：即将上架
- **从源码安装**：按下方[开发](#开发)构建后，在 `chrome://extensions` 打开开发者模式，加载 `.output/chrome-mv3` 目录。

## 配置

需要在设置页填两个 key，它们只保存在你的浏览器里：

| Key | 申请地址 | 说明 |
| --- | --- | --- |
| GitHub token | [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens) | 不需要勾选任何权限，只用来提高 API 限流额度 |
| Jev key | [console.typesafe.ai/keys](https://console.typesafe.ai/keys) | 用于相关度打分，由 TypeSafe 按请求计费 |

在设置页点"测试连接"可以检查两个 key 是否可用。

## 使用

1. 点工具栏图标，输入 GitHub 用户名并确认。GStars 会开始同步，并打开这个用户的 Stars 页。也可以直接打开任意 Stars 页。
2. 同步进度显示在搜索框的边框上，同步完成后才能搜索。
3. 输入查询后按 <kbd>Enter</kbd>。关键词匹配结果会立即出现，打完分后替换成按相关度排序的列表，第一名右上角显示 👍。
4. 用 <kbd>↑</kbd> / <kbd>↓</kbd> 选中结果，按 <kbd>Enter</kbd> 打开。🔀 按钮会用这个用户自己仓库的 topic 拼一句示例查询。

设置页还可以切换界面语言、调整最低相关度和并发数。

## 工作原理

```text
github.com Stars 页 ──（长连接消息）──▶ background service worker
  content script：面板界面                ├─ 同步：GitHub REST + GraphQL → IndexedDB
                                         ├─ 关键词召回：MiniSearch（中文二元组分词）
                                         └─ 重排：Jev 打分（按查询缓存）
```

- 所有网络请求都由 background 发出，content script 不直接调用任何外部 API。
- 仓库数不超过 `FULL_SCAN_LIMIT`（默认 1500）时全部打分，否则只给关键词召回的前 200 个打分。
- 分数按"查询 + README 版本 + 题目版本"缓存，重复搜索同一句话不会再次计费。
- stars 数、更新时间等数值信号都在代码里处理，不交给 Jev。

## 隐私

GStars 没有服务器，也不收集任何统计数据。你的查询和候选仓库的公开信息会发给 TypeSafe 打分，详见 [PRIVACY.md](PRIVACY.md)。

## 开发

需要 Node.js 20+ 和 pnpm。

```bash
pnpm install
pnpm dev              # Chrome 开发模式，改代码自动重载
pnpm dev:firefox
pnpm test             # 单元测试（Vitest）
pnpm compile          # 类型检查
pnpm build            # → .output/chrome-mv3
pnpm build:firefox    # → .output/firefox-mv2
pnpm zip && pnpm zip:firefox   # 打包上架用的 zip
```

### 目录结构

```text
entrypoints/
  background.ts        网络请求、同步与搜索调度
  stars.content.ts     向 Stars 页注入面板（兼容 Turbo 站内跳转）
  popup/  options/     工具栏弹窗与设置页
lib/
  core/                纯函数（不依赖浏览器 API）：分词、README 清洗、排序、
                       Jev 题目模板、设置校验等
  ui/                  面板（Shadow DOM）、同步进度、动画、样式
  github.ts jev.ts     API 客户端
  sync.ts search.ts    可续跑的同步；召回 → 打分 → 排序
  db.ts index.ts       Dexie 表结构；MiniSearch 索引持久化
assets/                源图片（图标原图、构建时内联的 SVG 图标）
public/                原样复制进扩展包的文件：工具栏图标、_locales
tests/                 lib/core 的单元测试
evals/                 离线相关度评测（recall@10、MRR）
```

### 相关度评测

`evals/queries.yaml` 是人工标注的查询。评测在 Node 下运行，复用 `lib/core` 的逻辑：

```bash
GITHUB_TOKEN=... JEV_API_KEY=... pnpm eval
```

修改 Jev 题目措辞（同时递增 `QUESTION_VERSION`）、`MIN_SCORE` 或 README 截断长度后都要重跑。

## 许可证

[MIT](LICENSE) © DracoYan-111
