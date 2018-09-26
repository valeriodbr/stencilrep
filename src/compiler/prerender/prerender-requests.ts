import * as d from '../../declarations';
import * as puppeteer from 'puppeteer'; // for types only
import { URL } from 'url';


export async function interceptRequests(input: d.PrerenderInput, pageAnalysis: d.PageAnalysis, page: puppeteer.Page) {
  await page.setRequestInterception(true);

  page.on('request', async (interceptedRequest) => {
    const resourceType = interceptedRequest.resourceType();

    const url = new URL(interceptedRequest.url());

    if (shouldAbort(input, url, resourceType)) {
      addRequest(input, pageAnalysis, url, resourceType, 'aborted');
      await interceptedRequest.abort();

    } else {
      addRequest(input, pageAnalysis, url, resourceType);
      await interceptedRequest.continue();
    }
  });
}


function addRequest(input: d.PrerenderInput, pageAnalysis: d.PageAnalysis, parsedUrl: d.Url, resourceType: string, status?: string) {
  if (resourceType === 'document') {
    return;
  }

  if (input.devServerHost === parsedUrl.host) {
    pageAnalysis.requests.push({
      path: parsedUrl.path,
      status: status
    });

  } else {
    pageAnalysis.requests.push({
      url: parsedUrl.href,
      status: status
    });
  }
}


function shouldAbort(input: d.PrerenderInput, url: URL, resourceType: puppeteer.ResourceType) {
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

  if (url.pathname.includes('data:image')) {
    return true;
  }

  if (input.devServerHost === url.host) {
    return false;
  }

  const allowDomain = input.allowDomains.some(allowDomain => {
    return url.host === allowDomain;
  });

  return !allowDomain;
}
