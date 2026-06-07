import fs from 'node:fs';
import path from 'node:path';

const TEMPLATES: Record<string, string> = {
  standalone: 'template-agent-standalone',
  heuristic: 'template-agent-standalone', // alias
  'built-in-ai': 'template-agent-builtin-ai',
  'builtin-ai': 'template-agent-builtin-ai', // alias
  nano: 'template-agent-builtin-ai', // alias
  model: 'template-agent-model',
  onnx: 'template-agent-model', // alias
};

export async function init(agentId: string, _templateName: string) {
  const templateKey = _templateName.toLowerCase();
  const TEMPLATE_DIR = TEMPLATES[templateKey];
  if (!TEMPLATE_DIR) {
    console.error(`Unknown template: ${_templateName}`);
    console.error(
      `Available: ${Object.keys(TEMPLATES)
        .filter((k) => !k.includes('-'))
        .join(', ')}`,
    );
    process.exit(1);
  }
  const targetDir = path.resolve(agentId);
  if (fs.existsSync(targetDir)) {
    console.error(`Directory ${agentId} already exists.`);
    process.exit(1);
  }

  // Find template: check local templates dir, then try npm package location
  const localTemplate = findTemplate(TEMPLATE_DIR);
  if (!localTemplate) {
    console.error('Template not found. Make sure @freebiostore/cli is installed correctly.');
    process.exit(1);
  }

  console.log(`Scaffolding ${agentId} from ${TEMPLATE_DIR}...`);

  // Copy template
  copyDir(localTemplate, targetDir);

  // Replace AGENTNAME placeholder in all files
  replaceInDir(targetDir, 'AGENTNAME', agentId);

  console.log(`\nCreated ${agentId}/`);
  console.log(`\nNext steps:`);
  console.log(`  cd ${agentId}`);
  console.log(`  pnpm install`);
  console.log(`  pnpm dev`);
  console.log(`\nEdit web/src/App.tsx to build your agent.`);
  console.log(`When ready: fags publish`);
}

function findTemplate(templateDir: string): string | null {
  // Try relative to CLI package (when installed via npm)
  const cliDir = path.dirname(new URL(import.meta.url).pathname);
  const candidates = [
    path.resolve(cliDir, '..', '..', '..', 'templates', templateDir),
    path.resolve(cliDir, '..', '..', 'templates', templateDir),
    // When running from the monorepo
    path.resolve(process.cwd(), '..', 'templates', templateDir),
    path.resolve(process.cwd(), '..', '..', 'templates', templateDir),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'agent.json'))) {
      return candidate;
    }
  }
  return null;
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function replaceInDir(dir: string, search: string, replace: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      replaceInDir(fullPath, search, replace);
    } else if (entry.name.match(/\.(json|ts|tsx|html|md|css|yaml|yml)$/)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      if (content.includes(search)) {
        fs.writeFileSync(fullPath, content.replaceAll(search, replace));
      }
    }
  }
}
