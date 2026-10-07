#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

/**
 * Locate repository root directory.
 */
function findRepoRoot() {
  let dir = currentDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf-8'));
        if (pkg.name === 'fall-2026-assignment-04' || pkg.devDependencies?.['@mermaid-js/mermaid-cli']) {
          return dir;
        }
      } catch {
        // continue walking up
      }
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const repoRoot = findRepoRoot();

/**
 * Locate the mmdc executable from @mermaid-js/mermaid-cli.
 */
function findMmdcExecutable(root) {
  const localCli = path.join(root, 'node_modules', '@mermaid-js', 'mermaid-cli', 'src', 'cli.js');
  if (fs.existsSync(localCli)) {
    return { exec: process.execPath, args: [localCli] };
  }

  const binMmdc = path.join(root, 'node_modules', '.bin', 'mmdc');
  if (fs.existsSync(binMmdc)) {
    return { exec: process.execPath, args: [binMmdc] };
  }

  return { exec: 'npx', args: ['mmdc'] };
}

/**
 * Resolve a relative or absolute file path against cwd and repoRoot.
 */
function resolvePath(filePath, fallbackBase) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }
  const fromCwd = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }
  const fromRepo = path.resolve(fallbackBase, filePath);
  if (fs.existsSync(fromRepo)) {
    return fromRepo;
  }
  return fromCwd;
}

/**
 * Execute child process and capture output and exit code.
 */
function executeProcess(executable, args, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(executable.exec, [...executable.args, ...args], {
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...extraEnv },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: err.message });
    });
  });
}

async function main() {
  // Input file: default to docs/architecture/schema.md or use CLI argument
  let inputArg = process.argv[2];
  if (!inputArg) {
    const mdPath = resolvePath('docs/architecture/schema.md', repoRoot);
    const mmdPath = resolvePath('docs/architecture/schema.mmd', repoRoot);
    if (fs.existsSync(mdPath)) {
      inputArg = 'docs/architecture/schema.md';
    } else if (fs.existsSync(mmdPath)) {
      inputArg = 'docs/architecture/schema.mmd';
    } else {
      inputArg = 'docs/architecture/schema.md';
    }
  }

  const resolvedInput = resolvePath(inputArg, repoRoot);

  if (!fs.existsSync(resolvedInput)) {
    console.error(`SYNTAX_ERROR: syntax error - Input file "${inputArg}" not found at ${resolvedInput}`);
    process.exit(1);
  }

  // Output file: default to docs/architecture/erd.svg
  const defaultOutput = 'docs/architecture/erd.svg';
  const outputArg = process.argv[3] || defaultOutput;
  const resolvedOutput = path.isAbsolute(outputArg)
    ? outputArg
    : path.resolve(repoRoot, outputArg);

  const outputDir = path.dirname(resolvedOutput);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Clear any existing output artifacts from earlier runs to ensure fresh compilation
  const ext = path.extname(resolvedOutput);
  const baseWithoutExt = resolvedOutput.slice(0, -ext.length);
  const numberedOutput = `${baseWithoutExt}-1${ext}`;

  if (fs.existsSync(numberedOutput)) {
    try {
      fs.unlinkSync(numberedOutput);
    } catch {
      // ignore
    }
  }

  const mmdcExec = findMmdcExecutable(repoRoot);
  const inputContent = fs.readFileSync(resolvedInput, 'utf-8');
  const isMarkdown = /\.(md|markdown)$/i.test(resolvedInput);
  const hasFencedMermaid = /[`:]{3}mermaid[\s\S]*?[`:]{3}/i.test(inputContent);

  let tempMmdFile = null;
  let effectiveInput = resolvedInput;

  // If input is a markdown file with raw mermaid syntax but without ```mermaid code fences,
  // mermaid-cli's markdown parser will find 0 charts. In this case, pass the raw content via temp .mmd
  if (isMarkdown && !hasFencedMermaid && inputContent.trim().length > 0) {
    tempMmdFile = path.join(outputDir, `.temp_${Date.now()}.mmd`);
    fs.writeFileSync(tempMmdFile, inputContent, 'utf-8');
    effectiveInput = tempMmdFile;
  }

  try {
    const mmdcArgs = ['-i', effectiveInput, '-o', resolvedOutput];
    let result = await executeProcess(mmdcExec, mmdcArgs);

    // If puppeteer fails due to sandbox constraints in container/Linux environments, retry with puppeteer config
    if (result.code !== 0 && (result.stderr.includes('sandbox') || result.stderr.includes('Failed to launch the browser process'))) {
      const tempPuppeteerConfig = path.join(outputDir, `.puppeteer_${Date.now()}.json`);
      try {
        fs.writeFileSync(
          tempPuppeteerConfig,
          JSON.stringify({ args: ['--no-sandbox', '--disable-setuid-sandbox'] }),
          'utf-8',
        );
        result = await executeProcess(mmdcExec, [...mmdcArgs, '-p', tempPuppeteerConfig]);
      } finally {
        if (fs.existsSync(tempPuppeteerConfig)) {
          fs.unlinkSync(tempPuppeteerConfig);
        }
      }
    }

    if (result.code !== 0) {
      const errorMsg = (result.stderr || result.stdout || 'Compilation error').trim();
      console.error(`SYNTAX_ERROR: syntax error - ${errorMsg}`);
      process.exit(1);
    }

    // mermaid-cli creates numbered files (e.g. erd-1.svg) when processing markdown files.
    // Ensure docs/architecture/erd.svg exists by renaming or copying the generated numbered file.
    if (!fs.existsSync(resolvedOutput) && fs.existsSync(numberedOutput)) {
      fs.renameSync(numberedOutput, resolvedOutput);
    }

    if (!fs.existsSync(resolvedOutput)) {
      console.error('SYNTAX_ERROR: syntax error - No SVG diagram was generated');
      process.exit(1);
    }

    console.log('SUCCESS');
    process.exit(0);
  } finally {
    if (tempMmdFile && fs.existsSync(tempMmdFile)) {
      try {
        fs.unlinkSync(tempMmdFile);
      } catch {
        // ignore
      }
    }
  }
}

main().catch((err) => {
  console.error(`SYNTAX_ERROR: syntax error - ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
