import * as d from '../../../declarations';


export async function optimizePrerenderedDocument(pageAnalysis: d.PageAnalysis, doc: HTMLDocument) {
  updateCanonicalLink(pageAnalysis, doc);
}


function updateCanonicalLink(pageAnalysis: d.PageAnalysis, doc: HTMLDocument) {
  // <link rel="canonical" href="https://stenciljs.com" />
  const canonicalLink = doc.head.querySelector('link[rel="canonical"][href]');
  if (canonicalLink) {
    const href = canonicalLink.getAttribute('href') + pageAnalysis.path;
    canonicalLink.setAttribute('href', href);
  }
}
