import * as d from '../../declarations';
import { versionElementAssets } from './element-assets';
import { versionManifestAssets } from './manifest-assets';


export async function assetVersioning(config: d.Config, compilerCtx: d.CompilerCtx, outputTarget: d.OutputTargetHydrate, results: d.PrerenderResults) {
  await versionElementAssets(config, compilerCtx, outputTarget, results.url, results.document);
  await versionManifestAssets(config, compilerCtx, outputTarget, results.url, results.document);
}
