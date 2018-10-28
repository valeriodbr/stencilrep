import * as d from '../../declarations';
import { pathJoin } from '../util';


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

  return filePath + PRERENDERED_SUFFIX;
}

export const PRERENDERED_SUFFIX = `.prerendered`;


export function normalizePrerenderPaths(config: d.Config, outputTarget: d.OutputTargetWww, inputPaths: string[]) {
  const outputPaths: string[] = [];

  if (Array.isArray(inputPaths)) {
    inputPaths.forEach(inputPath => {
      const outputPath = normalizePrerenderPath(config, outputTarget, inputPath);
      if (typeof outputPath === 'string') {
        if (!outputPaths.includes(outputPath)) {
          outputPaths.push(outputPath);
        }
      }
    });
  }

  return outputPaths;
}


export function normalizePrerenderPath(config: d.Config, outputTarget: d.OutputTargetWww, path: string) {
  if (typeof path !== 'string') {
    return null;
  }

  if (!outputTarget.prerenderPathHash || !outputTarget.prerenderPathQuery) {
    const parsedUrl = config.sys.url.parse(path);

    const hash = (parsedUrl.hash || '').split('?')[0];
    const search = (parsedUrl.search || '').split('#')[0];

    path = path.split('?')[0].split('#')[0];

    if (search) {
      path += search;
    }

    if (hash) {
      path += hash;
    }
  }

  return path;
}
