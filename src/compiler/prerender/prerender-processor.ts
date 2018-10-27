import * as d from '../../declarations';


export class PrerenderProcessor implements d.PrerenderProcessor {
  private queuedPaths: string[] = [];
  private processingPaths = new Set();
  private completedPaths = new Set();
  private soucrePaths = new Map<string, string>();

  async init() {/**/}

  async queue(source: string, paths: string[]) {
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

      this.soucrePaths.set(path, source);
      this.queuedPaths.push(path);
    });
  }

  async next(maxConcurrentPrerender: number) {
    const p: d.ProcessorNext = {
      isCompleted: (this.processingPaths.size === 0 && this.queuedPaths.length === 0)
    };

    // listen for when a location has finished prerendering
    // check to see if everything in the queue has been completed
    if (p.isCompleted) {
      // we're not actively processing anything
      // and there aren't anymore urls in the queue to be prerendered
      // so looks like our job here is done, good work team
      return p;
    }

    // more in the queue yet, let's keep going
    for (let i = 0; i < maxConcurrentPrerender * 2; i++) {
      // count how many are actively processing right now
      if (this.processingPaths.size >= maxConcurrentPrerender) {
        // whooaa, slow down there buddy, let's not get carried away
        p.maxConcurrent = true;
        return p;
      }

      p.path = this.queuedPaths.shift();
      if (!p.path || this.processingPaths.has(p.path) || this.completedPaths.has(p.path)) {
        // no pending paths in the queue, let's chill out
        // there's probably some in the processing still being worked on
        p.noPending = true;
        return p;
      }

      // move this url to processing
      this.processingPaths.add(p.path);

      p.source = this.soucrePaths.get(p.path);

      // begin the async prerendering operation for this location
      return p;
    }

    return p;
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

  async finalize() {
    return {
      totalPrerendered: this.completedPaths.size
    };
  }

}
