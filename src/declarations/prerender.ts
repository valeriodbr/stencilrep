import * as d from '.';


export interface PrerenderInput {
  browserWSEndpoint: string;
  devServerHost: string;
  url: string;
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


export interface PageAnalysis {
  path: string;
  pathname: string;
  search: string;
  hash: string;
  anchorPaths: string[];
  diagnostics: d.Diagnostic[];
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


export interface PrerenderProcessor {
  init(): Promise<void>;
  queue(source: string, paths: string[]): Promise<void>;
  next(maxConcurrentPrerender: number): Promise<ProcessorNext>;
  completed(path: string): Promise<void>;
  finalize(): Promise<{
    totalPrerendered: number;
  }>;
}

export interface ProcessorNext {
  isCompleted?: boolean;
  maxConcurrent?: boolean;
  noPending?: boolean;
  path?: string;
  source?: string;
}
