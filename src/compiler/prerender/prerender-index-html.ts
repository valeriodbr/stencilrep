import * as d from '../../declarations';


export async function prepareIndexHtml(config: d.Config, compilerCtx: d.CompilerCtx, outputTarget: d.OutputTargetWww) {
  const srcIndexHtmlContent = await compilerCtx.fs.readFile(config.srcIndexHtml);
  await compilerCtx.fs.writeFile(outputTarget.indexHtml, srcIndexHtmlContent);
}
