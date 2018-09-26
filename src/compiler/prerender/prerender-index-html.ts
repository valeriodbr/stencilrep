import * as d from '../../declarations';
import { inlinePrerenderClient } from './inline-prerender-client';
import { minifyInlinedContent } from '../html/minify-inline-content';
import { parseHtmlToDocument, serializeNodeToHtml } from '@stencil/core/mock-doc';


export async function prepareDocumentBeforePrerender(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, outputTarget: d.OutputTargetWww) {
  let indexHtml = await compilerCtx.fs.readFile(config.srcIndexHtml);

  const doc = parseHtmlToDocument(indexHtml);

  await optimizeIndexForPrerender(config, compilerCtx, buildCtx, outputTarget, doc);

  indexHtml = serializeNodeToHtml(doc, {
    pretty: outputTarget.prettyHtml,
    collapseBooleanAttributes: !outputTarget.prettyHtml,
    removeAttributeQuotes: !outputTarget.prettyHtml,
    removeEmptyAttributes: !outputTarget.prettyHtml
  });

  await compilerCtx.fs.writeFile(outputTarget.indexHtml, indexHtml);
}


export function finalizeDocumentAfterPrerender(doc: HTMLDocument) {
  const prerenderPrepareScriptElm = doc.getElementById('prerender-prepare-script');
  if (prerenderPrepareScriptElm) {
    prerenderPrepareScriptElm.remove();
  }
}


async function optimizeIndexForPrerender(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, outputTarget: d.OutputTargetWww, doc: Document) {
  optimizeDocumentElement(doc);
  optimizeDocumentHead(doc, doc.head);

  await minifyInlinedContent(config, compilerCtx, buildCtx, doc);

  await inlinePrerenderClient(config, buildCtx, outputTarget, doc);
}


function optimizeDocumentElement(doc: HTMLDocument) {
  if (doc.documentElement) {
    if (!doc.documentElement.hasAttribute('lang')) {
      doc.documentElement.setAttribute('lang', 'en-US');
    }

    if (!doc.documentElement.hasAttribute('dir')) {
      doc.documentElement.setAttribute('dir', 'ltr');
    }
  }
}


function optimizeDocumentHead(doc: HTMLDocument, head: HTMLHeadElement) {
  if (!head) {
    return;
  }

  // make sure the meta charset is first element in doc.head
  let metaCharset = head.querySelector('meta[charset]');
  if (metaCharset) {
    if (head.firstElementChild !== metaCharset) {
      metaCharset.remove();
      head.insertBefore(metaCharset, head.firstChild);
    }

  } else {
    metaCharset = doc.createElement('meta');
    metaCharset.setAttribute('charset', 'utf-8');
    head.insertBefore(metaCharset, head.firstChild);
  }

  // make sure sure we've got the http-equiv="X-UA-Compatible" IE=Edge meta tag added
  let metaUaCompatible = head.querySelector('meta[http-equiv="X-UA-Compatible"]');
  if (!metaUaCompatible) {
    metaUaCompatible = doc.createElement('meta');
    metaUaCompatible.setAttribute('http-equiv', 'X-UA-Compatible');
    metaUaCompatible.setAttribute('content', 'IE=Edge');

    const allMetas = head.querySelectorAll('meta');
    const lastMeta = allMetas[allMetas.length - 1];
    if (lastMeta) {
      head.insertBefore(metaUaCompatible, lastMeta.nextSibling);
    } else {
      head.appendChild(metaUaCompatible);
    }
  }
}
