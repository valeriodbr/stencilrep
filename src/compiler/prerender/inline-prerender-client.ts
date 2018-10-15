import * as d from '../../declarations';
import { buildError, catchError, normalizePath } from '../util';
import { getLoaderFileName } from '../app/app-file-naming';


export async function inlinePrerenderClient(
  config: d.Config,
  buildCtx: d.BuildCtx,
  outputTarget: d.OutputTargetWww,
  doc: HTMLDocument
) {
  try {
    // create the script url we'll be looking for
    const loaderFileName = getLoaderFileName(config);

    // find the external loader script
    // which is usually in the <head> and a pretty small external file
    // now that we're prerendering the html, and all the styles and html
    // will get hardcoded in the output, it's safe to now put the
    // loader script at the bottom of <body>
    const loaderScriptElm = findExternalLoaderScript(config.srcIndexHtml, buildCtx.diagnostics, doc, loaderFileName);

    if (loaderScriptElm) {
      loaderScriptElm.setAttribute('id', 'stencil-loader-script');
      await preparePrerenderClient(buildCtx, doc);
      await prepareLoaderScriptElm(config, buildCtx, outputTarget, doc, loaderScriptElm);
    }

  } catch (e) {
    catchError(buildCtx.diagnostics, e);
  }
}


async function preparePrerenderClient(buildCtx: d.BuildCtx, doc: Document) {
  const prerenderScriptElm = doc.createElement('script');
  prerenderScriptElm.setAttribute('id', 'prerender-prepare-script');
  prerenderScriptElm.innerHTML = `
    /* prerender prepare: ${buildCtx.timestamp} */
    window.stencilApp = true;
    navigator.userAgent = 'prerender';
  `;
  doc.body.appendChild(prerenderScriptElm);
}


async function prepareLoaderScriptElm(config: d.Config, buildCtx: d.BuildCtx, outputTarget: d.OutputTargetWww, doc: HTMLDocument, loaderScriptElm: HTMLScriptElement) {
  const loaderBuildId = 'loader';
  const appLoaderBuild = buildCtx.appBuilds.get(loaderBuildId);
  if (!appLoaderBuild || typeof appLoaderBuild.content !== 'string') {
    throw new Error(`unable to find app loader build: ${loaderBuildId}`);
  }

  // remove the external src
  loaderScriptElm.removeAttribute('src');

  // only add the data-resources-url attr if we don't already have one
  const existingResourcesUrlAttr = loaderScriptElm.getAttribute('data-resources-url');
  if (!existingResourcesUrlAttr) {
    const resourcesUrl = setDataResourcesUrlAttr(config, outputTarget);

    // add the resource path data attribute
    loaderScriptElm.setAttribute('data-resources-url', resourcesUrl);
  }

  // inline the js content
  loaderScriptElm.innerHTML = appLoaderBuild.content;

  // remove the script element from where it's currently at in the dom
  loaderScriptElm.parentNode.removeChild(loaderScriptElm);

  // place it back in the dom, but at the bottom of the body
  doc.body.appendChild(loaderScriptElm);
}


function findExternalLoaderScript(srcIndexHtml: string, diagnostics: d.Diagnostic[], doc: Document, loaderFileName: string) {
  const scriptElements = doc.querySelectorAll('script[src]') as NodeListOf<HTMLScriptElement>;

  for (let i = 0; i < scriptElements.length; i++) {
    const src = scriptElements[i].getAttribute('src');

    if (isLoaderScriptSrc(loaderFileName, src)) {
      // this is a script element with a src attribute which is
      // pointing to the app's external loader script
      // remove the script from the document, be gone with you
      return scriptElements[i];
    }
  }

  const diagnostic = buildError(diagnostics);
  diagnostic.header = `Missing stencil loader script`;
  diagnostic.messageText = `The "${srcIndexHtml}" file is missing the "${loaderFileName}" script. The loader script is required to load the stencil application.`;

  return null;
}


export function isLoaderScriptSrc(loaderFileName: string, scriptSrc: string) {
  try {
    if (typeof scriptSrc !== 'string' || scriptSrc.trim() === '') {
      return false;
    }

    scriptSrc = scriptSrc.toLowerCase();

    if (scriptSrc.startsWith('http') || scriptSrc.startsWith('file')) {
      return false;
    }

    scriptSrc = scriptSrc.split('?')[0].split('#')[0];
    loaderFileName = loaderFileName.split('?')[0].split('#')[0];

    if (scriptSrc === loaderFileName || scriptSrc.endsWith('/' + loaderFileName)) {
      return true;
    }

  } catch (e) {}

  return false;
}


export function setDataResourcesUrlAttr(config: d.Config, outputTarget: d.OutputTargetHydrate) {
  let resourcesUrl = outputTarget.resourcesUrl;

  if (!resourcesUrl) {
    resourcesUrl = config.sys.path.join(outputTarget.buildDir, config.fsNamespace);
    resourcesUrl = normalizePath(config.sys.path.relative(outputTarget.dir, resourcesUrl));

    if (!resourcesUrl.startsWith('/')) {
      resourcesUrl = '/' + resourcesUrl;
    }

    if (!resourcesUrl.endsWith('/')) {
      resourcesUrl = resourcesUrl + '/';
    }

    resourcesUrl = outputTarget.baseUrl + resourcesUrl.substring(1);
  }

  return resourcesUrl;
}
