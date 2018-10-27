import * as d from '../../declarations';
import { buildWarn, catchError, hasError } from '../util';
import { PrerenderCtx } from './prerender-ctx';
import { PrerenderProcessor } from './prerender-processor';


export async function prerenderApp(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, _entryModules: d.EntryModule[]) {
  // get output targets that are www and have an index.html file
  const outputTargets = (config.outputTargets as d.OutputTargetWww[]).filter(o => {
    return o.type === 'www' && o.indexHtml && o.prerenderLocations && o.prerenderLocations.length > 0;
  });

  // kick off the prerendering for each output target (probably only 1, but who knows)
  for (const outputTarget of outputTargets) {
    // create a context object to hold all things useful during prerendering
    if (hasError(buildCtx.diagnostics)) {
      return;
    }

    try {
      await prerenderOutputTarget(config, compilerCtx, buildCtx, outputTarget);

    } catch (e) {
      catchError(buildCtx.diagnostics, e);
    }
  }
}


async function prerenderOutputTarget(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, outputTarget: d.OutputTargetWww) {
  // get the prerender urls queued up
  const entryPaths = outputTarget.prerenderLocations.map(loc => {
    return loc.path;
  }).filter(path => path.startsWith('/'));

  if (!entryPaths.length) {
    const d = buildWarn(buildCtx.diagnostics);
    d.messageText = `No urls found in the prerender config`;
    return;
  }

  // create a processor that handles what needs
  // to be processed and what's completed
  const processor = new PrerenderProcessor();
  await processor.init();

  // create the prerendering context
  const prerenderCtx = new PrerenderCtx(config, compilerCtx, buildCtx, outputTarget, processor);

  // start up the browser and prepare the index html
  await Promise.all([
    prerenderCtx.startBrowser(),
    prerenderCtx.prepareIndexHtml()
  ]);

  if (prerenderCtx.outputTarget.pageAnalysis) {
    // empty out the page analysis directory for this fresh build
    await prerenderCtx.compilerCtx.fs.emptyDir(prerenderCtx.outputTarget.pageAnalysis.dir);
    await prerenderCtx.compilerCtx.fs.commit();
  }

  // keep track of how long the entire build process takes
  const timeSpan = prerenderCtx.buildCtx.createTimeSpan(`prerendering started`);

  try {
    // let's do this!!!
    await prerenderCtx.prerenderAll(entryPaths);

  } catch (e) {
    catchError(prerenderCtx.buildCtx.diagnostics, e);
  }

  try {
    // woot! all done
    const finalizeResults = await prerenderCtx.finalize();

    if (hasError(prerenderCtx.buildCtx.diagnostics)) {
      // :(
      timeSpan.finish(`prerendering failed`);

    } else {
      // cool, let's see how many we prerendered
      timeSpan.finish(`prerendered: ${finalizeResults.totalPrerendered}`);
    }

  } catch (e) {
    catchError(prerenderCtx.buildCtx.diagnostics, e);
  }
}
