import * as d from '../../declarations';
import * as puppeteer from 'puppeteer'; // for types only
import { catchError } from '../util';
import { interceptRequests } from './prerender-requests';
import { startPageAnalysis, stopPageAnalysis } from './page-analysis';
import { parseHtmlToDocument } from '@stencil/core/mock-doc';


export async function prerender(config: d.Config, outputTarget: d.OutputTargetWww, buildCtx: d.BuildCtx, devServerHost: string, browser: puppeteer.Browser, results: d.PrerenderResults) {
  try {
    // start up a new page
    const newPageTimespan = config.logger.createTimeSpan(`new page started: ${results.url}`, true);
    const page = await browser.newPage();
    newPageTimespan.finish(`new page finished: ${results.url}`);

    await createAppLoadListener(page);

    addPageListeners(page, results);

    await interceptRequests(config, outputTarget, buildCtx, devServerHost, page, results);

    if (outputTarget.pageAnalysis) {
      await startPageAnalysis(page);
    }

    const gotoTimespan = config.logger.createTimeSpan(`goto started: ${results.url}`, true);
    await page.goto(results.url, {
      waitUntil: 'load',
      timeout: 15000
    });
    gotoTimespan.finish(`goto finished: ${results.url}`);

    const isStencilApp = await page.evaluate(() => {
      return !!((window as StencilWindow).stencilApp);
    });

    if (isStencilApp) {
      await page.waitForFunction('window.stencilAppLoadDuration');
    }

    if (outputTarget.pageAnalysis) {
      await stopPageAnalysis(config, devServerHost, page, results);
    }

    const processPageTimespan = config.logger.createTimeSpan(`process page started: ${results.url}`, true);
    await processPage(outputTarget, page, results);
    processPageTimespan.finish(`process page finished: ${results.url}`);

    await page.close();

  } catch (e) {
    catchError(results.diagnostics, e);
  }
}


async function processPage(outputTarget: d.OutputTargetWww, page: puppeteer.Page, results: d.PrerenderResults) {
  const pageUpdateConfig: PageUpdateConfig = {
    pathQuery: outputTarget.prerenderPathQuery,
    pathHash: outputTarget.prerenderPathHash
  };

  const pageData: PageData = await page.evaluate((pageUpdateConfig: PageUpdateConfig) => {
    // BROWSER CONTEXT

    const locationUrl = new URL(location.href);

    // data object to build up and pass back from the browser to main
    const pageData: PageData = {
      html: '',
      url: locationUrl.href,
      path: locationUrl.pathname,
      stencilAppLoadDuration: (window as StencilWindow).stencilAppLoadDuration
    };

    if (pageUpdateConfig.pathQuery || pageUpdateConfig.pathHash) {
      pageData.pathname = locationUrl.pathname;

      if (pageUpdateConfig.pathQuery) {
        pageData.path += locationUrl.search;
        pageData.search = locationUrl.search;
      }

      if (pageUpdateConfig.pathHash) {
        pageData.path += locationUrl.hash;
        pageData.hash = locationUrl.hash;
      }
    }

    function setElementResolvedPath(elm: Node, href: string) {
      if (href) {
        const url = new URL(href);

        if (url.host === locationUrl.host) {
          let path = url.pathname;
          if (pageUpdateConfig.pathQuery) {
            path += url.search;
          }
          if (pageUpdateConfig.pathHash) {
            path += url.hash;
          }
          (elm as HTMLScriptElement).setAttribute('data-resolved-path', path);
        }
      }
    }

    function setResolvedPaths(elm: Element) {
      if (elm.nodeType === 1) {
        // element
        const tagName = elm.tagName.toLowerCase();

        if (tagName === 'a') {
          setElementResolvedPath(elm, (elm as HTMLAnchorElement).href);

        } else if (tagName === 'script') {
          setElementResolvedPath(elm, (elm as HTMLScriptElement).src);

        } else if (tagName === 'link' && (elm as HTMLLinkElement).rel.toLowerCase() === 'stylesheet') {
          setElementResolvedPath(elm, (elm as HTMLLinkElement).href);
        }
      }

      if (elm.shadowRoot && elm.shadowRoot.nodeType === 11) {
        setResolvedPaths(elm.shadowRoot as any);
      }

      for (let i = 0, l = elm.children.length; i < l; i++) {
        setResolvedPaths(elm.children[i]);
      }
    }

    if (document.documentElement) {
      setResolvedPaths(document.documentElement);
      pageData.html += document.documentElement.outerHTML;
    }

    return pageData;

  }, pageUpdateConfig);

  results.document = parseHtmlToDocument(pageData.html);

  results.url = pageData.url;
  results.path = pageData.path;
  results.pathname = pageData.pathname;
  results.search = pageData.search;
  results.hash = pageData.hash;

  if (results.metrics) {
    results.metrics.appLoadDuration = pageData.stencilAppLoadDuration;
  }
}


function addPageListeners(page: puppeteer.Page, results: d.PrerenderResults) {
  page.on('pageerror', (err: any) => {
    if (err) {
      if (typeof err === 'string') {
        results.pageErrors.push({
          message: err
        });

      } else if (err.message) {
        results.pageErrors.push({
          message: err.message,
          stack: err.stack
        });
      }
    }
  });

  page.on('error', err => {
    catchError(results.diagnostics, err);
  });
}


async function createAppLoadListener(page: puppeteer.Page) {
  // when the page creates, let's add a listener to the window
  // the "appload" event is fired by stencil when it has completed
  await page.evaluateOnNewDocument(() => {
    (window as StencilWindow).stencilWindowInit = Date.now();

    window.addEventListener('appload', () => {
      (window as StencilWindow).stencilAppLoadDuration = (Date.now() - (window as StencilWindow).stencilWindowInit);
    });
  });
}


export async function startPuppeteerBrowser(config: d.Config) {
  const ptr = config.sys.lazyRequire.require('puppeteer');

  const launchOpts: puppeteer.LaunchOptions = {
    ignoreHTTPSErrors: true,
    headless: true
  };

  const browser = await ptr.launch(launchOpts) as puppeteer.Browser;
  return browser;
}


export async function closePuppeteerBrowser(browser: puppeteer.Browser) {
  if (browser) {
    try {
      await browser.close();
    } catch (e) {}
  }
}


export async function ensurePuppeteer(config: d.Config) {
  await config.sys.lazyRequire.ensure(config.logger, config.rootDir, ['puppeteer']);
}


interface PageUpdateConfig {
  pathQuery: boolean;
  pathHash: boolean;
}


interface StencilWindow {
  stencilApp?: boolean;
  stencilAppLoadDuration?: number;
  stencilWindowInit?: number;
}


interface PageData {
  html: string;
  stencilAppLoadDuration: number;
  url: string;
  path: string;
  pathname?: string;
  search?: string;
  hash?: string;
}
