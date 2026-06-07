import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runChecks } from './index.js';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'fags-compliance-'));
}

function writeFiles(dir: string, files: Record<string, string>) {
  for (const [filePath, content] of Object.entries(files)) {
    const full = path.join(dir, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
}

describe('compliance checks', () => {
  it('license-mit fails when no LICENSE', async () => {
    const dir = tmpDir();
    const results = await runChecks(dir);
    const license = results.find((r) => r.name === 'license-mit');
    expect(license?.status).toBe('fail');
  });

  it('license-mit passes with MIT license', async () => {
    const dir = tmpDir();
    writeFiles(dir, { LICENSE: 'MIT License\n\nCopyright 2026 Test' });
    const results = await runChecks(dir);
    const license = results.find((r) => r.name === 'license-mit');
    expect(license?.status).toBe('pass');
  });

  it('agent-manifest fails when no agent.json', async () => {
    const dir = tmpDir();
    writeFiles(dir, { LICENSE: 'MIT License' });
    const results = await runChecks(dir);
    const manifest = results.find((r) => r.name === 'agent-manifest');
    expect(manifest?.status).toBe('fail');
  });

  it('agent-manifest passes with valid manifest', async () => {
    const dir = tmpDir();
    writeFiles(dir, {
      LICENSE: 'MIT License',
      'agent.json': JSON.stringify({
        name: 'Test Agent',
        description: 'A test',
        version: '1.0.0',
        task: 'test',
        category: 'audio',
        models: [{ repo: 'test/model', size: '100MB', backend: ['wasm'], task: 'test' }],
      }),
    });
    const results = await runChecks(dir);
    const manifest = results.find((r) => r.name === 'agent-manifest');
    expect(manifest?.status).toBe('pass');
  });

  it('agent-manifest fails with missing fields', async () => {
    const dir = tmpDir();
    writeFiles(dir, {
      LICENSE: 'MIT License',
      'agent.json': JSON.stringify({ name: 'Test' }),
    });
    const results = await runChecks(dir);
    const manifest = results.find((r) => r.name === 'agent-manifest');
    expect(manifest?.status).toBe('fail');
    expect(manifest?.message).toContain('Missing fields');
  });

  it('no-cloud-inference fails when OpenAI API is referenced', async () => {
    const dir = tmpDir();
    writeFiles(dir, {
      LICENSE: 'MIT License',
      'agent.json': '{}',
      'web/src/app.ts': 'const url = "https://api.openai.com/v1/chat/completions";',
    });
    const results = await runChecks(dir);
    const cloud = results.find((r) => r.name === 'no-cloud-inference');
    expect(cloud?.status).toBe('fail');
    expect(cloud?.message).toContain('api.openai.com');
  });

  it('no-cloud-inference passes with clean code', async () => {
    const dir = tmpDir();
    writeFiles(dir, {
      LICENSE: 'MIT License',
      'agent.json': '{}',
      'web/src/app.ts': 'const model = await pipeline("text-generation");',
    });
    const results = await runChecks(dir);
    const cloud = results.find((r) => r.name === 'no-cloud-inference');
    expect(cloud?.status).toBe('pass');
  });

  it('no-tracking fails with Google Analytics', async () => {
    const dir = tmpDir();
    writeFiles(dir, {
      LICENSE: 'MIT License',
      'agent.json': '{}',
      'web/src/index.html': '<script src="https://www.googletagmanager.com/gtag/js"></script>',
    });
    const results = await runChecks(dir);
    const tracking = results.find((r) => r.name === 'no-tracking');
    expect(tracking?.status).toBe('fail');
  });

  it('no-tracking passes without trackers', async () => {
    const dir = tmpDir();
    writeFiles(dir, {
      LICENSE: 'MIT License',
      'agent.json': '{}',
      'web/src/App.tsx': 'export default function App() { return <div>Hello</div> }',
    });
    const results = await runChecks(dir);
    const tracking = results.find((r) => r.name === 'no-tracking');
    expect(tracking?.status).toBe('pass');
  });

  it('bundle-size warns when no dist directory', async () => {
    const dir = tmpDir();
    writeFiles(dir, { LICENSE: 'MIT License', 'agent.json': '{}' });
    const results = await runChecks(dir);
    const size = results.find((r) => r.name === 'bundle-size');
    expect(size?.status).toBe('warn');
  });

  it('returns all 9 checks', async () => {
    const dir = tmpDir();
    writeFiles(dir, { LICENSE: 'MIT License', 'agent.json': '{}' });
    const results = await runChecks(dir);
    expect(results).toHaveLength(9);
  });
});
