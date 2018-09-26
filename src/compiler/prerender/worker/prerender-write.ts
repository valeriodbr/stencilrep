import * as d from '../../../declarations';
import { serializeNodeToHtml } from '@stencil/core/mock-doc';
import * as fs from 'fs';
import * as path from 'path';


export async function writePrerenderResults(input: d.PrerenderInput, pageAnalysis: d.PageAnalysis, doc: HTMLDocument) {
  return new Promise((resolve, reject) => {
    const html = serializeNodeToHtml(doc as any, {
      pretty: input.prettyHtml,
      collapseBooleanAttributes: !input.prettyHtml,
      removeAttributeQuotes: !input.prettyHtml,
      removeEmptyAttributes: !input.prettyHtml
    });

    if (pageAnalysis.metrics) {
      pageAnalysis.metrics.htmlBytes = typeof html === 'string' ? html.length : 0;
    }

    fs.writeFile(input.filePath, html, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}


export async function writePageAnalysis(input: d.PrerenderInput, pageAnalysis: d.PageAnalysis) {
  const fileName = encodeURIComponent(input.path) + '.json';
  const filePath = path.join(input.pageAnalysisDir, fileName);

  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, JSON.stringify(pageAnalysis, null, 2), err => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
