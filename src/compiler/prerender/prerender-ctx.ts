import * as d from '../../declarations';
import { catchError } from '../util';
import { closePuppeteerBrowser, ensurePuppeteer, prerenderWithBrowser, startPuppeteerBrowser } from './puppeteer';
import { PrerenderStatus } from './prerender-utils';


export class PrerenderCtx {
  private browser: any = null;
  private prerenderingDone: Function;
  queue: d.PrerenderLocation[] = [];

  constructor(public config: d.Config, public compilerCtx: d.CompilerCtx, public buildCtx: d.BuildCtx, public outputTarget: d.OutputTargetWww) {
  }

  async init() {
    // let's make sure they have what we need installed
    await ensurePuppeteer(this.config);

    // fire up the puppeteer browser
    this.browser = await startPuppeteerBrowser(this.config);
  }

  async prerenderAll() {
    // promise resolves when all locations have been prerendered
    await new Promise(prerenderingDone => {
      this.prerenderingDone = prerenderingDone;
      this.compilerCtx.events.subscribe('prerenderedLocation', this.drainQueue.bind(this));

      // let's kick it off
      this.next();
    });
  }

  next() {
    this.compilerCtx.events.emit('prerenderedLocation');
  }

  drainQueue() {
    // listen for when a location has finished prerendering
    // check to see if everything in the queue has been completed
    const allCompleted = this.queue.every(p => p.status === PrerenderStatus.Completed);
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
      const activelyProcessingCount = this.queue.filter(p => p.status === PrerenderStatus.Processing).length;

      if (activelyProcessingCount >= this.outputTarget.prerenderMaxConcurrent) {
        // whooaa, slow down there buddy, let's not get carried away
        break;
      }

      const prerenderLocation = this.queue.find(p => p.status === PrerenderStatus.Pending);
      if (!prerenderLocation) {
        // no pending locations in the queue, let's chill out
        break;
      }

      // update the status to say the this location is actively processing
      prerenderLocation.status = PrerenderStatus.Processing;

      // begin the async prerendering operation for this location
      this.prerender(prerenderLocation);
    }
  }

  async prerender(prerenderLocation: d.PrerenderLocation) {
    const msg = this.outputTarget.hydrateComponents ? 'prerender' : 'optimize html';
    const timeSpan = this.buildCtx.createTimeSpan(`${msg}, started: ${prerenderLocation.path}`);

    const results: d.HydrateResults = {
      diagnostics: []
    };

    try {
      await prerenderWithBrowser(this.browser, prerenderLocation);

      timeSpan.finish(`${msg}, finished: ${prerenderLocation.path}`);

    } catch (e) {
      // ahh man! what happened!
      timeSpan.finish(`${msg}, failed: ${prerenderLocation.path}`);

      catchError(this.buildCtx.diagnostics, e);
    }

    this.next();

    return results;
  }

  async destroy() {
    await closePuppeteerBrowser(this.browser);

    this.browser = null;
    this.config = null;
    this.compilerCtx = null;
    this.buildCtx = null;
    this.prerenderAll = null;
    this.queue.length = 0;
  }

}
