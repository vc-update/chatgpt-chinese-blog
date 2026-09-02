import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docsDir = path.join(root, 'docs')
const publicDir = path.join(docsDir, 'public')
const distDir = path.join(docsDir, '.vitepress', 'dist')
const siteUrl = 'https://chatgpt-chinese.blog'
const siteName = 'ChatGPT 中文指南'

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['public', 'scripts', 'node_modules'].includes(entry.name)) continue
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file, files)
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(file)
  }
  return files
}

function frontmatter(source) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/)
  const data = {}
  if (!match) return data
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (field) data[field[1]] = field[2].trim().replace(/^['"]|['"]$/g, '')
  }
  return data
}

function routeFor(file) {
  const relative = path.relative(docsDir, file).replace(/\\/g, '/')
  return `/${relative.replace(/(^|\/)index\.md$/i, '$1').replace(/\.md$/i, '')}`.replace(/\/$/, '') || '/'
}

function dateFor(article) {
  const candidate = article.updated || article.date || '1970-01-01'
  const parsed = new Date(candidate)
  return Number.isNaN(parsed.getTime()) ? '1970-01-01' : parsed.toISOString().slice(0, 10)
}

function isArticle(file, route) {
  return route !== '/' && route !== '/latest' && route !== '/blog' &&
    path.basename(file).toLowerCase() !== 'index.md' &&
    !['/about', '/privacy', '/disclaimer'].includes(route)
}

function isIndexable(entry) {
  return entry.route !== '/404' && entry.route !== '/latest' && !/\bnoindex\b/i.test(entry.robots || '')
}

const entries = walk(docsDir).map((file) => {
  const source = fs.readFileSync(file, 'utf8')
  const fm = frontmatter(source)
  const route = routeFor(file)
  return {
    file,
    route,
    title: fm.title || route.split('/').pop() || siteName,
    description: fm.description || '',
    robots: fm.robots || '',
    date: dateFor(fm),
    article: isArticle(file, route),
  }
})

const articles = entries
  .filter((entry) => entry.article)
  .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'zh-CN'))

const blogIndex = `---\ntitle: 文章目录\ndescription: ChatGPT 中文指南全部公开文章，按主题和更新时间整理。\nrobots: index,follow\n---\n\n# 文章目录\n\n这里汇总本站已经发布的 ChatGPT 官网、中文版、网页版、功能、Prompt、Codex、API 和多模型教程。每篇文章只服务一个清晰问题；遇到入口、模型和政策变化时，请优先查看文章中的官方来源。\n\n${articles.map((entry) => `- **${entry.date}** · [${entry.title}](${entry.route})${entry.description ? `：${entry.description}` : ''}`).join('\n')}\n`
write(path.join(docsDir, 'blog', 'index.md'), blogIndex)

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

const latestRows = articles.slice(0, 40).map((entry) =>
  `- **${entry.date}** · [${entry.title}](${entry.route})${entry.description ? `：${entry.description}` : ''}`,
)

write(
  path.join(docsDir, 'latest', 'index.md'),
  `---\ntitle: 最新更新\ndescription: ChatGPT 中文指南最近修订的文章，按更新时间整理。\nrobots: noindex,follow\n---\n\n# 最新更新\n\n这里按文章的实际修订日期倒序列出本站最近更新的内容。更新时间只表示本站内容修订时间，不代表相关产品一定在同一天发生变化；涉及账号、模型、价格和地区可用性时，请回到文章中的官方来源核对。\n\n${latestRows.join('\n')}\n`,
)

const llms = [
  `# ${siteName}`,
  '',
  '> 独立中文 ChatGPT 教程与资料整理站；不代表 OpenAI、Anthropic、Google 或 xAI 官方立场。',
  '',
  '## 核心入口',
  `- [ChatGPT官网入口与中文版使用指南](${siteUrl}/chatgpt/official-entry-chinese-guide-2026): 核对官方域名、中文页面、国内访问边界与第三方平台区别。`,
  `- [ChatGPT网页版在线使用教程](${siteUrl}/chatgpt/web-online-use-guide-2026): 电脑和手机浏览器入口、登录、文件处理与常见故障。`,
  `- [ChatGPT注册登录与验证排查](${siteUrl}/chatgpt/register-login-guide-2026): 邮箱验证、登录循环、账号安全与故障定位。`,
  '',
  '## 主题栏目',
  `- [ChatGPT栏目](${siteUrl}/chatgpt/): 官网、中文版、网页版、功能与安全。`,
  `- [使用教程](${siteUrl}/guides/): Prompt、图片生成与日常任务。`,
  `- [开发者栏目](${siteUrl}/developer/): Codex、API Key 与开发安全。`,
  `- [模型与对比](${siteUrl}/models/): ChatGPT、Claude、Gemini、Grok 的任务选择。`,
  '',
  '## 文章索引',
  ...articles.map((entry) => `- [${entry.title}](${siteUrl}${entry.route})`),
  '',
  '## 内容边界',
  '- 文章中的官方链接用于事实核对；第三方服务会单独标注，不等同于官方入口。',
  '- 本站不要求读者提交密码、验证码、API Key、银行卡或身份证信息。',
].join('\n') + '\n'
write(path.join(publicDir, 'llms.txt'), llms)

const sitemapUrls = entries
  .filter(isIndexable)
  .map((entry) => `${siteUrl}${entry.route === '/' ? '/' : entry.route}`)
  .filter((url, index, all) => all.indexOf(url) === index)
const sitemapText = `${sitemapUrls.join('\n')}\n`
write(path.join(publicDir, 'sitemap.txt'), sitemapText)

const sitemapHtml = `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${siteName}站点地图</title><meta name="description" content="${siteName}公开页面索引，提供 XML 站点地图和文章页面入口。"><link rel="canonical" href="${siteUrl}/sitemap.html"><meta name="robots" content="index,follow"></head><body><main><h1>${siteName}站点地图</h1><p>以下为本站公开页面索引，XML 版本请访问 <a href="/sitemap.xml">/sitemap.xml</a>。</p><ul>${sitemapUrls.map((url) => `<li><a href="${url}">${url}</a></li>`).join('')}</ul></main></body></html>\n`
write(path.join(publicDir, 'sitemap.html'), sitemapHtml)

write(
  path.join(publicDir, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /404\nDisallow: /404.html\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
)

if (process.argv.includes('--post-build') && fs.existsSync(distDir)) {
  for (const name of ['llms.txt', 'sitemap.txt', 'sitemap.html', 'robots.txt']) {
    fs.copyFileSync(path.join(publicDir, name), path.join(distDir, name))
  }
}

console.log(`Synced ${articles.length} articles, ${sitemapUrls.length} public routes and latest discovery.`)
