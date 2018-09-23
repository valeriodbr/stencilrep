import * as d from '../../declarations';
import * as puppeteer from 'puppeteer'; // for types only


export async function interceptRequests(config: d.Config, outputTarget: d.OutputTargetWww, buildCtx: d.BuildCtx, devServerHost: string, page: puppeteer.Page, results: d.PrerenderResults) {
  await page.setRequestInterception(true);

  page.on('request', async (interceptedRequest) => {
    let url = interceptedRequest.url();
    const resourceType = interceptedRequest.resourceType();

    const parsedUrl = config.sys.url.parse(url);

    if (shouldAbort(devServerHost, outputTarget, parsedUrl, resourceType)) {
      addRequest(results, devServerHost, parsedUrl, resourceType, 'aborted');
      await interceptedRequest.abort();

    } else if (isCoreScript(buildCtx, parsedUrl, resourceType)) {
      url = url.replace(buildCtx.coreFileName, buildCtx.coreSsrFileName);

      await interceptedRequest.continue({
        url: url
      });

    } else {
      addRequest(results, devServerHost, parsedUrl, resourceType);
      await interceptedRequest.continue();
    }
  });
}


function addRequest(results: d.PrerenderResults, devServerHost: string, parsedUrl: d.Url, resourceType: string, status?: string) {
  if (resourceType === 'document') {
    return;
  }

  if (devServerHost === parsedUrl.host) {
    results.requests.push({
      path: parsedUrl.path,
      status: status
    });

  } else {
    results.requests.push({
      url: parsedUrl.href,
      status: status
    });
  }
}


function isCoreScript(buildCtx: d.BuildCtx, parsedUrl: d.Url, resourceType: puppeteer.ResourceType) {
  if (resourceType !== 'script') {
    return false;
  }

  const pathSplit = parsedUrl.pathname.split('/');
  const fileName = pathSplit[pathSplit.length - 1];

  return (fileName === buildCtx.coreFileName);
}


function shouldAbort(devServerHost: string, outputTargets: d.OutputTargetWww, parsedUrl: d.Url, resourceType: puppeteer.ResourceType) {
  if (resourceType === 'image') {
    return true;
  }

  if (resourceType === 'media') {
    return true;
  }

  if (resourceType === 'font') {
    return true;
  }

  if (resourceType === 'manifest') {
    return true;
  }

  if (resourceType === 'websocket') {
    return true;
  }

  if (parsedUrl.path.includes('data:image')) {
    return true;
  }

  if (devServerHost === parsedUrl.host) {
    return false;
  }

  const allowDomain = outputTargets.prerenderAllowDomains.some(prerenderAllowDomain => {
    return parsedUrl.host === prerenderAllowDomain;
  });

  return !allowDomain;
}
