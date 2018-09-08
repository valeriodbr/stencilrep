import * as d from '../../declarations';
import { buildError, catchError, hasError, pathJoin } from '../util';


export async function writePrerenderResults(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, outputTarget: d.OutputTargetWww, results: d.PrerenderResults) {
  const anchorUrls: string[] = [];

  console.log(results);

  if (typeof results.html !== 'string') {
    const error = buildError(results.diagnostics);
    error.messageText = `invalid prerendered html`;
  }

  buildCtx.diagnostics.push(...results.diagnostics);

  if (hasError(results.diagnostics)) {
    return anchorUrls;
  }

  try {
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

  return anchorUrls;
}


async function writePrerenderContent(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, outputTarget: d.OutputTargetWww, results: d.HydrateResults) {
  let success = false;

  // create the full path where this will be saved
  const filePath = getWritePathFromUrl(config, outputTarget, results.url);

  try {
    // add the prerender html content it to our collection of
    // files that need to be saved when we're all ready
    // do NOT use the cache here, best to not use up that memory
    await compilerCtx.fs.writeFile(filePath, results.html, { useCache: false });

    // write the files now
    // and since we're not using cache it'll free up memory
    await compilerCtx.fs.commit();

    // sweet, all good
    success = true;

  } catch (e) {
    // gah!! what!!
    const diagnostic = buildError(buildCtx.diagnostics);
    diagnostic.header = `Prerender Write Error`;
    diagnostic.messageText = `writePrerenderDest, url: ${results.url}, filePath: ${filePath}, ${e}`;
  }

  return success;
}


export function getWritePathFromUrl(config: d.Config, outputTarget: d.OutputTargetWww, url: string) {
  const parsedUrl = config.sys.url.parse(url);

  let pathName = parsedUrl.pathname;
  if (pathName.startsWith(outputTarget.baseUrl)) {
    pathName = pathName.substring(outputTarget.baseUrl.length);

  } else if (outputTarget.baseUrl === pathName + '/') {
    pathName = '/';
  }

  // figure out the directory where this file will be saved
  const dir = pathJoin(
    config,
    outputTarget.dir,
    pathName
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
