import * as d from '../../../declarations';
import { catchError, hasError } from '../../util';
import { HYDRATE_SCRIPT_ID, LOADER_SCRIPT_ID, SETUP_SCRIPT_ID } from '../inline-prerender-client';
import { optimizePrerenderedDocument } from './optimize-document';
import { prerenderPath } from './prerender-path';
import { writePageAnalysis, writePrerenderResults } from './prerender-write';


export async function prerenderWorker(input: d.PrerenderInput) {
  const results: d.PrerenderResults = {
    diagnostics: [],
    anchorPaths: []
  };

  const pageAnalysis: d.PageAnalysis = {
    path: input.path,
    pathName: undefined,
    pathSearch: undefined,
    pathHash: undefined,
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
      await optimizePrerenderedDocument(pageAnalysis, doc);

      // no errors, write out the results and modify the html as needed
      await writePrerenderResults(input, pageAnalysis, doc);
    }

    if (input.pageAnalysisDir) {
      await writePageAnalysis(input, pageAnalysis);
    }

    results.anchorPaths = pageAnalysis.anchorPaths.slice();

  } catch (e) {
    catchError(results.diagnostics, e);
  }

  return results;
}


function finalizeDocumentAfterPrerender(doc: HTMLDocument) {
  const setupScriptElm = doc.getElementById(SETUP_SCRIPT_ID);
  if (setupScriptElm) {
    // remove the prerender setup script that had prender config data
    setupScriptElm.remove();
  }

  const hydrateScriptElm = doc.getElementById(HYDRATE_SCRIPT_ID);
  if (hydrateScriptElm) {
    // remove the prerender script the browser used to hydrate
    // and prerender the webpage with
    hydrateScriptElm.remove();
  }

  const loaderScriptElm = doc.getElementById(LOADER_SCRIPT_ID);
  if (loaderScriptElm) {
    // don't really need to leave this id on the script element
    loaderScriptElm.removeAttribute('id');

    // we added type="disable-script" just so the script didn't run during
    // prerender, so let's remove it so the script runs on the client
    loaderScriptElm.removeAttribute('type');
  }
}
