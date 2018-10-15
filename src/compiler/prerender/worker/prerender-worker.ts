import * as d from '../../../declarations';
import { catchError, hasError } from '../../util';
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
    pathname: undefined,
    search: undefined,
    hash: undefined,
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
      finalizeDocumentAfterPrerender(input, doc);

      // now that we've prerendered the content
      // let's optimize the document node even further
      await optimizePrerenderedDocument(doc);

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


function finalizeDocumentAfterPrerender(input: d.PrerenderInput, doc: HTMLDocument) {
  const prerenderPrepareScriptElm = doc.getElementById('prerender-prepare-script');
  if (prerenderPrepareScriptElm) {
    prerenderPrepareScriptElm.remove();
  }

  const loaderScript = doc.getElementById('stencil-loader-script');
  if (loaderScript) {
    loaderScript.removeAttribute('id');

    if (!input.includeLoaderScript) {
      loaderScript.remove();
    }
  }
}
