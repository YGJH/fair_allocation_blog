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
    advisorsLabel: '指導教授',
    creditSeparator: '：',
    firstAdvisorDepartment: '海洋大學 資訊工程學系',
    firstAdvisorName: '林莊傑 教授',
    secondAdvisorDepartment: '陽明交通大學 資訊管理學系',
    secondAdvisorName: '陳柏安 教授',
    studentsLabel: '學生',
    studentDepartment: '海大資工',
    studentNames: ['楊子賢', '管于德', '陳羿豪', '吳承睿'],
    start: '開始閱讀',
    figureSection: '三、為什麼 NSW 很難？',
    figureAria: '公平分配研究的主視覺圖片。',
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
    advisorsLabel: 'Advisors',
    creditSeparator: ': ',
    firstAdvisorDepartment: 'NTOU Department of Computer Science and Engineering',
    firstAdvisorName: 'Professor 林莊傑',
    secondAdvisorDepartment: 'NYCU Institute of Information Management',
    secondAdvisorName: 'Professor 陳柏安',
    studentsLabel: 'Students',
    studentDepartment: 'NTOU Computer Science and Engineering',
    studentNames: ['楊子賢', '管于德', '陳羿豪', '吳承睿'],
    start: 'Start reading',
    figureSection: 'III. Why is NSW difficult to maximize?',
    figureAria: 'Fair allocation research illustration.',
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

function enhanceArticle(ui) {
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

      if (!Array.isArray(node.children)) return;

      const sectionIndex = node.children.findIndex((child) =>
        child.type === 'element'
        && child.tagName === 'h2'
        && nodeText(child) === ui.figureSection
      );

      if (sectionIndex !== -1) {
        node.children.splice(sectionIndex + 1, 0, {
          type: 'element',
          tagName: 'figure',
          properties: { className: ['article-figure'] },
          children: [{
            type: 'element',
            tagName: 'img',
            properties: {
              src: `${ui.assets}/bg.jpeg`,
              width: 1376,
              height: 768,
              alt: ui.figureAria,
            },
            children: [],
          }],
        });
      }
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
        <aside class="research-credits" aria-label="${ui.advisorsLabel} / ${ui.studentsLabel}">
          <div class="credit-group">
            <p class="credit-label">${ui.advisorsLabel}</p>
            <div class="credit-content advisor-list">
              <p><span class="advisor-department">${ui.firstAdvisorDepartment}</span><span class="advisor-person">${ui.creditSeparator}<a href="https://cse.ntou.edu.tw/p/412-1063-12349.php?Lang=zh-tw" target="_blank" rel="noreferrer">${ui.firstAdvisorName}</a></span></p>
              <p><span class="advisor-department">${ui.secondAdvisorDepartment}</span><span class="advisor-person">${ui.creditSeparator}<a href="https://iim.nycu.edu.tw/iim/ch/app/artwebsite/view?module=artwebsite&amp;id=37975&amp;serno=4cb17686-fcc1-48ac-bc4e-764d07d8555b" target="_blank" rel="noreferrer">${ui.secondAdvisorName}</a></span></p>
            </div>
          </div>
          <div class="credit-group">
            <p class="credit-label">${ui.studentsLabel}</p>
            <div class="credit-content student-list">
              <p class="student-department">${ui.studentDepartment}</p>
              <ul>${ui.studentNames.map((name) => `<li>${name}</li>`).join('')}</ul>
            </div>
          </div>
        </aside>
        <p class="dek">${escapeHtml(article.description)}</p>
        <a class="start-link" href="#research-article">${ui.start}</a>
      </div>
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
    .use(enhanceArticle, ui)
    .use(rehypeStringify)
    .process(article.body));

  const outputDir = path.join(dist, ui.output);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'index.html'), template(locale, ui, article, articleHtml));
}

await cp(path.join(root, 'src', 'styles.css'), path.join(dist, 'assets', 'styles.css'));
await cp(path.join(root, 'bg.jpeg'), path.join(dist, 'assets', 'bg.jpeg'));
await cp(path.join(root, 'node_modules', 'katex', 'dist', 'katex.min.css'), path.join(dist, 'assets', 'katex.min.css'));
await cp(path.join(root, 'node_modules', 'katex', 'dist', 'fonts'), path.join(dist, 'assets', 'fonts'), { recursive: true });
await writeFile(path.join(dist, '.nojekyll'), '');

console.log(`Built ${Object.keys(locales).length} localized pages in ${dist}`);
