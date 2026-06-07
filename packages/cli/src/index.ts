#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command()
  .name('fags')
  .description('FreeBioStore CLI — scaffold, check, and publish browser AI agents.')
  .version('0.2.0');

program
  .command('init <agent-id>')
  .description('Scaffold a new agent from the template')
  .option('-t, --template <name>', 'template to use (currently only standalone)', 'standalone')
  .action(async (agentId: string, _opts: { template: string }) => {
    const { init } = await import('./commands/init.js');
    await init(agentId, _opts.template);
  });

program
  .command('check')
  .description('Run compliance checks on current agent')
  .action(async () => {
    const { check } = await import('./commands/check.js');
    await check();
  });

program
  .command('publish')
  .description('Publish agent to FreeBioStore (creates repo, pushes code, registers route)')
  .option('--name <id>', 'Agent ID (lowercase, hyphens). Defaults to directory name.')
  .option('--category <category>', 'Agent category')
  .action(async (opts: { name?: string; category?: string }) => {
    const { publish } = await import('./commands/publish.js');
    await publish(opts);
  });

program.parse();
