import * as d from '../../declarations';
import { catchError, hasError } from '../util';
import { extractResolvedAnchorUrls } from './prerender-utils';
import { finalizeDocumentAfterPrerender } from './prerender-index-html';
import { prerenderPath } from './puppeteer';
import { writePageAnalysis, writePrerenderResults } from './prerender-write';


export async function prerendeWorker(input: d.PrerenderInput) {
  const results: d.PrerenderResults = {
    diagnostics: [],
    anchorPaths: []
  };

  const pageAnalysis: d.PageAnalysis = {
    path: input.path,
    pathname: null,
    search: null,
    hash: null,
    anchorPaths: [],
    diagnostics: [],
    pageErrors: [],
    requests: [],
  };

  try {
    let doc: HTMLDocument = null;

    try {
      // prerender this url and wait on the results
      doc = await prerenderPath(input, pageAnalysis);

    } catch (e) {
      catchError(results.diagnostics, e);
    }

    if (doc && !hasError(results.diagnostics)) {
      finalizeDocumentAfterPrerender(doc);

      // now that we've prerendered the content
      // let's optimize the document node even further
      await optimizeHtml(doc);

      // get all of the resolved anchor urls to continue to crawllll
      extractResolvedAnchorUrls(results.anchorPaths, doc.body);

      // no errors, write out the results and modify the html as needed
      await writePrerenderResults(input, pageAnalysis, doc);
    }

    if (input.pageAnalysisDir) {
      await writePageAnalysis(input, pageAnalysis);
    }

  } catch (e) {
    catchError(results.diagnostics, e);
  }

  return results;
}


function optimizeHtml(doc: HTMLDocument) {
  doc;
}
