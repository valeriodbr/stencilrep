import * as d from '../../declarations';
import { catchError, hasError, normalizePath } from '../util';
import { getWritePathFromUrl, normalizePrerenderPaths } from './prerender-normalize-path';
import { prepareIndexHtmlBeforePrerender } from './prepare-index-html';
import * as puppeteer from 'puppeteer'; // for types only


export class PrerenderCtx {
  private browser: puppeteer.Browser = null;
  private devServerOrigin: string;
  private devServerHost: string;
  private prerenderingDone: Function;

  constructor(public config: d.Config, public compilerCtx: d.CompilerCtx, public buildCtx: d.BuildCtx, public outputTarget: d.OutputTargetWww, public processor: d.PrerenderProcessor) {
    const devServerUrl = config.sys.url.parse(config.devServer.browserUrl);
    this.devServerHost = devServerUrl.host;
    this.devServerOrigin = `http://${this.devServerHost}`;
  }

  async startBrowser() {
    // let's make sure they have what we need installed
    await ensurePuppeteer(this.config);

    // fire up the puppeteer browser
    this.browser = await startPuppeteerBrowser(this.config);
  }

  async prepareIndexHtml() {
    await prepareIndexHtmlBeforePrerender(this.config, this.compilerCtx, this.buildCtx, this.outputTarget);
  }

  async prerenderAll(paths: string[]) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return Promise.resolve();
    }

    // promise resolves when all locations have been prerendered
    await new Promise(async (prerenderingDone) => {
      this.prerenderingDone = prerenderingDone;

      this.compilerCtx.events.subscribe('prerenderedLocation', this.drainQueue.bind(this));

      // add these paths to our array of pending paths
      await this.queue('#entry', paths);

      // let's kick it off
      this.next();
    });
  }

  async queue(source: string, paths: string[]) {
    const normalizedPaths = normalizePrerenderPaths(this.config, this.outputTarget, paths);
    await this.processor.queue(source, normalizedPaths);
  }

  async next() {
    process.nextTick(() => {
      this.compilerCtx.events.emit('prerenderedLocation');
    });
  }

  async drainQueue() {
    const next = await this.processor.next(this.config.maxConcurrentPrerender);

    if (next.isCompleted) {
      this.prerenderingDone();

    } else if (typeof next.path === 'string') {
      this.prerender(next.path);
    }
  }

  async prerender(path: string) {
    const start = Date.now();

    try {
      const input: d.PrerenderInput = {
        browserWSEndpoint: this.browser.wsEndpoint(),
        devServerHost: this.devServerHost,
        url: this.devServerOrigin + path,
        path: path,
        filePath: getWritePathFromUrl(this.config, this.outputTarget, path),
        pageAnalysisDir: (this.outputTarget.pageAnalysis && this.outputTarget.pageAnalysis.dir),
        prettyHtml: this.outputTarget.prettyHtml,
        pathQuery: this.outputTarget.prerenderPathQuery,
        pathHash: this.outputTarget.prerenderPathHash,
        allowDomains: this.outputTarget.prerenderAllowDomains
      };

      // before we kick everything off, let's make sure
      // we've got all the required directories created first
      const dirPath = normalizePath(this.config.sys.path.dirname(input.filePath));
      await this.compilerCtx.fs.ensureDir(dirPath);
      await this.compilerCtx.fs.commit();

      try {
        // throw this over the wall to another process
        // prerender this url and wait on the results
        const results = await this.config.sys.prerender(input);

        // finally got the results from the worker
        if (results) {

          if (!hasError(results.diagnostics)) {
            // no issues prerendering!

            if (this.outputTarget.prerenderUrlCrawl) {
              // we do want to keep crawling urls
              // add any urls we found to the queue to be prerendered still
              const normalizedPaths = normalizePrerenderPaths(this.config, this.outputTarget, results.anchorPaths);

              await this.queue(path, normalizedPaths);
            }

          } else {
            // derp, we had problems during prerendering
            this.buildCtx.diagnostics.push(...results.diagnostics);
          }
        }

      } catch (e) {
        // big error, idk
        catchError(this.buildCtx.diagnostics, e);
      }

    } catch (e) {
      // big big error, idk
      catchError(this.buildCtx.diagnostics, e);

    } finally {
      // totally done processing this path, so remove
      // it from the processing set and add to completed set

      // we're done processing now
      await this.processor.completed(path);
    }

    logFinished(this.config.logger, start, path);

    // trigger to the queue we're all done and ready for the next one
    this.next();
  }

  async finalize() {
    await finalizePrerenderResults(this.config, this.outputTarget.dir);

    try {
      await closePuppeteerBrowser(this.browser);

      this.browser = null;
      this.config = null;
      this.compilerCtx = null;
      this.buildCtx = null;
    } catch (e) {
      catchError(this.buildCtx.diagnostics, e);
    }

    return await this.processor.finalize();
  }

}


async function finalizePrerenderResults(config: d.Config, dir: string) {
  const items = await config.sys.fs.readdir(dir);

  for (const item of items) {
    const itemPath = config.sys.path.join(dir, item);

    if (item.endsWith(`.prerendered`)) {
      const newPath = itemPath.replace(`.prerendered`, '');
      await config.sys.fs.rename(itemPath, newPath);

    } else {
      const stat = await config.sys.fs.stat(itemPath);
      if (stat.isDirectory()) {
        await finalizePrerenderResults(config, itemPath);
      }
    }
  }
}


function logFinished(logger: d.Logger, start: number, path: string) {
  const duration = Date.now() - start;
  let time: string;

  if (duration > 1000) {
    time = 'in ' + (duration / 1000).toFixed(2) + ' s';

  } else {
    const ms = parseFloat((duration).toFixed(3));
    if (ms > 0) {
      time = 'in ' + duration + ' ms';
    } else {
      time = 'in less than 1 ms';
    }
  }

  logger.info(`prerendered: ${path} ${logger.dim(time)}`);
}


async function startPuppeteerBrowser(config: d.Config) {
  const ptr = config.sys.lazyRequire.require('puppeteer');

  const launchOpts: puppeteer.LaunchOptions = {
    ignoreHTTPSErrors: true,
    headless: true
  };

  const browser = await ptr.launch(launchOpts) as puppeteer.Browser;
  return browser;
}


async function closePuppeteerBrowser(browser: puppeteer.Browser) {
  if (browser) {
    try {
      await browser.close();
    } catch (e) {}
  }
}


async function ensurePuppeteer(config: d.Config) {
  const ensureModuleIds = [
    '@types/puppeteer',
    'puppeteer'
  ];

  await config.sys.lazyRequire.ensure(config.logger, config.rootDir, ensureModuleIds);
}
