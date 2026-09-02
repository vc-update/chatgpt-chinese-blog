import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitepress'

const SITE_URL = 'https://chatgpt-chinese.blog'
const SITE_NAME = 'ChatGPT 中文指南'
const HOME_TITLE = 'ChatGPT官网入口 | ChatGPT中文版 | ChatGPT网页版使用指南'
const DEFAULT_DESCRIPTION =
  '独立中文 ChatGPT 教程站，整理官网入口、ChatGPT 中文版、网页版在线使用、注册登录、文件图片、Prompt、Codex 与账号安全。'
const DEFAULT_IMAGE = '/hero-ai-blog.png'
const EXCLUDED_SITEMAP_PATHS = new Set(['/latest'])
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function normalizeRoute(relativePath = 'index.md') {
  return relativePath
    .replace(/\\/g, '/')
    .replace(/(^|\/)index\.md$/i, '$1')
    .replace(/\.md$/i, '')
    .replace(/^\/+|\/+$/g, '')
}

function pageUrl(relativePath = 'index.md') {
  const route = normalizeRoute(relativePath)
  return route ? `${SITE_URL}/${route}` : `${SITE_URL}/`
}

function isoDate(value: unknown) {
  if (!value) return undefined
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function displayDate(value: unknown) {
  return isoDate(value)?.slice(0, 10) || ''
}

function parseFrontmatter(source: string) {
  const match = source.match(/^---\s*\n([\s\S]*?)\n---/)
  const data: Record<string, string> = {}
  if (!match) return data

  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (field) data[field[1]] = field[2].trim().replace(/^['"]|['"]$/g, '')
  }

  return data
}

function sidebarArticles(prefix: string) {
  const categoryNames: Record<string, string> = {
    core: '官网入口与基础使用',
    feature: '功能与安全',
    guide: '实用教程',
    developer: '开发者与 API',
    model: '模型与选择',
  }
  const groups = new Map<string, Array<{ text: string; link: string; date: string }>>()

  for (const file of collectMarkdownFiles(ROOT_DIR)) {
    const relative = path.relative(ROOT_DIR, file).replace(/\\/g, '/')
    const route = `/${normalizeRoute(relative)}`
    if (!route.startsWith(prefix) || route.endsWith('/') || path.basename(file).toLowerCase() === 'index.md') continue
    if (['/privacy', '/disclaimer', '/about'].includes(route)) continue

    const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    const category = categoryNames[fm.category || 'guide'] || fm.category || '实用教程'
    const item = { text: fm.title || path.basename(file, '.md'), link: route, date: displayDate(fm.updated || fm.date) }
    if (!groups.has(category)) groups.set(category, [])
    groups.get(category)?.push(item)
  }

  return Object.entries(categoryNames)
    .map(([category, text]) => [text, groups.get(text) || groups.get(category) || []] as const)
    .filter(([, items]) => items.length)
    .map(([text, items]) => ({
      text,
      collapsed: false,
      items: items
        .sort((a, b) => b.date.localeCompare(a.date) || a.text.localeCompare(b.text, 'zh-CN'))
        .map(({ text: itemText, link }) => ({ text: itemText, link })),
    }))
    .filter((group) => group.items.length)
}

function collectMarkdownFiles(dir: string, files: string[] = []) {
  if (!fs.existsSync(dir)) return files

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['public', 'scripts', 'node_modules'].includes(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) collectMarkdownFiles(fullPath, files)
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath)
  }

  return files
}

function pageMetaByPath() {
  const meta: Record<string, { lastmod?: string; priority: number; changefreq: string }> = {}

  for (const file of collectMarkdownFiles(ROOT_DIR)) {
    const relativePath = path.relative(ROOT_DIR, file).replace(/\\/g, '/')
    const route = normalizeRoute(relativePath)
    const sitemapPath = route ? `/${route}` : '/'
    const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'))
    const isHome = sitemapPath === '/'
    const isIndex = sitemapPath.endsWith('/') || /^\/(?:chatgpt|guides|developer|models|blog|latest)$/.test(sitemapPath)
    const isArticle = /\/(?:chatgpt|guides|developer|models|blog)\/.+/.test(`${sitemapPath}/`)

    meta[sitemapPath] = {
      lastmod: isoDate(fm.updated || fm.date),
      priority: isHome ? 1 : isIndex ? 0.85 : isArticle ? 0.65 : 0.5,
      changefreq: isHome || isIndex ? 'weekly' : 'monthly',
    }
  }

  return meta
}

