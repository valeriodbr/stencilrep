import * as d from '../../declarations';


export function createContext(_compilerCtx: d.CompilerCtx, _outputTarget: d.OutputTargetWww, sandbox: any) {
  const vm = require('vm');

  patchRaf(sandbox);

  return vm.createContext(sandbox);
}


function patchRaf(sandbox: any) {
  if (!sandbox.requestAnimationFrame) {
    sandbox.requestAnimationFrame = function(callback: Function) {
      const id = sandbox.setTimeout(function() {
        callback(Date.now());
      }, 0);

      return id;
    };

    sandbox.cancelAnimationFrame = function(id: any) {
      clearTimeout(id);
    };
  }
}





export function runInContext(code: string, contextifiedSandbox: any, options: any) {
  const vm = require('vm');
  vm.runInContext(code, contextifiedSandbox, options);
}
