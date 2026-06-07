import fs from 'node:fs';
import path from 'node:path';

export interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
}

type Check = (dir: string) => Promise<CheckResult>;

const checks: Check[] = [
  licenseMit,
  agentManifest,
  bundleSize,
  noCloudInference,
  noTracking,
  webWorkerInference,
  modelCacheRequired,
  privacyNoExfil,
  darkMode,
];

/** Run all compliance checks on a directory. */
export async function runChecks(dir: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  for (const check of checks) {
    results.push(await check(dir));
  }
  return results;
}

// --- Checks ---

async function licenseMit(dir: string): Promise<CheckResult> {
  const licensePath = path.join(dir, 'LICENSE');
  if (!fs.existsSync(licensePath)) {
    return { name: 'license-mit', status: 'fail', message: 'No LICENSE file found' };
  }
  const content = fs.readFileSync(licensePath, 'utf-8');
  if (!content.toLowerCase().includes('mit license')) {
    return { name: 'license-mit', status: 'fail', message: 'LICENSE must be MIT' };
  }
  return { name: 'license-mit', status: 'pass' };
}

async function agentManifest(dir: string): Promise<CheckResult> {
  const manifestPath = path.join(dir, 'agent.json');
  if (!fs.existsSync(manifestPath)) {
    return { name: 'agent-manifest', status: 'fail', message: 'No agent.json found' };
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const required = ['name', 'description', 'version', 'task', 'category', 'models'];
    const missing = required.filter((k) => !(k in manifest));
    if (missing.length > 0) {
      return {
        name: 'agent-manifest',
        status: 'fail',
        message: `Missing fields: ${missing.join(', ')}`,
      };
    }
    return { name: 'agent-manifest', status: 'pass' };
  } catch {
    return { name: 'agent-manifest', status: 'fail', message: 'Invalid JSON in agent.json' };
  }
}

async function bundleSize(dir: string): Promise<CheckResult> {
  const distDir = path.join(dir, 'web', 'dist');
  if (!fs.existsSync(distDir)) {
    return {
      name: 'bundle-size',
      status: 'warn',
      message: 'No dist/ directory found (not built?)',
    };
  }
  let totalSize = 0;
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else totalSize += fs.statSync(full).size;
    }
  };
  walk(distDir);
  const mb = totalSize / (1024 * 1024);
  if (mb > 1) {
    return {
      name: 'bundle-size',
      status: 'fail',
      message: `Bundle is ${mb.toFixed(1)}MB (max 1MB, excluding models)`,
    };
  }
  return { name: 'bundle-size', status: 'pass' };
}

async function noCloudInference(dir: string): Promise<CheckResult> {
  const cloudApis = [
    'api.openai.com',
    'api.anthropic.com',
    'generativelanguage.googleapis.com',
    'api.replicate.com',
    'api.together.xyz',
  ];
  const srcDir = path.join(dir, 'web', 'src');
  if (!fs.existsSync(srcDir)) return { name: 'no-cloud-inference', status: 'pass' };

  const issues: string[] = [];
  const walkSrc = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walkSrc(full);
      else if (entry.name.match(/\.(ts|tsx|js|jsx)$/)) {
        const content = fs.readFileSync(full, 'utf-8');
        for (const api of cloudApis) {
          if (content.includes(api)) {
            issues.push(`${path.relative(dir, full)}: references ${api}`);
          }
        }
      }
    }
  };
  walkSrc(srcDir);

  if (issues.length > 0) {
    return {
      name: 'no-cloud-inference',
      status: 'fail',
      message: `Cloud AI APIs found:\n  ${issues.join('\n  ')}`,
    };
  }
  return { name: 'no-cloud-inference', status: 'pass' };
}

async function noTracking(dir: string): Promise<CheckResult> {
  const trackers = [
    'google-analytics.com',
    'googletagmanager.com',
    'segment.com',
    'mixpanel.com',
    'amplitude.com',
    'hotjar.com',
    'facebook.net/tr',
  ];
  const srcDir = path.join(dir, 'web', 'src');
  if (!fs.existsSync(srcDir)) return { name: 'no-tracking', status: 'pass' };

  const issues: string[] = [];
  const walkSrc = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walkSrc(full);
      else if (entry.name.match(/\.(ts|tsx|js|jsx|html)$/)) {
        const content = fs.readFileSync(full, 'utf-8');
        for (const tracker of trackers) {
          if (content.includes(tracker)) {
            issues.push(`${path.relative(dir, full)}: contains ${tracker}`);
          }
        }
      }
    }
  };
  walkSrc(srcDir);

  if (issues.length > 0) {
    return { name: 'no-tracking', status: 'fail', message: issues.join('; ') };
  }
  return { name: 'no-tracking', status: 'pass' };
}

async function webWorkerInference(_dir: string): Promise<CheckResult> {
  // TODO: Check that AI model loading happens inside a Web Worker, not main thread
  return { name: 'web-worker-inference', status: 'warn', message: 'Check not yet implemented' };
}

async function modelCacheRequired(_dir: string): Promise<CheckResult> {
  // TODO: Check that Cache Storage API is used for model caching
  return { name: 'model-cache-required', status: 'warn', message: 'Check not yet implemented' };
}

async function privacyNoExfil(_dir: string): Promise<CheckResult> {
  // TODO: Check that no user data is sent to external services
  return { name: 'privacy-no-exfil', status: 'warn', message: 'Check not yet implemented' };
}

async function darkMode(_dir: string): Promise<CheckResult> {
  // TODO: Check for prefers-color-scheme support
  return { name: 'dark-mode', status: 'warn', message: 'Check not yet implemented' };
}
