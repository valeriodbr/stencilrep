import * as d from '../../declarations';


export function extractResolvedAnchorUrls(anchorUrls: string[], elm: HTMLElement) {
  if (elm) {

    if (elm.nodeName === 'A') {
      const resolvedAnchorUrl = elm.getAttribute('data-resolved-url');
      if (resolvedAnchorUrl) {
        if (!anchorUrls.includes(resolvedAnchorUrl)) {
          anchorUrls.push(resolvedAnchorUrl);
        }
        elm.removeAttribute('data-resolved-url');
      }
    }

    const children = elm.children as any;
    if (children) {
      for (let i = 0; i < children.length; i++) {
        extractResolvedAnchorUrls(anchorUrls, children[i]);
      }
    }
  }
}


export function queuePathForPrerender(config: d.Config, outputTarget: d.OutputTargetWww, queuedPaths: string[], processingPaths: Set<string>, completedPaths: Set<string>, path: string) {
  if (typeof path !== 'string') {
    return;
  }

  const parsedUrl = config.sys.url.parse(path);

  if (!outputTarget.prerenderPathHash || !outputTarget.prerenderPathQuery) {
    const hash = (parsedUrl.hash || '').split('?')[0];
    const search = (parsedUrl.search || '').split('#')[0];

    path = path.split('?')[0].split('#')[0];

    if (search) {
      path += search;
    }

    if (hash) {
      path += hash;
    }
  }

  if (queuedPaths.includes(path)) {
    return;
  }

  if (processingPaths.has(path)) {
    return;
  }

  if (completedPaths.has(path)) {
    return;
  }

  queuedPaths.push(path);
}
