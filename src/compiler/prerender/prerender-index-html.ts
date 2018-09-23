import * as d from '../../declarations';
import { parseHtmlToDocument, serializeNodeToHtml } from '@stencil/core/mock-doc';


export async function prepareIndexHtml(config: d.Config, compilerCtx: d.CompilerCtx, outputTarget: d.OutputTargetWww) {
  let indexHtml = await compilerCtx.fs.readFile(config.srcIndexHtml);

  const doc = parseHtmlToDocument(indexHtml);

  modifyIndexDocument(doc);

  indexHtml = serializeNodeToHtml(doc);

  await compilerCtx.fs.writeFile(outputTarget.indexHtml, indexHtml);
}


async function modifyIndexDocument(doc: Document) {

}
