# saas-demos

几个演示网站。A：小型企业"防 Zapier 刺客"自动化工具； B：自由职业者"一键收款 + 追款"工具；C：替代 Calendly 的"关系友好型"预约工具。

## 产品列表

三个买断制 SaaS 演示站点，纯静态前端（HTML + CSS + 原生 JS），无构建步骤，无后端，数据存浏览器 localStorage。

| 产品 | 目录 | 定位 | 一句话 |
|------|------|------|--------|
| **Dunner**（方向 B） | 根目录 | 自由职业者发票工具 | 一键发发票 + 0/7/14 天自动催款 + 发发票时锁死汇率。$99 买断 |
| **Tenflow**（方向 A） | `tenflow/` | 小型企业自动化工具 | 按"工作流数量"计费而非"任务次数"，打 Zapier 任务刺客。$149 买断 |
| **Warmly**（方向 C） | `warmly/` | 替代 Calendly 的预约工具 | "人味"预约页（照片 + 自我介绍 + 留言框）+ 客户自助改期。$29 买断 5 席位 |

汇总入口：`lab.html`（三产品对比页）。

## 在线访问

已部署在 Cloudflare Pages（git push 后手动 `wrangler pages deploy` 更新，见下文）：

- 线上地址：`https://saas-demos.pages.dev/`
  - `/` — Dunner 落地页
  - `/app.html` — Dunner 工作区
  - `/tenflow/` — Tenflow
  - `/warmly/` — Warmly
  - `/lab.html` — 三产品汇总页

## 本地运行

无需安装依赖，两种打开方式任选：

```bash
# 方式 1：直接双击 index.html（最简单）

# 方式 2：python 起个静态服务器（推荐，相对路径都正常）
cd saas-demos-source
python -m http.server 8000
# 打开 http://localhost:8000
```

## 目录结构

```
saas-demos/
├── index.html          # Dunner 落地页（$99 买断定价）
├── app.html            # Dunner 工作区（发票/催款/收钱三屏）
├── pay.html            # Dunner 演示收银台（Stripe 风格，不真扣款）
├── lab.html            # 三产品汇总入口
├── css/main.css        # 共享样式
├── js/
│   ├── app.js          # Dunner 工作区逻辑
│   ├── io.js           # 导入/导出（JSON/CSV/XML/YAML/Markdown/Excel）
│   └── pay.js          # 演示收银台逻辑
├── tenflow/            # 方向 A：自动化演示站
├── warmly/             # 方向 C：预约演示站
├── sitemap.xml         # SEO：7 个页面
└── robots.txt          # SEO：允许抓取 + 指向 sitemap
```

## 外部依赖

仅 2 个，均无需 key：

- Google Fonts（Figtree / Fraunces / IBM Plex 等，CDN 字体）
- `open.er-api.com` 公开汇率 API（Dunner 汇率锁定演示用，浏览器直连）

数据全部存 `localStorage`，不上传服务器。

## 部署（Cloudflare Pages）

仓库当前为静态站，Cloudflare Pages 通过 wrangler CLI 手动部署（改完代码跑一次即可）：

```powershell
# 前置：npm install -g wrangler，并在 Cloudflare 生成 Edit Workers 的 API token
$env:CLOUDFLARE_API_TOKEN = "你的token"

# 创建项目（首次）
wrangler pages project create saas-demos --production-branch main

# 部署（每次改完代码后）
wrangler pages deploy . --project-name saas-demos
```

- 部署后秒级生效，旧版本在 Cloudflare 控制台 → 项目 → Deployments 可回滚
- 控制台地址：https://dash.cloudflare.com → Workers & Pages → saas-demos

## 已知限制（演示版特性）

- 收银台是演示，不接真实 Stripe 收款
- 发票/工作流数据只存浏览器本地，换浏览器数据不迁移
- 无用户登录/无后端，多端不同步

## 相关文档

- 用户痛点调研报告：`../user-pain-research-report.md`
- 三方向选型：`../saas-tool-directions.md`
- 冷启动发布物料（PH/Reddit/X）：`../cold-start-launch-kit.md`
