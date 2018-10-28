import * as d from '../../declarations';
import { catchError, normalizePath } from '../util';
import { getWritePathFromUrl, normalizePrerenderPaths } from './prerender-normalize-path';


export function prerenderMain(config: d.Config, compilerCtx: d.CompilerCtx, buildCtx: d.BuildCtx, outputTarget: d.OutputTargetWww, job: d.PrerenderJob, browserWsEndpoint: string, devServerHost: string, paths: string[]) {
  return new Promise<d.PrerenderMainResults>(async (resolve) => {

    const ctx: d.PrerenderContext = {
      config: config,
      compilerCtx: compilerCtx,
      buildCtx: buildCtx,
      outputTarget: outputTarget,
      job: job,
      browserWsEndpoint: browserWsEndpoint,
      devServerHost: devServerHost,
      workerPrerendered: 0,
      completedCallback: resolve
    };

    ctx.completedCallback = resolve;

    // add these paths to our array of pending paths
    const normalizedPaths = normalizePrerenderPaths(ctx.config, ctx.outputTarget, paths);
    await ctx.job.queue(normalizedPaths);

    // let's kick it off in the next tick
    process.nextTick(() => {
      paths.forEach(path => {
        prerender(ctx, path);
      });
    });
  });
}


async function prerender(ctx: d.PrerenderContext, path: string) {
  const start = Date.now();

  try {
    const input: d.PrerenderInput = {
      browserWsEndpoint: ctx.browserWsEndpoint,
      devServerHost: ctx.devServerHost,
      path: path,
      filePath: getWritePathFromUrl(ctx.config, ctx.outputTarget, path),
      pageAnalysisDir: (ctx.outputTarget.pageAnalysis && ctx.outputTarget.pageAnalysis.dir),
      prettyHtml: ctx.outputTarget.prettyHtml,
      pathQuery: ctx.outputTarget.prerenderPathQuery,
      pathHash: ctx.outputTarget.prerenderPathHash,
      allowDomains: ctx.outputTarget.prerenderAllowDomains
    };

    // before we kick everything off, let's make sure
    // we've got all the required directories created first
    const dirPath = normalizePath(ctx.config.sys.path.dirname(input.filePath));
    await ctx.compilerCtx.fs.ensureDir(dirPath);
    await ctx.compilerCtx.fs.commit();

    try {
      // throw this over the wall to another process
      // prerender this url and wait on the results
      const results = await ctx.config.sys.prerender(input);

      ctx.workerPrerendered++;

      ctx.buildCtx.diagnostics.push(...results.diagnostics);

      if (ctx.outputTarget.prerenderUrlCrawl) {
        // we do want to keep crawling urls
        // add any urls we found to the queue to be prerendered still
        const normalizedPaths = normalizePrerenderPaths(ctx.config, ctx.outputTarget, results.anchorPaths);
        await ctx.job.queue(normalizedPaths);
      }

    } catch (e) {
      // big error, idk
      catchError(ctx.buildCtx.diagnostics, e);
    }

  } catch (e) {
    // big big error, idk
    catchError(ctx.buildCtx.diagnostics, e);

  } finally {
    ctx.job.completed(path);
  }

  logFinished(ctx.config.logger, start, path);

  process.nextTick(() => {
    // trigger to the queue we're all done and ready for the next one
    next(ctx);
  });
}


async function next(ctx: d.PrerenderContext) {
  const next = await ctx.job.next(ctx.config.maxConcurrentPrerender);

  if (next.isCompleted) {
    const results: d.PrerenderMainResults = {
      workerPrerendered: ctx.workerPrerendered
    };

    if (next.isMasterWorker) {
      await finalizeMasterPrerender(ctx, results);
    }

    ctx.completedCallback(results);

  } else {
    next.paths.forEach(path => {
      prerender(ctx, path);
    });
  }
}


async function finalizeMasterPrerender(ctx: d.PrerenderContext, results: d.PrerenderMainResults) {
  results.isMaster = true;
  results.totalPrerendered = 0;

  const timeSpan1 = ctx.buildCtx.createTimeSpan(`prerender renaming started`, true);
  renamePrerenderedFiles(ctx.config, ctx.outputTarget.dir, results);
  timeSpan1.finish(`prerender renaming finished`);

  const timeSpan2 = ctx.buildCtx.createTimeSpan(`prerender job finalize started`, true);
  await ctx.job.finalize();
  timeSpan2.finish(`prerender job finalized`);
}


function renamePrerenderedFiles(config: d.Config, dir: string, results: d.PrerenderMainResults) {
  const items = config.sys.fs.readdirSync(dir);

  for (const item of items) {
    const itemPath = config.sys.path.join(dir, item);

    if (item.endsWith(`.prerendered`)) {
      results.totalPrerendered++;
      const newPath = itemPath.replace(`.prerendered`, '');
      config.sys.fs.renameSync(itemPath, newPath);

    } else {
      const stat = config.sys.fs.statSync(itemPath);
      if (stat.isDirectory()) {
        renamePrerenderedFiles(config, itemPath, results);
      }
    }
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
