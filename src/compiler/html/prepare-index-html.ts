import * as d from '../../declarations';
import { parseHtmlToDocument, serializeNodeToHtml } from '@stencil/core/mock-doc';


export async function prepareIndexHtml(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, outputTarget: d.OutputTargetWww) {
  let indexHtml = await compilerCtx.fs.readFile(config.srcIndexHtml);

  const doc = parseHtmlToDocument(indexHtml);

  await modifyIndexDocument(config, buildCtx, doc);

  indexHtml = serializeNodeToHtml(doc, {
    pretty: outputTarget.prettyHtml,
    collapseBooleanAttributes: !outputTarget.prettyHtml,
    removeAttributeQuotes: !outputTarget.prettyHtml,
    removeHtmlComments: !outputTarget.prettyHtml,
    removeEmptyAttributes: !outputTarget.prettyHtml
  });

  await compilerCtx.fs.writeFile(outputTarget.indexHtml, indexHtml);
}


async function modifyIndexDocument(config: d.Config, buildCtx: d.BuildCtx, doc: Document) {

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

  const tasks: Promise<any>[] = [];

  if (config.minifyJs) {
    const scripts = doc.querySelectorAll('script');
    for (let i = 0; i < scripts.length; i++) {
      tasks.push(minifyInlineScript(config, buildCtx, scripts[i]));
    }
  }

  if (config.minifyCss) {
    const styles = doc.querySelectorAll('style');
    for (let i = 0; i < styles.length; i++) {
      tasks.push(minifyInlineStyle(config, buildCtx, styles[i]));
    }
  }

  await Promise.all(tasks);
}


async function minifyInlineScript(config: d.Config, buildCtx: d.BuildCtx, script: HTMLScriptElement) {
  if (!script.src && script.innerHTML) {
    const results = await config.sys.minifyJs(script.innerHTML);

    if (results.diagnostics && results.diagnostics.length > 0) {
      buildCtx.diagnostics.push(...results.diagnostics);

    } else {
      script.innerHTML = results.output;
    }
  }
}


async function minifyInlineStyle(config: d.Config, buildCtx: d.BuildCtx, style: HTMLStyleElement) {
  if (style.innerHTML) {
    const results = await config.sys.minifyCss(style.innerHTML);

    if (results.diagnostics && results.diagnostics.length > 0) {
      buildCtx.diagnostics.push(...results.diagnostics);

    } else {
      style.innerHTML = results.output;
    }
  }
}
