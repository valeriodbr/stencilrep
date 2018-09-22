import * as d from '../../declarations';
import * as puppeteer from 'puppeteer'; // for types only
import { catchError } from '../util';
import { parseHtmlToDocument } from '@stencil/core/mock-doc';


export async function prerender(config: d.Config, outputTarget: d.OutputTargetWww, buildCtx: d.BuildCtx, browser: puppeteer.Browser, results: d.PrerenderResults) {
  try {
    // start up a new page
    const newPageTimespan = config.logger.createTimeSpan(`new page started: ${results.url}`, true);
    const page = await browser.newPage();
    newPageTimespan.finish(`new page finished: ${results.url}`);

    const appLoaded = createAppLoadListener(page);

    addPageListeners(page, results);

    await interceptRequests(config, outputTarget, buildCtx, page, results);

    if (outputTarget.pageAnalysis) {
      await Promise.all([
        page.coverage.startJSCoverage(),
        page.coverage.startCSSCoverage()
      ]);
    }

    const gotoTimespan = config.logger.createTimeSpan(`goto started: ${results.url}`, true);
    await page.goto(results.url, {
      waitUntil: 'load',
      timeout: 15000
    });
    gotoTimespan.finish(`goto finished: ${results.url}`);

    await appLoaded;

    if (outputTarget.pageAnalysis) {
      const [jsCoverage, cssCoverage, metrics] = await Promise.all([
        page.coverage.stopJSCoverage(),
        page.coverage.stopCSSCoverage(),
        page.metrics()
      ]);

      results.coverage = {
        css: calulateCoverage(cssCoverage),
        js: calulateCoverage(jsCoverage)
      };

      results.metrics = {
        jsEventListeners: metrics.JSEventListeners,
        nodes: metrics.Nodes,
        layoutCount: metrics.LayoutCount,
        recalcStyleCount: metrics.RecalcStyleCount,
        layoutDuration: metrics.LayoutDuration,
        recalcStyleDuration: metrics.RecalcStyleDuration,
        scriptDuration: metrics.ScriptDuration,
        taskDuration: metrics.TaskDuration,
        jsHeapUsedSize: metrics.JSHeapUsedSize,
        jsHeapTotalSize: metrics.JSHeapTotalSize,
      };
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
    collapseWhitespace: (outputTarget.collapseWhitespace !== false),
    pathQuery: outputTarget.prerenderPathQuery,
    pathHash: outputTarget.prerenderPathHash
  };

  const extractData: ExtractData = await page.evaluate((pageUpdateConfig: PageUpdateConfig) => {
    // BROWSER CONTEXT

    const url = new URL(location.href);

    // data object to build up and pass back from the browser to main
    const extractData: ExtractData = {
      html: '',
      url: url.href,
      path: url.pathname,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      stencilAppLoadDuration: (window as StencilWindow).stencilAppLoadDuration
    };

    if (pageUpdateConfig.pathQuery) {
      extractData.path += pageUpdateConfig.pathQuery;
    }

    if (pageUpdateConfig.pathHash) {
      extractData.path += pageUpdateConfig.pathHash;
    }

    const WHITESPACE_SENSITIVE_TAGS = ['PRE', 'SCRIPT', 'STYLE', 'TEXTAREA'];

    function getResolvedUrl(elm: Node, href: string) {
      if (href) {
        const url = new URL(href);

        if (url.host === location.host) {
          let rtn = url.pathname;
          if (pageUpdateConfig.pathQuery) {
            rtn += pageUpdateConfig.pathQuery;
          }
          if (pageUpdateConfig.pathHash) {
            rtn += pageUpdateConfig.pathHash;
          }
          (elm as HTMLScriptElement).setAttribute('data-resolved-path', rtn);
        }
      }
    }

    function optimize(node: Node) {
      if (!node) {
        return;
      }

      if (node.nodeType === 1) {
        // element
        for (let i = node.childNodes.length - 1; i >= 0; i--) {
          optimize(node.childNodes[i]);
        }

        const tagName = (node as HTMLAnchorElement).nodeName.toLowerCase();

        if (tagName === 'a') {
          getResolvedUrl(node, (node as HTMLAnchorElement).href);

        } else if (tagName === 'script') {
          getResolvedUrl(node, (node as HTMLScriptElement).src);

        } else if (tagName === 'link' && (node as HTMLLinkElement).rel.toLowerCase() === 'stylesheet') {
          getResolvedUrl(node, (node as HTMLLinkElement).href);
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
      }
    }

    if (document.documentElement) {
      // let's do this
      optimize(document.documentElement);

      if (!document.documentElement.hasAttribute('lang')) {
        document.documentElement.setAttribute('lang', 'en-US');
      }

      if (!document.documentElement.hasAttribute('dir')) {
        document.documentElement.setAttribute('dir', 'ltr');
      }
    }

    if (document.head) {
      // make sure the meta charset is first element in document.head
      let metaCharset = document.head.querySelector('meta[charset]');
      if (metaCharset) {
        if (document.head.firstElementChild !== metaCharset) {
          metaCharset.remove();
          document.head.insertBefore(metaCharset, document.head.firstChild);
        }

      } else {
        metaCharset = document.createElement('meta');
        metaCharset.setAttribute('charset', 'utf-8');
        document.head.insertBefore(metaCharset, document.head.firstChild);
      }

      // make sure sure we've got the http-equiv="X-UA-Compatible" IE=Edge meta tag added
      let metaUaCompatible = document.head.querySelector('meta[http-equiv="X-UA-Compatible"]');
      if (!metaUaCompatible) {
        metaUaCompatible = document.createElement('meta');
        metaUaCompatible.setAttribute('http-equiv', 'X-UA-Compatible');
        metaUaCompatible.setAttribute('content', 'IE=Edge');
        document.head.insertBefore(metaUaCompatible, metaCharset.nextSibling);
      }
    }

    if (document.doctype) {
      extractData.html = new XMLSerializer().serializeToString(document.doctype).toLowerCase();
    } else {
      extractData.html = '<!doctype html>';
    }

    if (document.documentElement) {
      extractData.html += document.documentElement.outerHTML;
    }

    return extractData;

  }, pageUpdateConfig);

  results.document = parseHtmlToDocument(extractData.html);

  results.url = extractData.url;
  results.pathname = extractData.pathname;
  results.search = extractData.search;
  results.hash = extractData.hash;

  if (results.metrics) {
    results.metrics.appLoadDuration = extractData.stencilAppLoadDuration;
  }
}


function calulateCoverage(entries: puppeteer.CoverageEntry[]) {
  return entries.map(entry => {
    const converageEntry: d.PageCoverageEntry = {
      url: entry.url,
      totalBytes: entry.text.length,
      usedBytes: 0
    };

    for (const range of entry.ranges) {
      converageEntry.usedBytes += range.end - range.start - 1;
    }

    return converageEntry;
  });
}


interface PageUpdateConfig {
  collapseWhitespace: boolean;
  pathQuery?: boolean;
  pathHash?: boolean;
}


interface StencilWindow {
  stencilAppLoadDuration?: number;
  stencilWindowInit?: number;
}


interface ExtractData {
  html: string;
  stencilAppLoadDuration: number;
  url: string;
  path: string;
  pathname: string;
  search: string;
  hash: string;
}


async function interceptRequests(config: d.Config, outputTarget: d.OutputTargetWww, buildCtx: d.BuildCtx, page: puppeteer.Page, results: d.PrerenderResults) {
  await page.setRequestInterception(true);

  page.on('request', async (interceptedRequest) => {
    let url = interceptedRequest.url();
    const resourceType = interceptedRequest.resourceType();

    if (resourceType !== 'document') {
      results.requests.push({
        url: url,
        type: resourceType,
        status: null
      });
    }

    const parsedUrl = config.sys.url.parse(url);

    if (shouldAbort(outputTarget, parsedUrl, resourceType)) {
      await interceptedRequest.abort();

    } else if (isCoreScript(buildCtx, parsedUrl, resourceType)) {
      url = url.replace(buildCtx.coreFileName, buildCtx.coreSsrFileName);

      await interceptedRequest.continue({
        url: url
      });

    } else {
      await interceptedRequest.continue();
    }
  });
}


function isCoreScript(buildCtx: d.BuildCtx, parsedUrl: d.Url, resourceType: puppeteer.ResourceType) {
  if (resourceType !== 'script') {
    return false;
  }

  const pathSplit = parsedUrl.pathname.split('/');
  const fileName = pathSplit[pathSplit.length - 1];

  return (fileName === buildCtx.coreFileName);
}


function shouldAbort(outputTargets: d.OutputTargetWww, parsedUrl: d.Url, resourceType: puppeteer.ResourceType) {
  if (resourceType === 'image') {
    return true;
  }

  if (resourceType === 'media') {
    return true;
  }

  if (resourceType === 'font') {
    return true;
  }

  if (resourceType === 'manifest') {
    return true;
  }

  if (resourceType === 'websocket') {
    return true;
  }

  if (parsedUrl.path.includes('data:image')) {
    return true;
  }

  return outputTargets.prerenderAbortRequests.some(abortReq => {
    if (typeof abortReq.domain === 'string') {
      return parsedUrl.host.includes(abortReq.domain);
    }

    return false;
  });
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

  page.on('requestfailed', rsp => {
    const url = results.requests.find(r => r.url === rsp.url());
    if (url) {
      url.status = 'failed';
    }
  });

  page.on('requestfinished', rsp => {
    if (rsp.resourceType() === 'document') {
      return;
    }
    const url = results.requests.find(r => r.url === rsp.url());
    if (url) {
      url.status = 'success';
    }
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
