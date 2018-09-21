import * as d from '../../declarations';
import { catchError } from '../util';


export function updateCanonicalLink(config: d.Config, results: d.PrerenderResults) {
  try {
    // https://webmasters.googleblog.com/2009/02/specify-your-canonical.html
    // <link rel="canonical" href="http://www.example.com/product.php?item=swedish-fish" />

    const canonicalLink = results.document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      return;
    }

    const existingHref = canonicalLink.getAttribute('href');

    const updatedRref = updateCanonicalLinkHref(config, existingHref, results.url);

    canonicalLink.setAttribute('href', updatedRref);

  } catch (e) {
    catchError(results.diagnostics, e);
  }
}


export function updateCanonicalLinkHref(config: d.Config, href: string, windowLocationPath: string) {
  const parsedUrl = config.sys.url.parse(windowLocationPath);

  if (typeof href === 'string') {
    href = href.trim();

    if (href.endsWith('/')) {
      href = href.substr(0, href.length - 1);
    }

  } else {
    href = '';
  }

  return `${href}${parsedUrl.path}`;
}
