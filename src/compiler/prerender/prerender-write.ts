import * as d from '../../declarations';
import { buildError, catchError, pathJoin } from '../util';
import { serializeNodeToHtml } from '@stencil/core/mock-doc';


export async function writePrerenderResults(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, outputTarget: d.OutputTargetWww, results: d.PrerenderResults) {
  try {
    results.html = serializeNodeToHtml(results.document as any, {
      pretty: outputTarget.prettyHtml
    });

    for (let i = 0; i < 5; i++) {
      const success = await writePrerenderContent(config, compilerCtx, buildCtx, outputTarget, results);
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


async function writePrerenderContent(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, outputTarget: d.OutputTargetWww, results: d.PrerenderResults) {
  let success = false;

  try {
    // create the full path where this will be saved
    const filePath = getWritePathFromUrl(config, outputTarget, results.pathname);

    // add the prerender html content it to our collection of
    // files that need to be saved when we're all ready
    // do NOT use the cache here, best to not use up that memory
    await compilerCtx.fs.writeFile(filePath, results.html, { useCache: false });

    if (outputTarget.pageAnalysis && outputTarget.pageAnalysis.dir) {
      results.metrics.htmlBytes = results.html.length;
      await writePageAnalysis(config, compilerCtx, outputTarget, results);
    }

    // write the files now
    // and since we're not using cache it'll free up memory
    await compilerCtx.fs.commit();

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


async function writePageAnalysis(config: d.Config, compilerCtx: d.CompilerCtx, outputTarget: d.OutputTargetWww, results: d.PrerenderResults) {
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

  return filePath;
}
