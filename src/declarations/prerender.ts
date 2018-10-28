import * as d from '.';


export interface PrerenderInput {
  browserWsEndpoint: string;
  devServerHost: string;
  path: string;
  filePath: string;
  pageAnalysisDir: string;
  prettyHtml: boolean;
  pathQuery: boolean;
  pathHash: boolean;
  allowDomains: string[];
}


export interface PrerenderResults {
  anchorPaths: string[];
  diagnostics: d.Diagnostic[];
}


export interface PrerenderMainResults {
  workerPrerendered: number;
  isMaster?: boolean;
  totalPrerendered?: number;
}


export interface PageAnalysis {
  path: string;
  pathname: string;
  search: string;
  hash: string;
  anchorPaths: string[];
  diagnostics: d.Diagnostic[];
  prerenderDuration?: number;
  responseStatus?: number;
  redirectLocation?: string;
  pageErrors: { message: string; stack?: string; }[];
  requests: PageRequest[];
  metrics?: PageMetrics;
  coverage?: PageCoverage;
}


export interface PageRequest {
  url?: string;
  path?: string;
  status: string;
}


export interface PageMetrics {
  appLoadDuration?: number;
  jsEventListeners?: number;
  nodes?: number;
  layoutCount?: number;
  recalcStyleCount?: number;
  layoutDuration?: number;
  recalcStyleDuration?: number;
  scriptDuration?: number;
  taskDuration?: number;
  jsHeapUsedSize?: number;
  jsHeapTotalSize?: number;
  htmlBytes?: number;
}


export interface PageCoverage {
  css: PageCoverageEntry[];
  js: PageCoverageEntry[];
}


export interface PageCoverageEntry {
  url?: string;
  path?: string;
  totalBytes?: number;
  usedBytes?: number;
}


export interface PrerenderContext {
  config: d.Config;
  compilerCtx: d.CompilerCtx;
  buildCtx: d.BuildCtx;
  outputTarget: d.OutputTargetWww;
  job: PrerenderJob;
  browserWsEndpoint: string;
  devServerHost: string;
  completedCallback(results: d.PrerenderMainResults): void;
  workerPrerendered: number;
}


export interface PrerenderJob {
  init(): Promise<void>;
  queue(paths: string[]): Promise<void>;
  next(maxConcurrentPrerender: number): Promise<ProcessorNext>;
  completed(path: string): Promise<void>;
  finalize(): Promise<void>;
}

export interface ProcessorNext {
  isCompleted: boolean;
  isMasterWorker?: boolean;
  paths: string[];
}
