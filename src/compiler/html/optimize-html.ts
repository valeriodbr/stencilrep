import * as d from '../../declarations';
import { assetVersioning } from '../asset-versioning/asset-versioning';
import { buildError, catchError } from '../util';
import { inlineExternalAssets } from './inline-external-assets';
import { inlineLoaderScript } from './inline-loader-script';
import { minifyInlineScripts, minifyInlineStyles } from './minify-inline-content';
import { optimizeSsrStyles } from '../style/optimize-ssr-styles';
import { updateCanonicalLink } from './canonical-link';


export async function optimizeHtml(
  config: d.Config,
  compilerCtx: d.CompilerCtx,
  hydrateTarget: d.OutputTargetHydrate,
  results: d.PrerenderResults
) {
  if (!results.document) {
    const diagnostic = buildError(results.diagnostics);
    diagnostic.type = 'prerender';
    diagnostic.header = `Invalid document`;
    diagnostic.messageText = `Prerendering was unable to parse document`;
    return;
  }

  if (hydrateTarget.hydrateComponents) {
    results.document.documentElement.setAttribute(
      'data-prerendered',
      (typeof hydrateTarget.timestamp === 'string' ? hydrateTarget.timestamp : '')
    );
  }

  if (hydrateTarget.canonicalLink) {
    updateCanonicalLink(config, results);
  }

  if (hydrateTarget.inlineStyles) {
    optimizeSsrStyles(config, hydrateTarget, results);
  }

  const inlinePromises: Promise<any>[] = [];

  if (hydrateTarget.inlineLoaderScript) {
    // remove the script to the external loader script request
    // inline the loader script at the bottom of the html
    inlinePromises.push(inlineLoaderScript(config, compilerCtx, hydrateTarget, results));
  }

  if (hydrateTarget.inlineAssetsMaxSize > 0) {
    inlinePromises.push(inlineExternalAssets(config, compilerCtx, hydrateTarget, results));
  }

  // need to wait on to see if external files are inlined
  await Promise.all(inlinePromises);

  // reset for new promises
  const minifyPromises: Promise<any>[] = [];

  if (config.minifyCss) {
    minifyPromises.push(minifyInlineStyles(config, compilerCtx, results));
  }

  if (config.minifyJs) {
    minifyPromises.push(minifyInlineScripts(config, compilerCtx, results));
  }

  if (config.assetVersioning) {
    minifyPromises.push(assetVersioning(config, compilerCtx, hydrateTarget, results));
  }

  await Promise.all(minifyPromises);
}


export async function optimizeIndexHtml(
  _config: d.Config,
  compilerCtx: d.CompilerCtx,
  hydrateTarget: d.OutputTargetHydrate,
  _windowLocationPath: string,
  diagnostics: d.Diagnostic[]
) {
  try {
    hydrateTarget.html = await compilerCtx.fs.readFile(hydrateTarget.indexHtml);

    try {
      const doc: HTMLDocument = null;

      if (doc) {
        // await optimizeHtml(config, compilerCtx, hydrateTarget, windowLocationPath, doc, diagnostics);

        // serialize this dom back into a string
        // await compilerCtx.fs.writeFile(hydrateTarget.indexHtml, dom.serialize());
      }

    } catch (e) {
      catchError(diagnostics, e);
    }

  } catch (e) {
    // index.html file doesn't exist, which is fine
  }
}