function absoluteAsset(value: string) {
  if (/^https?:\/\//i.test(value)) return value
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`
}

export default defineConfig({
  title: HOME_TITLE,
  titleTemplate: false,
  description: DEFAULT_DESCRIPTION,
  lang: 'zh-CN',
  cleanUrls: true,
  lastUpdated: false,

  markdown: {
    lineNumbers: false,
  },

  head: [
    ['meta', { name: 'theme-color', content: '#0f766e' }],
    ['meta', { name: 'format-detection', content: 'telephone=no' }],
    ['meta', { 'http-equiv': 'content-language', content: 'zh-CN' }],
    ['meta', { name: 'keywords', content: 'ChatGPT,ChatGPT官网,ChatGPT中文版,ChatGPT网页版,ChatGPT教程,OpenAI,Codex' }],
    ['link', { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' }],
    ['meta', { property: 'og:site_name', content: SITE_NAME }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  transformHead({ pageData }) {
    const fm = pageData.frontmatter || {}
    const currentPath = normalizeRoute(pageData.relativePath || '')
    const isHome = currentPath === ''
    const isNotFound = currentPath === '404'
    const isArticle = /^(?:chatgpt|guides|developer|models|blog)\/.+/.test(currentPath)
    const rawTitle = String(fm.title || pageData.title || SITE_NAME)
    const title = isHome || rawTitle.includes('|') ? rawTitle : `${rawTitle} | ${SITE_NAME}`
    const description = String(fm.description || pageData.description || DEFAULT_DESCRIPTION)
    const url = pageUrl(pageData.relativePath || '')
    const image = absoluteAsset(String(fm.image || DEFAULT_IMAGE))
    const robots = isNotFound
      ? 'noindex,follow,noarchive'
      : String(fm.robots || 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1')
    const head: any[] = [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { name: 'description', content: description }],
      ['meta', { name: 'robots', content: robots }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:image', content: image }],
      ['meta', { property: 'og:image:alt', content: rawTitle }],
      ['meta', { property: 'og:type', content: isArticle ? 'article' : 'website' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
      ['meta', { name: 'twitter:image', content: image }],
      ['meta', { name: 'twitter:image:alt', content: rawTitle }],
    ]

    const published = isoDate(fm.date)
    const modified = isoDate(fm.updated || fm.date)

    if (isArticle) {
      if (published) head.push(['meta', { property: 'article:published_time', content: published }])
      if (modified) head.push(['meta', { property: 'article:modified_time', content: modified }])
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: rawTitle,
          description,
          url,
          image: [image],
          inLanguage: 'zh-CN',
          ...(published ? { datePublished: published } : {}),
          ...(modified ? { dateModified: modified } : {}),
          mainEntityOfPage: { '@type': 'WebPage', '@id': url },
          author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
          publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: { '@type': 'ImageObject', url: absoluteAsset('/logo.svg') },
          },
        }),
      ])
    }

    if (isHome) {
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          alternateName: HOME_TITLE,
          url: SITE_URL,
          description: DEFAULT_DESCRIPTION,
          inLanguage: 'zh-CN',
        }),
      ])
    } else {
      const parent = isArticle ? `${SITE_URL}/blog` : SITE_URL
      const parentName = isArticle ? '文章目录' : SITE_NAME
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '首页', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: parentName, item: parent },
            { '@type': 'ListItem', position: 3, name: rawTitle, item: url },
          ],
        }),
      ])
    }

    return head
  },

  sitemap: {
    hostname: SITE_URL,
    transformItems(items) {
      const meta = pageMetaByPath()
      return items
        .map((item) => {
          const parsedUrl = new URL(item.url || '/', `${SITE_URL}/`)
          const pathname = parsedUrl.pathname.replace(/\/$/, '') || '/'
          const details = meta[pathname]
          return {
            ...item,
            url: `${SITE_URL}${pathname === '/' ? '/' : pathname}`,
            ...(details?.lastmod ? { lastmod: details.lastmod } : {}),
            ...(details?.priority !== undefined ? { priority: details.priority } : {}),
            ...(details?.changefreq ? { changefreq: details.changefreq } : {}),
          }
        })
        .filter((item) => {
          const pathname = new URL(item.url || '/', `${SITE_URL}/`).pathname.replace(/\/$/, '') || '/'
          return !EXCLUDED_SITEMAP_PATHS.has(pathname)
        })
        .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index)
    },
  },

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: SITE_NAME,
    nav: [
      { text: '首页', link: '/' },
      { text: 'ChatGPT', link: '/chatgpt/' },
      { text: '使用教程', link: '/guides/' },
      { text: '开发者', link: '/developer/' },
      { text: '模型与对比', link: '/models/' },
      { text: '文章目录', link: '/blog/' },
    ],
    sidebar: {
      '/chatgpt/': sidebarArticles('/chatgpt/'),
      '/guides/': sidebarArticles('/guides/'),
      '/developer/': sidebarArticles('/developer/'),
      '/models/': sidebarArticles('/models/'),
      '/blog/': [
        {
          text: '全部文章',
          items: [{ text: '文章总目录', link: '/blog/' }],
        },
        ...sidebarArticles('/'),
      ],
    },
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    socialLinks: [],
    footer: {
      message: '本站为独立中文教程与资料整理站，不代表 OpenAI、Anthropic、Google 或 xAI 官方立场。',
      copyright: '内容仅供学习参考，请以相关服务官方页面和条款为准。',
    },
  },
})
