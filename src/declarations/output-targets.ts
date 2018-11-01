import * as d from '.';


export interface OutputTargetWww extends OutputTargetBase {
  /**
   * Webapp output target.
   */
  type: 'www';

  /**
   * The directory to write the app's JavaScript and CSS build
   * files to. The default is to place this directory as a child
   * to the `dir` config. Default: `build`
   */
  buildDir?: string;

  /**
   * The directory to write the entire application to.
   * Note, the `buildDir` is where the app's JavaScript and CSS build
   * files are written. Default: `www`
   */
  dir?: string;

  /**
   * Empty the build directory of all files and directories on first build.
   * Default: `true`
   */
  empty?: boolean;

  resourcesUrl?: string;

  /**
   * The default index html file of the app, commonly found at the
   * root of the `src` directory.
   * Default: `index.html`
   */
  indexHtml?: string;

  serviceWorker?: d.ServiceWorkerConfig | null;

  /**
   * The base url of the app, which should be a relative path.
   * Default: `/`
   */
  baseUrl?: string;

  /**
   * Add a canonical link to the `<head>`. Default: `true`
   */
  canonicalLink?: boolean;

  /**
   * If extra whitespace should be removed from the prerendered
   * HTML or not. Default: `true`
   */
  collapseWhitespace?: boolean;

  /**
   * If components should be hydrated while prerendering.
   * Default: `true`
   */
  hydrateComponents?: boolean;

  /**
   * If styles should be inlined during prerendering.
   * Default: `true`
   */
  inlineStyles?: boolean;

  inlineAssetsMaxSize?: number;

  /**
   * A prerendered page is already static HTML and CSS, and JavaScript is not
   * required to hydrate the components. By default the client-side script
   * will also kick in and turn the static HTML into a JavaScript enabled
   * webapp. To avoid client-side hydration and leave the prerendered HTML and CSS
   * to stay static without any JavaScript, set this value to `false`.
   * Default: `true`
   */
  prerenderClientHydrate?: boolean;

  /**
   * If prerendering should continue to crawl local links and prerender.
   * Default: `true`
   */
  prerenderUrlCrawl?: boolean;

  /**
   * The starting points for prerendering. This should be relative
   * paths. Default config is to starting at the index page: `/`.
   * Default: `[{ path: '/' }]`
   */
  prerenderLocations?: { path: string; }[];

  /**
   * This filter is called for every url found while crawling. Returning
   * `true` allows the URL to be crawled, and returning `false` will skip
   * the URL for prerendering. Default: `undefined`
   */
  prerenderFilter?: (url: d.Url) => boolean;

  /**
   * Format the HTML all pretty-like. Great for debugging, bad for build performance.
   */
  prettyHtml?: boolean;

  /**
   * Keep hashes in the URL while prerendering. Default: `false`
   */
  prerenderPathHash?: boolean;

  /**
   * Keep querystrings in the URL while prerendering. Default: `false`
   */
  prerenderPathQuery?: boolean;

  /**
   * By default, requests to external domains are aborted, while all
   * requests to the prerendering dev server are allowed. If the app
   * is dependent on any external domains they should be added here.
   */
  prerenderAllowDomains?: string[];

  /**
   * Analyze each page after prerendering and removes any CSS not used.
   * Default: `true`
   */
  removeUnusedStyles?: boolean;

  pageAnalysis?: {
    dir?: string;
  };
}


export interface OutputTargetHydrate extends OutputTargetWww, d.HydrateOptions {
  html?: string;
  url?: string;
  path?: string;
  referrer?: string;
  userAgent?: string;
  cookie?: string;
  direction?: string;
  language?: string;
  isPrerender?: boolean;
  serializeHtml?: boolean;
  destroyDom?: boolean;
}


export interface OutputTargetDist extends OutputTargetBase {
  type: 'dist';

  buildDir?: string;
  dir?: string;
  empty?: boolean;
  resourcesUrl?: string;

  collectionDir?: string;
  typesDir?: string;
  esmLoaderPath?: string;
}


export interface OutputTargetDocs extends OutputTargetBase {
  type: 'docs';

  readmeDir?: string;
  jsonFile?: string;
  strict?: boolean;
}


export interface OutputTargetStats extends OutputTargetBase {
  type: 'stats';

  file?: string;
}


export interface OutputTargetAngular extends OutputTargetBase {
  type: 'angular';

  componentCorePackage?: string;
  directivesProxyFile?: string;
  directivesArrayFile?: string;
  excludeComponents?: string[];
  useDirectives?: boolean;
}


export interface OutputTargetBase {
  type: string;
  appBuild?: boolean;
}


export type OutputTargetBuild =
 | OutputTargetDist
 | OutputTargetHydrate
 | OutputTargetWww;


export type OutputTarget =
 | OutputTargetAngular
 | OutputTargetStats
 | OutputTargetDocs
 | OutputTargetHydrate
 | OutputTargetDist
 | OutputTargetWww;
