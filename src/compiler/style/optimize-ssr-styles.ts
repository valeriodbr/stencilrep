import * as d from '../../declarations';
import { catchError } from '../util';
import { removeUnusedStyles } from './remove-unused-styles';
import { UsedSelectors } from '../html/used-selectors';


export function optimizeSsrStyles(config: d.Config, outputTarget: d.OutputTargetHydrate, results: d.PrerenderResults) {
  if (outputTarget.removeUnusedStyles === false) {
    return;
  }

  const ssrStyleElm = mergeSsrStyles(results.document);

  if (ssrStyleElm == null) {
    return;
  }

  // removeUnusedStyles is the default
  try {
    // pick out all of the selectors that are actually
    // being used in the html document
    const usedSelectors = new UsedSelectors(results.document.documentElement);

    // remove any selectors that are not used in this document
    ssrStyleElm.innerHTML = removeUnusedStyles(config, usedSelectors, ssrStyleElm.innerHTML, results.diagnostics);

  } catch (e) {
    catchError(results.diagnostics, e);
  }
}


function mergeSsrStyles(doc: Document) {
  // get all the styles that were added during prerendering
  const ssrStyleElms = doc.head.querySelectorAll(`style[data-styles]`) as NodeListOf<HTMLStyleElement>;

  if (ssrStyleElms.length === 0) {
    // this doc doesn't have any ssr styles
    return null;
  }

  const styleText: string[] = [];
  let ssrStyleElm: HTMLStyleElement;

  for (let i = ssrStyleElms.length - 1; i >= 0; i--) {
    // iterate backwards for funzies
    ssrStyleElm = ssrStyleElms[i];

    // collect up all the style text from each style element
    styleText.push(ssrStyleElm.innerHTML);

    // remove this style element from the document
    ssrStyleElm.parentNode.removeChild(ssrStyleElm);

    if (i === 0) {
      // this is the first style element, let's use this
      // same element as the main one we'll load up
      // merge all of the styles we collected into one
      ssrStyleElm.innerHTML = styleText.reverse().join('').trim();

      if (ssrStyleElm.innerHTML.length > 0) {
        // let's keep the first style element
        // and make it the first element in the head
        doc.head.insertBefore(ssrStyleElm, doc.head.firstChild);

        // return the ssr style element we loaded up
        return ssrStyleElm;
      }
    }
  }

  return null;
}
