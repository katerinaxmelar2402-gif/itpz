export function normalizeBase(value) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Нужен HTTP(S) URL справки');
  url.hash = '';
  url.search = '';
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

export function resolveDocLink(href, currentUrl, baseUrl) {
  const base = new URL(normalizeBase(baseUrl));
  let url;
  if (href.startsWith('/') && !href.startsWith('//')) {
    url = new URL(href.slice(1) || './', base);
  } else if (href.startsWith('#/')) {
    const route = href.slice(2).split('?')[0];
    url = new URL(route || './', base);
  } else {
    url = new URL(href, currentUrl);
    if (url.origin === base.origin && url.pathname === base.pathname && url.hash.startsWith('#/')) {
      url = new URL(url.hash.slice(2).split('?')[0] || './', base);
    }
  }
  if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return null;
  if (url.pathname.endsWith('/')) url.pathname += 'README.md';
  if (!url.pathname.endsWith('.md')) return null;
  url.hash = '';
  url.search = '';
  return url.href;
}

// Дополнительный inline-токен для простого <u>текста</u>.
// Остальной HTML не исполняется. Внутри <u> используется обычный текст.
export function underlinePlugin(md) {
  md.inline.ruler.before('html_inline', 'underline', (state, silent) => {
    if (!state.src.startsWith('<u>', state.pos)) return false;
    const end = state.src.indexOf('</u>', state.pos + 3);
    if (end < 0) return false;
    if (!silent) {
      const token = state.push('underline', 'u', 0);
      token.content = state.src.slice(state.pos + 3, end);
    }
    state.pos = end + 4;
    return true;
  });
}

export function absoluteImagesPlugin(md, currentUrl) {
  md.core.ruler.after('inline', 'absolute_images', state => {
    function visit(tokens) {
      for (const token of tokens || []) {
        if (token.type === 'image') {
          const src = token.attrGet('src');
          if (src) token.attrSet('src', new URL(src, currentUrl).href);
        }
        visit(token.children);
      }
    }
    visit(state.tokens);
  });
}
