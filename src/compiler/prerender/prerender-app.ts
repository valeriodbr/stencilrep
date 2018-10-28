import * as d from '../../declarations';
import { buildWarn, catchError } from '../util';
import { createPrerenderJob } from './prerender-job';
import { prerenderMain } from './prerender-main';
import { prepareIndexHtmlBeforePrerender } from './prepare-index-html';
import * as puppeteer from 'puppeteer'; // for types only


export async function prerenderApp(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx) {
  // get output targets that are www and have an index.html file
  const outputTargets = (config.outputTargets as d.OutputTargetWww[]).filter(o => {
    return o.type === 'www' && o.indexHtml && o.prerenderLocations && o.prerenderLocations.length > 0;
  });

  if (outputTargets.length === 0) {
    return;
  }

  try {
    // start up the browser and prepare the index html
    const browser = await startBrowser(config);

    // kick off the prerendering for each output target (probably only 1, but who knows)
    for (const outputTarget of outputTargets) {
      // create a context object to hold all things useful during prerendering
      if (buildCtx.hasError || !buildCtx.isActiveBuild) {
        return;
      }

      try {
        await prerenderOutputTarget(config, compilerCtx, buildCtx, outputTarget, browser);

      } catch (e) {
        catchError(buildCtx.diagnostics, e);
      }
    }

    await closeBrowser(browser);

  } catch (e) {
    catchError(buildCtx.diagnostics, e);
  }
}


async function prerenderOutputTarget(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, outputTarget: d.OutputTargetWww, browser: puppeteer.Browser) {
  // get the prerender urls queued up
  const entryPaths = outputTarget.prerenderLocations.map(loc => {
    return loc.path;
  }).filter(path => path.startsWith('/'));

  if (!entryPaths.length) {
    const d = buildWarn(buildCtx.diagnostics);
    d.messageText = `No urls found in the prerender config`;
    return;
  }

  // prepare the index.html before we start prerendering based off of it
  await prepareIndexHtmlBeforePrerender(config, compilerCtx, buildCtx, outputTarget);

  if (outputTarget.pageAnalysis) {
    // empty out the page analysis directory for this fresh build
    await compilerCtx.fs.emptyDir(outputTarget.pageAnalysis.dir);
    await compilerCtx.fs.commit();
  }

  // keep track of how long the entire build process takes
  const timeSpan = buildCtx.createTimeSpan(`prerendering started`);

  try {
    const job = createPrerenderJob(config);

    const devServerUrl = config.sys.url.parse(config.devServer.browserUrl);

    // let's do this!!!
    const results = await prerenderMain(
      config,
      compilerCtx,
      buildCtx,
      outputTarget,
      job,
      browser.wsEndpoint(),
      devServerUrl.host,
      entryPaths
    );

    // woot! all done
    timeSpan.finish(`prerendered: ${results.workerPrerendered}`);

  } catch (e) {
    timeSpan.finish(`prerendering failed`);
    catchError(buildCtx.diagnostics, e);
  }
}


async function startBrowser(config: d.Config) {
  const ensureModuleIds = [
    '@types/puppeteer',
    'puppeteer'
  ];

  await config.sys.lazyRequire.ensure(config.logger, config.rootDir, ensureModuleIds);

  const ptr = config.sys.lazyRequire.require('puppeteer');

  const launchOpts: puppeteer.LaunchOptions = {
    ignoreHTTPSErrors: true,
    headless: true
  };

  return await ptr.launch(launchOpts) as puppeteer.Browser;
}


async function closeBrowser(browser: puppeteer.Browser) {
  if (browser) {
    try {
      await browser.close();
    } catch (e) {}
  }
}
