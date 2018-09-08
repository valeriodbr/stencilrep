import * as d from '../../declarations';
import { closePuppeteerBrowser, ensurePuppeteer, prerender, startPuppeteerBrowser } from './puppeteer';
import { getHost, queueUrlsToPrerender } from './prerender-utils';
import { writePrerenderResults } from './prerender-write';
import { hasError } from '../util';


export class PrerenderCtx {
  private browser: any = null;
  private host: string = null;
  queue: string[] = [];
  processing = new Set();
  completed = new Set();

  constructor(public config: d.Config, public compilerCtx: d.CompilerCtx, public buildCtx: d.BuildCtx, public outputTarget: d.OutputTargetWww) {
  }

  async startBrowser() {
    this.host = getHost(this.config, this.outputTarget);

    // let's make sure they have what we need installed
    await ensurePuppeteer(this.config);

    // fire up the puppeteer browser
    this.browser = await startPuppeteerBrowser(this.config);
  }

  async prerenderAll(urls: string[]) {
    // promise resolves when all locations have been prerendered
    await new Promise(prerenderingDone => {
      this.compilerCtx.events.subscribe('prerenderedLocation', this.drainQueue.bind(this, prerenderingDone));

      // add these urls to our array of pending urls
      this.queue.push(...urls);

      // let's kick it off
      setTimeout(() => {
        this.next();
      });
    });
  }

  next() {
    this.compilerCtx.events.emit('prerenderedLocation');
  }

  drainQueue(prerenderingDone: Function) {
    // listen for when a location has finished prerendering
    // check to see if everything in the queue has been completed
    const allCompleted = (this.processing.size === 0 && this.queue.length === 0);
    if (allCompleted) {
      // we're not actively processing anything
      // and there aren't anymore urls in the queue to be prerendered
      // so looks like our job here is done, good work team
      prerenderingDone();
      return;
    }

    // more in the queue yet, let's keep going
    for (let i = 0; i < this.outputTarget.prerenderMaxConcurrent; i++) {
      // count how many are actively processing right now
      if (this.processing.size >= this.outputTarget.prerenderMaxConcurrent) {
        // whooaa, slow down there buddy, let's not get carried away
        return;
      }

      const prerenderUrl = this.queue.shift();
      if (!prerenderUrl) {
        // no pending locations in the queue, let's chill out
        // there's probably some in the processing still being worked on
        return;
      }

      // move this url to processing
      this.processing.add(prerenderUrl);

      // begin the async prerendering operation for this location
      this.prerender(prerenderUrl);
    }
  }

  async prerender(url: string) {
    const msg = this.outputTarget.hydrateComponents ? 'prerender' : 'optimize html';

    const timeSpan = this.buildCtx.createTimeSpan(`${msg}, started: ${url}`);

    // prerender this url and wait on the results
    const results = await prerender(this.config, this.outputTarget, this.buildCtx, this.browser, url);

    // we're done processing now
    this.processing.delete(url);

    // consider it completed
    this.completed.add(url);

    if (!hasError(results.diagnostics)) {
      // no errors, write out the results and modify the html as needed
      const urls = await writePrerenderResults(this.config, this.compilerCtx, this.buildCtx, this.outputTarget, results);

      if (this.outputTarget.prerenderUrlCrawl) {
        // we do want to keep crawling urls
        // add any urls we found to the queue to be prerendered still
        urls.forEach(url => {
          queueUrlsToPrerender(this.config, this.outputTarget, this.host, this.queue, this.processing, this.completed, url);
        });
      }
    }

    timeSpan.finish(`${msg}, finished: ${url}`);

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
