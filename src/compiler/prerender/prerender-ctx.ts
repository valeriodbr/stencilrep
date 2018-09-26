import * as d from '../../declarations';
import { catchError, hasError } from '../util';
import { closePuppeteerBrowser, ensurePuppeteer, startPuppeteerBrowser } from './puppeteer';
import { getWritePathFromUrl, queuePathForPrerender } from './prerender-utils';
import { prepareDocumentBeforePrerender } from './prerender-index-html';
import * as puppeteer from 'puppeteer';


export class PrerenderCtx {
  private browser: puppeteer.Browser = null;
  private browserWsEndpoint: string;
  private devServerOrigin: string;
  private devServerHost: string;
  private prerenderingDone: Function;
  queue: string[] = [];
  processing = new Set();
  completed = new Set();

  constructor(public config: d.Config, public compilerCtx: d.CompilerCtx, public buildCtx: d.BuildCtx, public outputTarget: d.OutputTargetWww) {
    const devServerUrl = config.sys.url.parse(config.devServer.browserUrl);
    this.devServerHost = devServerUrl.host;
    this.devServerOrigin = `http://${this.devServerHost}`;
  }

  async startBrowser() {
    // let's make sure they have what we need installed
    await ensurePuppeteer(this.config);

    // fire up the puppeteer browser
    this.browser = await startPuppeteerBrowser(this.config);

    this.browserWsEndpoint = this.browser.wsEndpoint();
  }

  async prepareIndexHtml() {
    await prepareDocumentBeforePrerender(this.config, this.compilerCtx, this.buildCtx, this.outputTarget);
  }

  async prerenderAll(paths: string[]) {
    if (!Array.isArray(paths) || paths.length === 0) {
      return Promise.resolve();
    }

    // promise resolves when all locations have been prerendered
    await new Promise(prerenderingDone => {
      this.prerenderingDone = prerenderingDone;

      this.compilerCtx.events.subscribe('prerenderedLocation', this.drainQueue.bind(this));

      // add these paths to our array of pending paths
      this.queue.push(...paths);

      // let's kick it off
      this.next();
    });
  }

  next() {
    setTimeout(() => {
      this.compilerCtx.events.emit('prerenderedLocation');
    });
  }

  drainQueue() {
    // listen for when a location has finished prerendering
    // check to see if everything in the queue has been completed
    const allCompleted = (this.processing.size === 0 && this.queue.length === 0);
    if (allCompleted) {
      // we're not actively processing anything
      // and there aren't anymore urls in the queue to be prerendered
      // so looks like our job here is done, good work team
      this.prerenderingDone();
      return;
    }

    // more in the queue yet, let's keep going
    for (let i = 0; i < this.config.maxConcurrentPrerender * 2; i++) {
      // count how many are actively processing right now
      if (this.processing.size >= this.config.maxConcurrentPrerender) {
        // whooaa, slow down there buddy, let's not get carried away
        return;
      }

      const path = this.queue.shift();
      if (!path) {
        // no pending paths in the queue, let's chill out
        // there's probably some in the processing still being worked on
        return;
      }

      // move this url to processing
      this.processing.add(path);

      // begin the async prerendering operation for this location
      this.prerender(path);
    }
  }

  async prerender(path: string) {
    const start = Date.now();

    try {
      const input: d.PrerenderInput = {
        browserWsEndpoint: this.browserWsEndpoint,
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

      try {
        // prerender this url and wait on the results
        const results = await this.config.sys.prerender(input);

        this.buildCtx.diagnostics.push(...results.diagnostics);

        if (!hasError(results.diagnostics)) {

          if (this.outputTarget.prerenderUrlCrawl) {
            // we do want to keep crawling urls
            // add any urls we found to the queue to be prerendered still
            results.anchorPaths.forEach(anchorPath => {
              try {
                queuePathForPrerender(this.config, this.outputTarget, this.queue, this.processing, this.completed, anchorPath);
              } catch (e) {
                catchError(this.buildCtx.diagnostics, e);
              }
            });
          }

        }

      } catch (e) {
        catchError(this.buildCtx.diagnostics, e);
      }

      // we're done processing now
      this.processing.delete(path);

      // consider it completed
      this.completed.add(path);

    } catch (e) {
      this.processing.delete(path);
      this.completed.add(path);
      catchError(this.buildCtx.diagnostics, e);
    }

    logFinished(this.config.logger, start, path);

    // trigger to the queue we're all done and ready for the next one
    this.next();
  }

  async destroy() {
    await closePuppeteerBrowser(this.browser);

    this.browser = null;
    this.config = null;
    this.compilerCtx = null;
    this.buildCtx = null;
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
