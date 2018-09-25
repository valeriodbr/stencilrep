import * as d from '../../declarations';
import { buildWarn, catchError, hasError } from '../util';
import { PrerenderCtx } from './prerender-ctx';
import { finalizePrerenderResults } from './prerender-write';


export async function prerenderApp(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, _entryModules: d.EntryModule[]) {
  // get output targets that are www and have an index.html file
  const outputTargets = (config.outputTargets as d.OutputTargetWww[]).filter(o => {
    return o.type === 'www' && o.indexHtml && o.prerenderLocations && o.prerenderLocations.length > 0;
  });

  // kick off the prerendering for each output target (probably only 1, but who knows)
  for (const outputTarget of outputTargets) {
    // create a context object to hold all things useful during prerendering
    const prerenderCtx = new PrerenderCtx(config, compilerCtx, buildCtx, outputTarget);

    try {
      await Promise.all([
        prerenderCtx.startBrowser(),
        prerenderCtx.prepareIndexHtml()
      ]);

      await prerenderOutputTarget(prerenderCtx);

    } catch (e) {
      catchError(this.buildCtx.diagnostics, e);
    }

    // shut it down!
    await prerenderCtx.destroy();
  }
}


async function prerenderOutputTarget(prerenderCtx: PrerenderCtx) {
  if (hasError(prerenderCtx.buildCtx.diagnostics)) {
    return;
  }

  // get the prerender urls queued up
  const pathsQueue = prerenderCtx.outputTarget.prerenderLocations.map(prerenderLocation => {
    return prerenderLocation.path;
  }).filter(path => path.startsWith('/'));

  if (!pathsQueue.length) {
    const d = buildWarn(prerenderCtx.buildCtx.diagnostics);
    d.messageText = `No urls found in the prerender config`;
    return;
  }

  // let's do this!!!
  // keep track of how long the entire build process takes
  const timeSpan = prerenderCtx.buildCtx.createTimeSpan(`prerendering started`);

  if (prerenderCtx.outputTarget.pageAnalysis) {
    const timeSpan = prerenderCtx.buildCtx.createTimeSpan(`empty ${prerenderCtx.outputTarget.pageAnalysis.dir} started`, true);
    await prerenderCtx.compilerCtx.fs.emptyDir(prerenderCtx.outputTarget.pageAnalysis.dir);
    await prerenderCtx.compilerCtx.fs.commit();
    timeSpan.finish(`empty pageAnalysis finished`);
  }

  try {
    // const indexHtml = await prepareIndexHtml();
    await prerenderCtx.prerenderAll(pathsQueue);

    // prerendering has finished
    // let's build a host config from the data
    // await generateHostConfig(prerenderCtx.config, prerenderCtx.compilerCtx, prerenderCtx.outputTarget, null);

    await finalizePrerenderResults(prerenderCtx.config, prerenderCtx.outputTarget.dir);

  } catch (e) {
    catchError(prerenderCtx.buildCtx.diagnostics, e);
  }

  if (hasError(prerenderCtx.buildCtx.diagnostics)) {
    timeSpan.finish(`prerendering failed`);

  } else {
    timeSpan.finish(`prerendered urls: ${prerenderCtx.completed.size}`);
  }
}
