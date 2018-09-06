import * as d from '../declarations';
import { getLatestCompilerVersion, validateCompilerVersion } from '../sys/node/check-version';
import { hasError } from './cli-utils';


export async function taskBuild(process: NodeJS.Process, config: d.Config, flags: d.ConfigFlags) {
  const { Compiler } = require('../compiler/index.js');

  const compiler: d.Compiler = new Compiler(config);
  if (!compiler.isValid) {
    process.exit(1);
  }

  let devServerStart: Promise<d.DevServer> = null;

  if (shouldStartDevServer(config, flags)) {
    devServerStart = compiler.startDevServer();
  }

  const latestVersion = getLatestCompilerVersion(config.sys, config.logger);

  const results = await compiler.build();

  let devServer: d.DevServer = null;
  if (devServerStart) {
    devServer = await devServerStart;
  }

  if (!config.watch && hasError(results && results.diagnostics)) {
    config.sys.destroy();

    if (devServer) {
      await devServer.close();
    }

    process.exit(1);
  }

  if (config.watch || devServerStart) {
    process.once('SIGINT', () => {
      config.sys.destroy();

      if (devServer) {
        devServer.close();
      }
    });
  }

  await validateCompilerVersion(config, latestVersion);

  return results;
}


function shouldStartDevServer(config: d.Config, flags: d.ConfigFlags) {
  if (config.devServer && flags.serve) {
    return true;
  }

  const prerenderOutputTarget = (config.outputTargets as d.OutputTargetWww[]).some(o => {
    return o.type === 'www' && o.indexHtml && o.hydrateComponents && o.prerenderLocations && o.prerenderLocations.length > 0;
  });

  if (prerenderOutputTarget) {
    return true;
  }

  return false;
}
