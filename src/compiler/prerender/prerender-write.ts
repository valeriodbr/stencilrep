import * as d from '../../declarations';
import { buildError, catchError, pathJoin } from '../util';
import { serializeNodeToHtml } from '@stencil/core/mock-doc';


export async function writePrerenderResults(compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, outputTarget: d.OutputTargetWww, results: d.PrerenderResults, filePath: string) {
  try {
    results.html = serializeNodeToHtml(results.document as any, {
      pretty: outputTarget.prettyHtml
    });

    for (let i = 0; i < 5; i++) {
      const success = await writePrerenderContent(compilerCtx, buildCtx, results, filePath);
      if (success) {
        // we wrote the prerendered content with no issues :)
        break;
      }

      // this should pretty much never happen, but who knows
      await new Promise(resolve => setTimeout(resolve, 100));
    }

  } catch (e) {
    catchError(buildCtx.diagnostics, e);
  }
}


async function writePrerenderContent(compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, results: d.PrerenderResults, filePath: string) {
  let success = false;

  try {
    // add the prerender html content it to our collection of
    // files that need to be saved when we're all ready
    // do NOT use the cache here, best to not use up that memory
    await compilerCtx.fs.writeFile(filePath, results.html, { useCache: false });

    // sweet, all good
    success = true;

  } catch (e) {
    // gah!! what!!
    const diagnostic = buildError(buildCtx.diagnostics);
    diagnostic.header = `Prerender Write Error`;
    diagnostic.messageText = `writePrerenderDest, url: ${results.url}, pathname: ${results.pathname}, ${e}`;
  }

  return success;
}


export async function writePageAnalysis(config: d.Config, compilerCtx: d.CompilerCtx, outputTarget: d.OutputTargetWww, results: d.PrerenderResults) {
  const fileName = encodeURIComponent(results.path) + '.json';
  const filePath = config.sys.path.join(outputTarget.pageAnalysis.dir, fileName);

  const pageAnalysis: d.PageAnalysis = {
    path: results.path,
    pathname: results.pathname,
    search: results.search,
    hash: results.hash,
    anchorPaths: results.anchorPaths,
    diagnostics: results.diagnostics,
    pageErrors: results.pageErrors,
    requests: results.requests,
    metrics: results.metrics,
    coverage: results.coverage
  };

  await compilerCtx.fs.writeFile(filePath, JSON.stringify(pageAnalysis, null, 2), { useCache: false });
}


export function getWritePathFromUrl(config: d.Config, outputTarget: d.OutputTargetWww, pathname: string) {
  if (pathname.startsWith(outputTarget.baseUrl)) {
    pathname = pathname.substring(outputTarget.baseUrl.length);

  } else if (outputTarget.baseUrl === pathname + '/') {
    pathname = '/';
  }

  // figure out the directory where this file will be saved
  const dir = pathJoin(
    config,
    outputTarget.dir,
    pathname
  );

  // create the full path where this will be saved (normalize for windowz)
  let filePath: string;

  if (dir + '/' === outputTarget.dir + '/') {
    // this is the root of the output target directory
    // use the configured index.html
    const basename = outputTarget.indexHtml.substr(dir.length + 1);
    filePath = pathJoin(config, dir, basename);

  } else {
    filePath = pathJoin(config, dir, `index.html`);
  }

  return filePath + '.prerendererd';
}
