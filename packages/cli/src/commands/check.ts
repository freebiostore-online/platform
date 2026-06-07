import { runChecks } from '@freebiostore/compliance';

export async function check() {
  const cwd = process.cwd();
  console.log(`Running compliance checks in ${cwd}...`);
  console.log('');

  const results = await runChecks(cwd);
  let passed = 0;
  let failed = 0;
  let warned = 0;

  for (const result of results) {
    if (result.status === 'pass') {
      passed++;
      console.log(`  ✓ ${result.name}`);
    } else if (result.status === 'warn') {
      warned++;
      console.log(`  ⚠ ${result.name}: ${result.message}`);
    } else {
      failed++;
      console.log(`  ✗ ${result.name}: ${result.message}`);
    }
  }

  console.log('');
  console.log(`${passed} passed, ${warned} warnings, ${failed} failed`);

  if (failed > 0) process.exit(1);
}
