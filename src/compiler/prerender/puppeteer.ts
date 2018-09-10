import * as d from '../../declarations';
import * as puppeteer from 'puppeteer'; // for types only
import { catchError } from '../util';
import { parse } from 'parse5';
import { serialize } from '../../testing/mock-doc/serialize-node';


export async function prerender(config: d.Config, outputTarget: d.OutputTargetWww, buildCtx: d.BuildCtx, browser: puppeteer.Browser, url: string) {
  const results: d.PrerenderResults = {
    url: url,
    html: null,
    anchorUrls: [],
    diagnostics: [],
    pageErrors: [],
    requestFailures: [],
    requestSuccesses: [],
    metrics: {}
  };

  try {
    // start up a new page
    const page = await browser.newPage();

    const appLoaded = createAppLoadListener(page);

    addPageListeners(page, results);

    await interceptRequests(config, outputTarget, buildCtx, page);

    await page.goto(url, {
      waitUntil: 'load'
    });

    await appLoaded;

    await processPage(outputTarget, page, results);

    await page.close();

  } catch (e) {
    catchError(results.diagnostics, e);
  }

  return results;
}


async function processPage(outputTarget: d.OutputTargetWww, page: puppeteer.Page, results: d.PrerenderResults) {
  await getMetrics(page, results);

  const pageUpdateConfig: PageUpdateConfig = {
    collapseWhitespace: (outputTarget.collapseWhitespace !== false),
    removeHtmlComments: (outputTarget.removeHtmlComments !== false)
  };

  const extractData = await page.evaluate((pageUpdateConfig: PageUpdateConfig) => {
    // BROWSER CONTEXT

    // data object to build up and pass back from the browser to main
    const extractData: ExtractData = {
      anchorUrls: [],
      stencilAppLoadDuration: (window as StencilWindow).stencilAppLoadDuration
    };

    const WHITESPACE_SENSITIVE_TAGS = ['PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'];

    function optimize(node: Node) {
      if (node.nodeType === 1) {
        // element
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
          optimize(node.childNodes[i]);
        }

        if (node.nodeName === 'A') {
          // anchor element
          const href = (node as HTMLAnchorElement).href.trim();
          if (href && !href.startsWith('data:') && !extractData.anchorUrls.includes(href)) {
            // collect anchor element
            extractData.anchorUrls.push(href);
          }
        }

        if ((node as HTMLElement).getAttribute('class') === '') {
          (node as HTMLElement).removeAttribute('class');
        }

        if ((node as HTMLElement).getAttribute('style') === '') {
          (node as HTMLElement).removeAttribute('style');
        }

      } else if (node.nodeType === 3) {
        // text node
        if (pageUpdateConfig.collapseWhitespace) {
          // collapse whitespace
          if (!WHITESPACE_SENSITIVE_TAGS.includes(node.parentElement.tagName)) {
            if (node.nodeValue.trim() === '') {
              if (node.previousSibling && node.previousSibling.nodeType === 3 && node.previousSibling.nodeValue.trim() === '') {
                node.nodeValue = ' ';
              } else {
                (node as any).remove();
              }
            }
          }
        }

      } else if (node.nodeType === 8) {
        // comment node
        if (pageUpdateConfig.removeHtmlComments) {
          // remove comment node
          (node as any).remove();
        }
      }
    }

    // let's do this
    optimize(document.documentElement);

    // make sure the meta charset is first
    const findMetaCharset = document.head.querySelector('meta[charset]');
    if (findMetaCharset) {
      findMetaCharset.remove();
    }
    const metaCharset = document.createElement('meta');
    metaCharset.setAttribute('charset', 'utf-8');
    document.head.insertBefore(metaCharset, document.head.firstChild);

    return extractData;

  }, pageUpdateConfig);

  results.anchorUrls = extractData.anchorUrls;
  results.metrics.appLoadDuration = extractData.stencilAppLoadDuration;

  results.html = await page.content();

  if (outputTarget.prettyHtml) {
    const doc = parse(results.html);
    results.html = serialize(doc, {
      pretty: true
    });
  }
}


async function getMetrics(page: puppeteer.Page, results: d.PrerenderResults) {
  const metrics = await page.metrics();

  if (metrics) {
    results.metrics.jsEventListeners = metrics.JSEventListeners;
    results.metrics.nodes = metrics.Nodes;
    results.metrics.layoutCount = metrics.LayoutCount;
    results.metrics.recalcStyleCount = metrics.RecalcStyleCount;
    results.metrics.layoutDuration = metrics.LayoutDuration;
    results.metrics.recalcStyleDuration = metrics.RecalcStyleDuration;
    results.metrics.scriptDuration = metrics.ScriptDuration;
    results.metrics.taskDuration = metrics.TaskDuration;
    results.metrics.jsHeapUsedSize = metrics.JSHeapUsedSize;
    results.metrics.jsHeapTotalSize = metrics.JSHeapTotalSize;
  }
}


interface PageUpdateConfig {
  collapseWhitespace: boolean;
  removeHtmlComments: boolean;
}


interface StencilWindow {
  stencilAppLoadDuration?: number;
  stencilWindowInit?: number;
}


interface ExtractData {
  anchorUrls: string[];
  stencilAppLoadDuration: number;
}


async function interceptRequests(config: d.Config, outputTarget: d.OutputTargetWww, buildCtx: d.BuildCtx, page: puppeteer.Page) {
  await page.setRequestInterception(true);

  page.on('request', async (interceptedRequest) => {
    let url = interceptedRequest.url();
    const parsedUrl = config.sys.url.parse(url);

    if (shouldAbort(outputTarget, parsedUrl)) {
      await interceptedRequest.abort();
      return;
    }

    const pathSplit = parsedUrl.pathname.split('/');
    const fileName = pathSplit[pathSplit.length - 1];

    if (fileName === buildCtx.coreFileName) {
      url = url.replace(buildCtx.coreFileName, buildCtx.coreSsrFileName);

      await interceptedRequest.continue({
        url: url
      });

    } else {
      await interceptedRequest.continue();
    }
  });
}

function shouldAbort(outputTargets: d.OutputTargetWww, parsedUrl: d.Url) {
  return outputTargets.prerenderAbortRequests.some(abortReq => {
    if (typeof abortReq.domain === 'string') {
      return parsedUrl.host.includes(abortReq.domain);
    }

    return false;
  });
}


function addPageListeners(page: puppeteer.Page, results: d.PrerenderResults) {
  page.on('pageerror', err => {
    results.pageErrors.push(err);
  });

  page.on('error', err => {
    catchError(results.diagnostics, err);
  });

  page.on('requestfailed', rsp => {
    results.requestFailures.push(rsp.url());
  });

  page.on('requestfinished', rsp => {
    results.requestSuccesses.push(rsp.url());
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

  return page.waitForFunction('window.stencilAppLoadDuration');
}


export async function startPuppeteerBrowser(config: d.Config) {
  const ptr = config.sys.lazyRequire.require('puppeteer');

  const launchOpts: puppeteer.LaunchOptions = {
    ignoreHTTPSErrors: true,
    // args: config.testing.browserArgs,
    headless: false,
    // slowMo: config.testing.browserSlowMo
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
