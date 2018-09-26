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
      finalizeDocumentAfterPrerender(doc);

      // now that we've prerendered the content
      // let's optimize the document node even further
      await optimizePrerenderedDocument(doc);

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


function extractResolvedAnchorUrls(anchorUrls: string[], elm: Element) {
  if (elm) {

    if (elm.nodeName === 'A') {
      const resolvedAnchorUrl = elm.getAttribute('data-resolved-path');
      if (resolvedAnchorUrl) {
        if (!anchorUrls.includes(resolvedAnchorUrl)) {
          anchorUrls.push(resolvedAnchorUrl);
        }
        elm.removeAttribute('data-resolved-path');
      }
    }

    if (elm.shadowRoot) {
      const children = elm.shadowRoot.children;
      for (let i = 0; i < children.length; i++) {
        extractResolvedAnchorUrls(anchorUrls, children[i]);
      }
    }

    const children = elm.children as any;
    if (children) {
      for (let i = 0; i < children.length; i++) {
        extractResolvedAnchorUrls(anchorUrls, children[i]);
      }
    }
  }
}


function finalizeDocumentAfterPrerender(doc: HTMLDocument) {
  const prerenderPrepareScriptElm = doc.getElementById('prerender-prepare-script');
  if (prerenderPrepareScriptElm) {
    prerenderPrepareScriptElm.remove();
  }
}
