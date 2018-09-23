import * as d from '../../declarations';
import { parseHtmlToDocument, serializeNodeToHtml } from '@stencil/core/mock-doc';


export async function prepareIndexHtml(config: d.Config, compilerCtx: d.CompilerCtx, outputTarget: d.OutputTargetWww) {
  let indexHtml = await compilerCtx.fs.readFile(config.srcIndexHtml);

  const doc = parseHtmlToDocument(indexHtml);

  modifyIndexDocument(doc);

  indexHtml = serializeNodeToHtml(doc);

  await compilerCtx.fs.writeFile(outputTarget.indexHtml, indexHtml);
}


async function modifyIndexDocument(doc: Document) {

  if (!doc.documentElement.hasAttribute('lang')) {
    doc.documentElement.setAttribute('lang', 'en-US');
  }

  if (!doc.documentElement.hasAttribute('dir')) {
    doc.documentElement.setAttribute('dir', 'ltr');
  }

  if (doc.head) {
    // make sure the meta charset is first element in doc.head
    let metaCharset = doc.head.querySelector('meta[charset]');
    if (metaCharset) {
      if (doc.head.firstElementChild !== metaCharset) {
        metaCharset.remove();
        doc.head.insertBefore(metaCharset, doc.head.firstChild);
      }

    } else {
      metaCharset = doc.createElement('meta');
      metaCharset.setAttribute('charset', 'utf-8');
      doc.head.insertBefore(metaCharset, doc.head.firstChild);
    }

    // make sure sure we've got the http-equiv="X-UA-Compatible" IE=Edge meta tag added
    let metaUaCompatible = doc.head.querySelector('meta[http-equiv="X-UA-Compatible"]');
    if (!metaUaCompatible) {
      metaUaCompatible = doc.createElement('meta');
      metaUaCompatible.setAttribute('http-equiv', 'X-UA-Compatible');
      metaUaCompatible.setAttribute('content', 'IE=Edge');
      doc.head.insertBefore(metaUaCompatible, metaCharset.nextSibling);
    }
  }

}
