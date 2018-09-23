import * as d from '../../declarations';
import * as puppeteer from 'puppeteer'; // for types only


export async function startPageAnalysis(page: puppeteer.Page) {
  await Promise.all([
    page.coverage.startJSCoverage(),
    page.coverage.startCSSCoverage()
  ]);
}


export async function stopPageAnalysis(config: d.Config, devServerHost: string, page: puppeteer.Page, results: d.PrerenderResults) {
  const [jsCoverage, cssCoverage, metrics] = await Promise.all([
    page.coverage.stopJSCoverage(),
    page.coverage.stopCSSCoverage(),
    page.metrics()
  ]);

  results.coverage = {
    css: calulateCoverage(config, devServerHost, cssCoverage),
    js: calulateCoverage(config, devServerHost, jsCoverage)
  };

  results.metrics = {
    jsEventListeners: metrics.JSEventListeners,
    nodes: metrics.Nodes,
    layoutCount: metrics.LayoutCount,
    recalcStyleCount: metrics.RecalcStyleCount,
    layoutDuration: metrics.LayoutDuration,
    recalcStyleDuration: metrics.RecalcStyleDuration,
    scriptDuration: metrics.ScriptDuration,
    taskDuration: metrics.TaskDuration,
    jsHeapUsedSize: metrics.JSHeapUsedSize,
    jsHeapTotalSize: metrics.JSHeapTotalSize,
  };
}


function calulateCoverage(config: d.Config, devServerHost: string, entries: puppeteer.CoverageEntry[]) {
  return entries.map(entry => {
    const converageEntry: d.PageCoverageEntry = {};

    const url = config.sys.url.parse(entry.url);

    if (url.host === devServerHost) {
      converageEntry.path = url.path;
    } else {
      converageEntry.url = url.href;
    }

    converageEntry.totalBytes = entry.text.length;
    converageEntry.usedBytes = 0;

    for (const range of entry.ranges) {
      converageEntry.usedBytes += range.end - range.start - 1;
    }

    return converageEntry;
  });
}
