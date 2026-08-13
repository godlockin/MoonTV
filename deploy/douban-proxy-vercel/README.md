# 豆瓣代理 (Vercel Serverless Function)

MoonTV 部署在 Cloudflare Pages 时，CF Workers 的出口 IP 段被豆瓣封禁，导致 `/api/douban/*` 全部失败（首页分类、Top250 无数据）。

本目录是一个**独立的 Vercel 项目**，部署后作为豆瓣代理，MoonTV 服务端经由它访问豆瓣。

> 使用 **Node.js runtime**（非 Edge）—— Vercel 已禁止匿名部署使用 Edge runtime。

## 部署方式（二选一）

### 方式 A：Vercel CLI（最快）

```bash
cd deploy/douban-proxy-vercel
npx vercel --prod
```

首次会提示登录 + 创建项目，一路回车即可（框架选 **Other**）。

### 方式 B：Vercel 网页导入

由于本目录在 MoonTV 仓库内，网页导入需要指定根目录：

1. 打开 [vercel.com/new](https://vercel.com/new) → 导入 MoonTV 仓库
2. **Root Directory** 填 `deploy/douban-proxy-vercel`
3. Framework Preset 选 **Other**，其余留空
4. Deploy

> 注意：这会创建**第二个** Vercel 项目（跟 MoonTV 主站分开），互不影响。

## 配置 MoonTV

部署完成后拿到地址（形如 `https://douban-proxy-xxx.vercel.app`），在
**Cloudflare Pages → Settings → Environment variables** 添加：

```
DOUBAN_SERVER_PROXY = https://douban-proxy-xxx.vercel.app/?url=
```

末尾的 `?url=` 必须保留——MoonTV 会拼接 `encodeURIComponent(目标URL)`。

也可同时配 `NEXT_PUBLIC_DOUBAN_PROXY`（同样格式）让浏览器端也走代理。

配好后 **Retry deployment** 使环境变量生效。

## 验证

```bash
# 健康检查
curl https://douban-proxy-xxx.vercel.app/health
# → {"ok":true,"service":"douban-proxy","platform":"vercel-node",...}

# 实际取豆瓣数据（应返回含 items 的 JSON）
curl "https://douban-proxy-xxx.vercel.app/?url=$(python3 -c "
import urllib.parse
print(urllib.parse.quote('https://m.douban.com/rexxar/api/v2/subject/recent_hot/tv?start=0&limit=20&category=show&type=show', safe=''))
")"
```

已在真实 Vercel 部署上验证通过（2026-08-13）：豆瓣三类接口分别返回 20 / 20 / 16 条数据，
说明 Vercel 出口 IP 未被豆瓣封禁；SSRF 拦截与参数校验线上行为与预期一致。

## 安全说明

- 白名单仅允许 `douban.com` / `doubanio.com` 及其子域
- 用 `host === allowed || host.endsWith('.' + allowed)` 校验，**拒绝** `douban.com.evil.com` 这类后缀伪造
- 内网地址、云元数据端点（如 `169.254.169.254`）一律拒绝
- 仅接受 GET，不转发请求体和 Cookie

不会成为开放代理。

## 未配置代理时的行为

MoonTV 的豆瓣接口会优雅降级：返回 `200 + 空列表 + 提示文案`，页面不报错，只是没有豆瓣推荐数据。搜索和播放功能不受影响。
