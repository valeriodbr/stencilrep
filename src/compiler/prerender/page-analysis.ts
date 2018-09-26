import * as d from '../../declarations';
import * as puppeteer from 'puppeteer'; // for types only
import { URL } from 'url';


export async function startPageAnalysis(page: puppeteer.Page) {
  await Promise.all([
    page.coverage.startJSCoverage(),
    page.coverage.startCSSCoverage()
  ]);
}


export async function stopPageAnalysis(input: d.PrerenderInput, pageAnalysis: d.PageAnalysis, page: puppeteer.Page) {
  const [jsCoverage, cssCoverage, metrics] = await Promise.all([
    page.coverage.stopJSCoverage(),
    page.coverage.stopCSSCoverage(),
    page.metrics()
  ]);

  pageAnalysis.coverage = {
    css: calulateCoverage(input.devServerHost, cssCoverage),
    js: calulateCoverage(input.devServerHost, jsCoverage)
  };

  pageAnalysis.metrics = {
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


function calulateCoverage(devServerHost: string, entries: puppeteer.CoverageEntry[]) {
  return entries.map(entry => {
    const converageEntry: d.PageCoverageEntry = {};

    const url = new URL(entry.url);

    if (url.host === devServerHost) {
      converageEntry.path = url.pathname + url.search;
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
