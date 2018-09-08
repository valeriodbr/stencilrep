import * as d from '../../declarations';
import { buildWarn, catchError, hasError } from '../util';
import { generateHostConfig } from './host-config';
import { PrerenderCtx } from './prerender-ctx';


export async function prerenderApp(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, _entryModules: d.EntryModule[]) {
  // get output targets that are www and have an index.html file
  const outputTargets = (config.outputTargets as d.OutputTargetWww[]).filter(o => {
    return o.type === 'www' && o.indexHtml;
  });

  if (outputTargets.length === 0) {
    // no output targets want to prerender
    return;
  }

  // kick off the prerendering for each output target (probably only 1, but who knows)
  for (const outputTarget of outputTargets) {
    if (outputTarget.hydrateComponents && outputTarget.prerenderLocations && outputTarget.prerenderLocations.length > 0) {
      // create a context object to hold all things useful during prerendering
      const prerenderCtx = new PrerenderCtx(config, compilerCtx, buildCtx, outputTarget);

      await prerenderCtx.startBrowser();
      await prerenderOutputTarget(prerenderCtx);

      // shut it down!
      await prerenderCtx.destroy();
    }
  }
}


async function prerenderOutputTarget(prerenderCtx: PrerenderCtx) {
  // get the prerender urls queued up
  const prerenderUrlsQueue = getPrerenderUrlsQueue(prerenderCtx.config, prerenderCtx.outputTarget);

  if (!prerenderUrlsQueue.length) {
    const d = buildWarn(prerenderCtx.buildCtx.diagnostics);
    d.messageText = `No urls found in the prerender config`;
    return;
  }

  // let's do this!!!
  // keep track of how long the entire build process takes
  const timeSpan = prerenderCtx.buildCtx.createTimeSpan(`prerendering started`, !prerenderCtx.outputTarget.hydrateComponents);

  try {
    await prerenderCtx.prerenderAll(prerenderUrlsQueue);

    // prerendering has finished
    // let's build a host config from the data
    await generateHostConfig(prerenderCtx.config, prerenderCtx.compilerCtx, prerenderCtx.outputTarget, null);

  } catch (e) {
    catchError(prerenderCtx.buildCtx.diagnostics, e);
  }

  if (hasError(prerenderCtx.buildCtx.diagnostics)) {
    timeSpan.finish(`prerendering failed`);

  } else {
    timeSpan.finish(`prerendered urls: ${prerenderCtx.completed.size}`);
  }
}


function getPrerenderUrlsQueue(config: d.Config, outputTarget: d.OutputTargetWww) {
  let domain = config.devServer.browserUrl;
  if (domain.endsWith('/')) {
    domain = domain.substring(0, domain.length - 1);
  }

  return outputTarget.prerenderLocations.map(prerenderLocation => {
    return domain + prerenderLocation.path;
  });
}

