import * as d from '../../declarations';
import { catchError, pathJoin } from '../util';


export async function inlineExternalAssets(
  config: d.Config,
  compilerCtx: d.CompilerCtx,
  outputTarget: d.OutputTargetHydrate,
  results: d.PrerenderResults
) {
  const linkElements: HTMLLinkElement[] = [];
  const scriptElements: HTMLScriptElement[] = [];

  extractLinkAndScriptElements(linkElements, scriptElements, results.document.documentElement);

  const promises: Promise<any>[] = [];

  for (let i = 0; i < linkElements.length; i++) {
    promises.push(inlineStyle(config, compilerCtx, outputTarget, results, linkElements[i] as any));
  }

  for (let i = 0; i < scriptElements.length; i++) {
    promises.push(inlineScript(config, compilerCtx, outputTarget, results, scriptElements[i] as any));
  }

  await Promise.all(promises);
}


function extractLinkAndScriptElements(linkElements: HTMLLinkElement[], scriptElements: HTMLScriptElement[], elm: HTMLElement) {
  if (elm) {

    if (elm.nodeName === 'SCRIPT') {
      if (elm.hasAttribute('data-resolved-url')) {
        scriptElements.push(elm as any);
      }

    } else if (elm.nodeName === 'LINK') {
      if ((elm as HTMLLinkElement).rel.toLowerCase() === 'stylesheet') {
        if (elm.hasAttribute('data-resolved-url')) {
          linkElements.push(elm as any);
        }
      }

    } else {
      const children = elm.children as any;
      if (children) {
        for (let i = 0; i < children.length; i++) {
          extractLinkAndScriptElements(linkElements, scriptElements, children[i]);
        }
      }
    }
  }
}


async function inlineStyle(config: d.Config, compilerCtx: d.CompilerCtx, outputTarget: d.OutputTargetHydrate, results: d.PrerenderResults, linkElm: HTMLLinkElement) {
  try {
    const content = await getAssetContent(config, compilerCtx, outputTarget, results.url, linkElm.href);
    if (!content) {
      return;
    }

    config.logger.debug(`optimize ${results.url}, inline style: ${config.sys.url.parse(linkElm.href).pathname}`);

    const styleElm = results.document.createElement('style');
    styleElm.innerHTML = content;

    linkElm.parentNode.insertBefore(styleElm, linkElm);
    linkElm.parentNode.removeChild(linkElm);

  } catch (e) {
    catchError(results.diagnostics, e);
  }
}


async function inlineScript(config: d.Config, compilerCtx: d.CompilerCtx, outputTarget: d.OutputTargetHydrate, results: d.PrerenderResults, scriptElm: HTMLScriptElement) {
  try {
    const content = await getAssetContent(config, compilerCtx, outputTarget, results.url, scriptElm.src);
    if (!content) {
      return;
    }

    config.logger.debug(`optimize ${results.url}, inline script: ${scriptElm.src}`);

    scriptElm.innerHTML = content;
    scriptElm.removeAttribute('src');

  } catch (e) {
    catchError(results.diagnostics, e);
  }
}


async function getAssetContent(config: d.Config, ctx: d.CompilerCtx, outputTarget: d.OutputTargetHydrate, windowLocationPath: string, assetUrl: string) {
  if (typeof assetUrl !== 'string' || assetUrl.trim() === '') {
    return null;
  }

  // figure out the url's so we can check the hostnames
  const fromUrl = config.sys.url.parse(windowLocationPath);
  const toUrl = config.sys.url.parse(assetUrl);

  if (fromUrl.hostname !== toUrl.hostname) {
    // not the same hostname, so we wouldn't have the file content
    return null;
  }

  // figure out the local file path
  const filePath = getFilePathFromUrl(config, outputTarget, fromUrl, toUrl);

  // doesn't look like we've got it cached in app files
  try {
    // try looking it up directly
    const content = await ctx.fs.readFile(filePath);

    // rough estimate of size
    const fileSize = content.length;

    if (fileSize > outputTarget.inlineAssetsMaxSize) {
      // welp, considered too big, don't inline
      return null;
    }

    return content;

  } catch (e) {
    // never found the content for this file
    return null;
  }
}


export function getFilePathFromUrl(config: d.Config, outputTarget: d.OutputTargetHydrate, fromUrl: d.Url, toUrl: d.Url) {
  const resolvedUrl = '.' + config.sys.url.resolve(fromUrl.pathname, toUrl.pathname);
  return pathJoin(config, outputTarget.dir, resolvedUrl);
}
