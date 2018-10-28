import * as d from '../../declarations';


class SinglePrerenderJob implements d.PrerenderJob {
  private queuedPaths: string[] = [];
  private processingPaths = new Set();
  private completedPaths = new Set();

  async init() {/**/}

  async queue(paths: string[]) {
    if (Array.isArray(paths)) {
      paths.forEach(path => {
        if (this.queuedPaths.includes(path)) {
          return;
        }
        if (this.processingPaths.has(path)) {
          return;
        }
        if (this.completedPaths.has(path)) {
          return;
        }
        this.queuedPaths.push(path);
      });
    }
  }

  async next(maxConcurrentPrerender: number) {
    const next: d.ProcessorNext = {
      isCompleted: (this.processingPaths.size === 0 && this.queuedPaths.length === 0),
      paths: []
    };

    // listen for when a location has finished prerendering
    // check to see if everything in the queue has been completed
    if (next.isCompleted) {
      // we're not actively processing anything
      // and there aren't anymore urls in the queue to be prerendered
      // so looks like our job here is done, good work team
      return next;
    }

    // more in the queue yet, let's keep going
    for (let i = 0; i < maxConcurrentPrerender * 10; i++) {
      // count how many are actively processing right now
      if (this.processingPaths.size >= maxConcurrentPrerender) {
        // whooaa, slow down there buddy, let's not get carried away
        break;
      }

      const path = this.queuedPaths.shift();
      if (!path) {
        // nothing left in the queue
        break;
      }

      if (this.processingPaths.has(path)) {
        // already currently processing this path
        continue;
      }

      if (this.completedPaths.has(path)) {
        // already completed prerendering this path
        continue;
      }

      // move this url to processing
      this.processingPaths.add(path);

      next.paths.push(path);
    }

    return next;
  }

  async completed(path: string) {
    const i = this.queuedPaths.indexOf(path);
    if (i > -1) {
      // shouldn't happen, but let's double check
      this.queuedPaths.splice(i, 1);
    }

    // we're done processing now
    this.processingPaths.delete(path);

    // this path is 100% completed
    this.completedPaths.add(path);
  }

  async finalize() {/**/}

}


export function createPrerenderJob(config: d.Config): d.PrerenderJob {
  if (config.flags.ci) {
    //
  }
  return new SinglePrerenderJob();
}
