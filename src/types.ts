export type Category =
  | 'discoverability'
  | 'content'
  | 'bot-access'
  | 'capabilities'
  | 'commerce';

export type Status = 'pass' | 'fail' | 'warn' | 'skip';

export interface Target {
  origin: URL;
  contentUrl: URL;
  isLocal: boolean;
  headers: Record<string, string>;
}

export interface Evidence {
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
  };
  response?: {
    status: number;
    contentType?: string;
    bytes?: number;
    preview?: string;
    finalUrl?: string;
    redirectChain?: string[];
  };
  note?: string;
}

export interface CheckResult {
  id: string;
  category: Category;
  title: string;
  status: Status;
  message: string;
  spec: { url: string; asOf: string };
  evidence: Evidence;
  remediationPromptPath?: string;
  remediation?: {
    suggestion: string;
    promptPath?: string;
    verifyCommand: string;
  };
}

export interface Check {
  id: string;
  category: Category;
  title: string;
  spec: { url: string; asOf: string };
  defaultEnabled: boolean;
  scored: boolean;
  /** Check inspects a single content page — included in --crawl sampling. */
  pageScoped?: boolean;
  run(target: Target, http: HttpClient, options?: CheckRunOptions): Promise<CheckResult>;
}

export interface CheckRunOptions {
  commerceUrl?: URL;
  mcpUrl?: URL;
  verifySkillDigests: boolean;
}

export interface HttpResponse {
  status: number;
  headers: Headers;
  body: Uint8Array;
  contentType: string;
  finalUrl: string;
  redirectChain: string[];
}

export interface HttpClient {
  fetch(url: string, init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  }): Promise<HttpResponse>;
}

export interface CategorySummary {
  pass: number;
  fail: number;
  total: number;
}

export interface Report {
  version: 1;
  target: string;
  scannedAt: string;
  tool: { name: string; version: string };
  summary: Record<Category, CategorySummary>;
  checks: CheckResult[];
}
