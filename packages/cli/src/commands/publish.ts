import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ORG = 'FreeBioStore';
const DOMAIN = 'freebiostore.online';

function run(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; stdio?: 'pipe' | 'inherit'; encoding?: 'utf-8' },
): string {
  return execFileSync(cmd, args, { stdio: 'pipe', ...opts })?.toString() ?? '';
}

export async function publish(opts: { name?: string; category?: string }) {
  const agentJsonPath = path.resolve('agent.json');
  if (!fs.existsSync(agentJsonPath)) {
    process.stderr.write('No agent.json found. Run this from an agent directory.\n');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(agentJsonPath, 'utf-8')) as { description?: string };
  const agentId = opts.name ?? detectAgentId();

  if (!agentId) {
    process.stderr.write('Could not detect agent ID. Pass --name <id> explicitly.\n');
    process.exit(1);
  }

  process.stdout.write(`Publishing ${agentId} to FreeBioStore...\n\n`);

  // Check gh CLI auth
  try {
    run('gh', ['auth', 'status']);
  } catch {
    process.stderr.write('Not authenticated with GitHub. Run: gh auth login\n');
    process.exit(1);
  }

  // Check if repo exists
  const repoExists = checkRepoExists(agentId);

  if (repoExists) {
    process.stdout.write(`Repo ${ORG}/${agentId} already exists. Pushing updates...\n`);
  } else {
    process.stdout.write(`Creating repo ${ORG}/${agentId}...\n`);
    try {
      run('gh', [
        'repo',
        'create',
        `${ORG}/${agentId}`,
        '--public',
        '--description',
        manifest.description ?? agentId,
        '--clone=false',
      ]);
      process.stdout.write(`  Created https://github.com/${ORG}/${agentId}\n`);
    } catch (e) {
      process.stderr.write(
        `Failed to create repo: ${e instanceof Error ? e.message : String(e)}\n`,
      );
      process.exit(1);
    }
  }

  // Set up git + push
  const cwd = process.cwd();
  if (!fs.existsSync(path.join(cwd, '.git'))) {
    run('git', ['init'], { cwd });
    run('git', ['add', '-A'], { cwd });
    run('git', ['commit', '-m', 'Initial commit'], { cwd });
  }

  try {
    run('git', ['remote', 'get-url', 'origin'], { cwd });
    run('git', ['remote', 'set-url', 'origin', `https://github.com/${ORG}/${agentId}.git`], {
      cwd,
    });
  } catch {
    run('git', ['remote', 'add', 'origin', `https://github.com/${ORG}/${agentId}.git`], { cwd });
  }

  process.stdout.write(`Pushing to ${ORG}/${agentId}...\n`);
  try {
    execFileSync('git', ['push', '-u', 'origin', 'main'], { cwd, stdio: 'inherit' });
  } catch {
    try {
      const branch = run('git', ['branch', '--show-current'], { cwd }).trim();
      execFileSync('git', ['push', '-u', 'origin', `${branch}:main`], { cwd, stdio: 'inherit' });
    } catch (e) {
      process.stderr.write(`Push failed: ${e instanceof Error ? e.message : String(e)}\n`);
      process.exit(1);
    }
  }

  // Register D1 route
  process.stdout.write('\nRegistering route...\n');
  try {
    const sql = `INSERT OR IGNORE INTO routes (slug, zone, r2_prefix, store, hosted_on, created_at, updated_at) VALUES ('${agentId}', '${DOMAIN}', 'agents/${agentId}', 'agents', 'r2', strftime('%s','now'), strftime('%s','now'))`;
    execFileSync('npx', ['wrangler', 'd1', 'execute', 'fags', '--remote', '--command', sql], {
      stdio: 'pipe',
    });
    process.stdout.write(`  Route registered: /a/${agentId}/\n`);
  } catch {
    process.stdout.write(
      '  Could not register route automatically. Deploy workflow will handle it.\n',
    );
  }

  process.stdout.write(`\nPublished!\n`);
  process.stdout.write(`  Repo:  https://github.com/${ORG}/${agentId}\n`);
  process.stdout.write(`  Live:  https://${DOMAIN}/a/${agentId}/ (after first deploy)\n`);
  process.stdout.write(`  Store: https://${DOMAIN}/agents/${agentId}/\n`);
}

function detectAgentId(): string | null {
  try {
    const remote = run('git', ['remote', 'get-url', 'origin']).trim();
    const match = remote.match(/\/([a-z0-9-]+?)(?:\.git)?$/);
    if (match) return match[1];
  } catch {
    /* no git remote */
  }

  const dirName = path.basename(process.cwd());
  if (/^[a-z0-9-]+$/.test(dirName)) return dirName;
  return null;
}

function checkRepoExists(agentId: string): boolean {
  try {
    run('gh', ['repo', 'view', `${ORG}/${agentId}`, '--json', 'name']);
    return true;
  } catch {
    return false;
  }
}
