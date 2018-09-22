import * as d from '../../declarations';
import { catchError, hasError } from '../util';
import { closePuppeteerBrowser, ensurePuppeteer, prerender, startPuppeteerBrowser } from './puppeteer';
import { extractResolvedAnchorUrls, queuePathForPrerender } from './prerender-utils';
import { optimizeHtml } from '../html/optimize-html';
import { writePrerenderResults } from './prerender-write';


export class PrerenderCtx {
  private browser: any = null;
  private origin: string;
  private prerenderingDone: Function;
  queue: string[] = [];
  processing = new Set();
  completed = new Set();

  constructor(public config: d.Config, public compilerCtx: d.CompilerCtx, public buildCtx: d.BuildCtx, public outputTarget: d.OutputTargetWww) {
    this.origin = config.devServer.browserUrl;
    if (this.origin.endsWith('/')) {
      this.origin = this.origin.substring(0, this.origin.length - 1);
    }
  }

  async startBrowser() {
    // let's make sure they have what we need installed
    await ensurePuppeteer(this.config);

    // fire up the puppeteer browser
    this.browser = await startPuppeteerBrowser(this.config);
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
    for (let i = 0; i < this.outputTarget.prerenderMaxConcurrent; i++) {
      // count how many are actively processing right now
      if (this.processing.size >= this.outputTarget.prerenderMaxConcurrent) {
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
      // prerender this url and wait on the results
      const results = await prerender(this.config, this.outputTarget, this.buildCtx, this.browser, this.origin, path);

      // now that we've prerendered the content
      // let's optimize the document node even further
      await optimizeHtml(this.config, this.compilerCtx, this.outputTarget, results);

      // we're done processing now
      this.processing.delete(path);

      // consider it completed
      this.completed.add(path);

      this.buildCtx.diagnostics.push(...results.diagnostics);

      if (!hasError(results.diagnostics)) {
        // get all of the resolved anchor urls to continue to crawll
        extractResolvedAnchorUrls(results.anchorPaths, results.document.body);

        // no errors, write out the results and modify the html as needed
        await writePrerenderResults(this.config, this.compilerCtx, this.buildCtx, this.outputTarget, results);

        if (this.outputTarget.prerenderUrlCrawl) {
          // we do want to keep crawling urls
          // add any urls we found to the queue to be prerendered still
          results.anchorPaths.forEach(anchorPath => {
            try {
              queuePathForPrerender(this.config, this.outputTarget, this.queue, this.processing, this.completed, anchorPath);
            } catch (e) {
              catchError(results.diagnostics, e);
            }
          });
        }
      }

      logFinished(this.config.logger, start, path);

    } catch (e) {
      this.processing.delete(path);
      this.completed.add(path);
      catchError(this.buildCtx.diagnostics, e);
    }

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
