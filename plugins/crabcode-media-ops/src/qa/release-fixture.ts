import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { buildArticleDoc } from '../rendering/article-doc.ts'
import { renderArticle } from '../rendering/renderer.ts'
import { sha256Bytes, writeJson } from './artifacts.ts'

export type ReleaseFixture = {
  html: string
  markdown: string
  wechatHtml: string
  semanticHash: string
  articleDocHash: string
  originalitySubjectHash: string
}

const BODY_MARKDOWN = `## 为什么把交付质量变成证据

一篇文章能在编辑器里打开，不代表它已经适合发布。正式交付还要回答三个问题：结构是否有效、不同屏幕是否可读、打印与辅助技术是否仍能理解内容。

> 质量不是一句“看起来没问题”，而是一组可以重跑、可以定位、可以核验的证据。

### 自动检查覆盖什么

- 在 320、375、768 和 1440 像素宽度检查完整页面。
- 同时请求浅色与深色系统主题，确认编辑白底没有被浏览器偏好改写。
- 用 [Nu Html Checker](https://validator.github.io/validator/) 检查 HTML，并用 [axe-core](https://github.com/dequelabs/axe-core) 检查可访问性。
- 对文本间距与 200% 字号进行压力测试，再生成 A4 和 Letter 两种打印文件。

### 固定输入与真实输出

| 检查对象 | 固定条件 | 证据 |
| --- | --- | --- |
| 浏览器视图 | Chromium、固定视口 | 整页 PNG |
| 文档结构 | Nu 26.7.15 | JSON 报告 |
| 可访问性 | axe-core 4.12.1 | 违规节点明细 |
| 打印 | A4 与 Letter | PDF 文件 |

正文还包含一段很长的可换行链接，用来暴露窄屏横向溢出问题：[可核验的长链接示例](https://example.com/research/2026/07/15/a-very-long-but-valid-path-for-responsive-overflow-verification?source=release-fixture&medium=qa)。

#### 可重复执行

渲染输入中不使用当前时间、随机数或网络响应。下面这段代码表达了最小判定逻辑：

\`\`\`ts
const deliveryReady =
  nu.errors === 0 &&
  axe.violations === 0
\`\`\`

当运行环境缺少 Java、Nu jar 或 Playwright 浏览器时，检查必须明确失败，并保留错误原因；任何缺失都不能被记录成通过。

---

最终结论应当能够回到具体报告、截图或 PDF，并通过 SHA-256 验证文件没有在检查后被替换。`

export function createReleaseFixture(): ReleaseFixture {
  const built = buildArticleDoc({
    title: '发布前自动化 QA：从“看起来正确”到可核验证据',
    summary: '固定输入覆盖语义结构、响应式、白底、可访问性与打印输出，用于发布门禁的可重复回归。',
    bodyMarkdown: BODY_MARKDOWN,
    citations: [
      {
        url: 'https://html5.validator.nu/',
        title: 'Nu Html Checker',
        publisher: 'Validator.nu',
        publishedAt: '2026-07-15T00:00:00.000Z',
        accessedAt: '2026-07-15T00:00:00.000Z',
      },
      {
        url: 'https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html',
        title: 'Understanding Success Criterion 1.4.12: Text Spacing',
        publisher: 'W3C Web Accessibility Initiative',
        accessedAt: '2026-07-15T00:00:00.000Z',
      },
    ],
    aiDisclosure: {
      aiAssisted: true,
      methods: ['body-label'],
      bodyLabelText: '本页是自动化 QA 的固定测试夹具，不作为真实媒体内容发布。',
    },
  })
  const rendered = renderArticle(built.articleDoc, new Map(), {
    contentId: '00000000-0000-4000-8000-000000000001',
    revisionId: '00000000-0000-4000-8000-000000000002',
    articleDocHash: built.articleDocHash,
  })
  return {
    ...rendered,
    articleDocHash: built.articleDocHash,
    originalitySubjectHash: built.originalitySubjectHash,
  }
}

export async function writeReleaseFixture(outputRoot: string): Promise<{
  artifactRoot: string
  htmlRelativePath: 'article.html'
  fixture: ReleaseFixture
  manifestPath: string
}> {
  const artifactRoot = resolve(outputRoot)
  await mkdir(artifactRoot, { recursive: true })
  const fixture = createReleaseFixture()
  await Promise.all([
    writeFile(join(artifactRoot, 'article.html'), fixture.html, 'utf8'),
    writeFile(join(artifactRoot, 'article.md'), fixture.markdown, 'utf8'),
    writeFile(join(artifactRoot, 'wechat-richtext.html'), fixture.wechatHtml, 'utf8'),
  ])
  const manifestPath = join(artifactRoot, 'fixture-manifest.json')
  await writeJson(manifestPath, {
    schemaVersion: 'mediaops-release-fixture@1',
    files: {
      'article.html': { sha256: sha256Bytes(fixture.html), byteSize: Buffer.byteLength(fixture.html) },
      'article.md': { sha256: sha256Bytes(fixture.markdown), byteSize: Buffer.byteLength(fixture.markdown) },
      'wechat-richtext.html': { sha256: sha256Bytes(fixture.wechatHtml), byteSize: Buffer.byteLength(fixture.wechatHtml) },
    },
    semanticHash: fixture.semanticHash,
    articleDocHash: fixture.articleDocHash,
    originalitySubjectHash: fixture.originalitySubjectHash,
  })
  return { artifactRoot, htmlRelativePath: 'article.html', fixture, manifestPath }
}
