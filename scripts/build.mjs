import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const siteUrl = 'https://ygjh.github.io/fair_allocation_blog';

const locales = {
  'zh-TW': {
    file: 'research-paper-blog.zh-TW.md',
    output: '',
    assets: './assets',
    home: './',
    alternate: './en/',
    alternateLabel: 'English',
    labLabel: '前往分配實驗室',
    labUrl: 'https://fairallocation.kuan216.win/zh-TW',
    kicker: '研究導讀',
    start: '開始閱讀',
    figureAria: '三件不可分割物品沿著分配線，在兩位參與者之間移動。',
    figureCaption: '同一組物品，不只一種公平。',
    leftAgent: '參與者 A',
    rightAgent: '參與者 B',
    brand: '公平分配研究',
    navLabel: '主選單',
    skip: '跳至主要內容',
    canonical: `${siteUrl}/`,
  },
  en: {
    file: 'research-paper-blog.en.md',
    output: 'en',
    assets: '../assets',
    home: '../',
    alternate: '../',
    alternateLabel: '繁體中文',
    labLabel: 'Open allocation lab',
    labUrl: 'https://fairallocation.kuan216.win/en',
    kicker: 'A guide to the research',
    start: 'Start reading',
    figureAria: 'Three indivisible goods moving between two people along an allocation line.',
    figureCaption: 'One set of goods. More than one idea of fair.',
    leftAgent: 'Person A',
    rightAgent: 'Person B',
    brand: 'Fair allocation research',
    navLabel: 'Main navigation',
    skip: 'Skip to main content',
    canonical: `${siteUrl}/en/`,
  },
};

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function headingId(value) {
  return value
    .toLocaleLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

function nodeText(node) {
  if (node.type === 'text') return node.value;
  return (node.children ?? []).map(nodeText).join('');
}

function enhanceArticle() {
  return (tree) => {
    const walk = (node) => {
      if (node.type === 'element') {
        if (node.tagName === 'h2') {
          node.properties ??= {};
          node.properties.id = headingId(nodeText(node));
        }

        if (node.tagName === 'a' && typeof node.properties?.href === 'string' && node.properties.href.startsWith('http')) {
          node.properties.target = '_blank';
          node.properties.rel = ['noreferrer'];
        }
      }

      for (const child of node.children ?? []) walk(child);
    };

    walk(tree);
  };
}

function parseArticle(markdown, file) {
  const header = markdown.match(/^# (.+)\n\n_(.+)_\n\n---\n\n/);
  if (!header) throw new Error(`Invalid article header: ${file}`);

  const body = markdown.slice(header[0].length);
  return { title: header[1], description: header[2], body };
}

function template(locale, ui, article, articleHtml) {
  return `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(article.description)}">
  <meta name="theme-color" content="#0b3035">
  <link rel="canonical" href="${ui.canonical}">
  <link rel="alternate" hreflang="zh-TW" href="${siteUrl}/">
  <link rel="alternate" hreflang="en" href="${siteUrl}/en/">
  <link rel="stylesheet" href="${ui.assets}/katex.min.css">
  <link rel="stylesheet" href="${ui.assets}/styles.css">
  <title>${escapeHtml(article.title)}</title>
</head>
<body>
  <a class="skip-link" href="#main-content">${ui.skip}</a>
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="${ui.home}"><span class="brand-symbol" aria-hidden="true">◒</span><span>${ui.brand}</span></a>
      <nav class="site-nav" aria-label="${ui.navLabel}">
        <a class="lab-link" href="${ui.labUrl}">${ui.labLabel}</a>
        <a class="language-switch" href="${ui.alternate}" hreflang="${locale === 'en' ? 'zh-TW' : 'en'}">${ui.alternateLabel}</a>
      </nav>
    </div>
  </header>

  <main id="main-content" class="page">
    <section class="hero" aria-labelledby="research-title">
      <div class="hero-copy">
        <p class="kicker">${ui.kicker}</p>
        <h1 id="research-title">${escapeHtml(article.title)}</h1>
        <p class="dek">${escapeHtml(article.description)}</p>
        <a class="start-link" href="#research-article">${ui.start}</a>
      </div>

      <figure class="allocation-figure" aria-label="${ui.figureAria}">
        <div class="rule" aria-hidden="true"><i></i><span>EF1</span><i></i></div>
        <div class="allocation-scene" aria-hidden="true">
          <div class="agent agent-left"><strong>A</strong><span>${ui.leftAgent}</span></div>
          <div class="goods"><span class="good-one">1</span><span class="good-two">2</span><span class="good-three">3</span></div>
          <div class="agent agent-right"><strong>B</strong><span>${ui.rightAgent}</span></div>
        </div>
        <figcaption>${ui.figureCaption}</figcaption>
      </figure>
    </section>

    <div class="reading-layout">
      <article id="research-article" class="article">
${articleHtml}
      </article>
    </div>
  </main>

  <footer class="site-footer">${ui.brand}</footer>
</body>
</html>`;
}

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'assets'), { recursive: true });

for (const [locale, ui] of Object.entries(locales)) {
  const file = path.join(root, 'content', ui.file);
  const article = parseArticle(await readFile(file, 'utf8'), file);
  const articleHtml = String(await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex)
    .use(enhanceArticle)
    .use(rehypeStringify)
    .process(article.body));

  const outputDir = path.join(dist, ui.output);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'index.html'), template(locale, ui, article, articleHtml));
}

await cp(path.join(root, 'src', 'styles.css'), path.join(dist, 'assets', 'styles.css'));
await cp(path.join(root, 'node_modules', 'katex', 'dist', 'katex.min.css'), path.join(dist, 'assets', 'katex.min.css'));
await cp(path.join(root, 'node_modules', 'katex', 'dist', 'fonts'), path.join(dist, 'assets', 'fonts'), { recursive: true });
await writeFile(path.join(dist, '.nojekyll'), '');

console.log(`Built ${Object.keys(locales).length} localized pages in ${dist}`);
