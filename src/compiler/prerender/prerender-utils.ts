import * as d from '../../declarations';


export function getHost(config: d.Config, outputTarget: d.OutputTargetWww) {
  const parsedUrl = config.sys.url.parse(config.devServer.browserUrl);

  let host = parsedUrl.host;

  host += outputTarget.baseUrl;

  return host.toLowerCase();
}


export function queueUrlsToPrerender(config: d.Config, outputTarget: d.OutputTargetWww, host: string, queuedUrls: string[], processingUrls: Set<string>, completedUrls: Set<string>, url: string) {
  if (typeof url !== 'string') {
    return;
  }

  url = url.trim();

  const parsedUrl = config.sys.url.parse(url);

  if (parsedUrl.host.toLowerCase() !== host.toLowerCase()) {
    return;
  }

  if (!outputTarget.prerenderPathHash || !outputTarget.prerenderPathQuery) {
    const hash = (parsedUrl.hash || '').split('?')[0];
    const search = (parsedUrl.search || '').split('#')[0];

    url = url.split('?')[0].split('#')[0];

    if (search) {
      url += search;
    }

    if (hash) {
      url += hash;
    }
  }

  if (queuedUrls.includes(url)) {
    return;
  }

  if (processingUrls.has(url)) {
    return;
  }

  if (completedUrls.has(url)) {
    return;
  }

  queuedUrls.push(url);
}




// export function normalizePrerenderLocation(config: d.Config, outputTarget: d.OutputTargetWww, windowLocationHref: string, url: string) {
//   let prerenderLocation: d.PrerenderLocation = null;

//   try {
//     if (typeof url !== 'string') {
//       return null;
//     }

//     // remove any quotes that somehow got in the href
//     url = url.replace(/\'|\"/g, '');

//     // parse the <a href> passed in
//     const hrefParseUrl = config.sys.url.parse(url);

//     // don't bother for basically empty <a> tags
//     if (!hrefParseUrl.pathname) {
//       return null;
//     }

//     // parse the window.location
//     const windowLocationUrl = config.sys.url.parse(windowLocationHref);

//     // urls must be on the same host
//     // but only check they're the same host when the href has a host
//     if (hrefParseUrl.hostname && hrefParseUrl.hostname !== windowLocationUrl.hostname) {
//       return null;
//     }

//     // convert it back to a nice in pretty path
//     prerenderLocation = {
//       path: config.sys.url.resolve(windowLocationHref, url)
//     };

//     const normalizedUrl = config.sys.url.parse(prerenderLocation.url);
//     normalizedUrl.hash = null;

//     if (!outputTarget.prerenderPathQuery) {
//       normalizedUrl.search = null;
//     }

//     prerenderLocation.path = config.sys.url.parse(prerenderLocation.url).path;

//     if (!prerenderLocation.path.startsWith(outputTarget.baseUrl)) {
//       if (prerenderLocation.path !== outputTarget.baseUrl.substr(0, outputTarget.baseUrl.length - 1)) {
//         return null;
//       }
//     }

//     const filter = (typeof outputTarget.prerenderFilter === 'function') ? outputTarget.prerenderFilter : prerenderFilter;
//     const isValidUrl = filter(hrefParseUrl);
//     if (!isValidUrl) {
//       return null;
//     }

//     if (hrefParseUrl.hash && outputTarget.prerenderPathHash) {
//       prerenderLocation.path += hrefParseUrl.hash;
//     }

//   } catch (e) {
//     config.logger.error(`normalizePrerenderLocation`, e);
//     return null;
//   }

//   return prerenderLocation;
// }


// function prerenderFilter(url: d.Url) {
//   const parts = url.pathname.split('/');
//   const basename = parts[parts.length - 1];
//   return !basename.includes('.');
// }



// export function crawlAnchorsForNextUrls(config: d.Config, outputTarget: d.OutputTargetWww, prerenderQueue: d.PrerenderLocation[], windowLocationHref: string, anchors: d.HydrateAnchor[]) {
//   anchors && anchors.forEach(anchor => {
//     if (isValidCrawlableAnchor(anchor)) {
//       addLocationToProcess(config, outputTarget, windowLocationHref, prerenderQueue, anchor.href);
//     }
//   });
// }


// export function isValidCrawlableAnchor(anchor: d.HydrateAnchor) {
//   if (!anchor) {
//     return false;
//   }

//   if (typeof anchor.href !== 'string' || anchor.href.trim() === '' || anchor.href.trim() === '#') {
//     return false;
//   }

//   if (typeof anchor.target === 'string' && anchor.target.trim().toLowerCase() !== '_self') {
//     return false;
//   }

//   return true;
// }
