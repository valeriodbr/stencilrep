import * as d from '../../declarations';
import { assetVersioning } from '../asset-versioning/asset-versioning';
import { inlineExternalAssets } from './inline-external-assets';
import { optimizeSsrStyles } from '../style/optimize-ssr-styles';
import { updateCanonicalLink } from './canonical-link';


export async function optimizeHtml(
  config: d.Config,
  compilerCtx: d.CompilerCtx,
  hydrateTarget: d.OutputTargetHydrate,
  results: d.PrerenderResults
) {
  results.document.documentElement.setAttribute(
    'data-prerendered',
    (typeof hydrateTarget.timestamp === 'string' ? hydrateTarget.timestamp : '')
  );

  if (hydrateTarget.canonicalLink) {
    updateCanonicalLink(config, results);
  }

  if (hydrateTarget.inlineStyles) {
    optimizeSsrStyles(config, hydrateTarget, results);
  }

  const inlinePromises: Promise<any>[] = [];

  if (hydrateTarget.inlineAssetsMaxSize > 0) {
    inlinePromises.push(inlineExternalAssets(config, compilerCtx, hydrateTarget, results));
  }

  // need to wait on to see if external files are inlined
  await Promise.all(inlinePromises);

  // reset for new promises
  const minifyPromises: Promise<any>[] = [];

  if (config.assetVersioning) {
    minifyPromises.push(assetVersioning(config, compilerCtx, hydrateTarget, results));
  }

  await Promise.all(minifyPromises);
}
