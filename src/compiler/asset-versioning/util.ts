import * as d from '../../declarations';


export function getFilePathFromUrl(_config: d.Config, _outputTarget: d.OutputTargetHydrate, _windowLocationHref: string, _url: string): string {
  throw new Error('TODO!!');
}


export function createHashedFileName(fileName: string, hash: string) {
  const parts = fileName.split('.');
  parts.splice(parts.length - 1, 0, hash);
  return parts.join('.');
}
