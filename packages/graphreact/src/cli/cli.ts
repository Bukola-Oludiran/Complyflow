#!/usr/bin/env node
/**
 * grx CLI — run, build, and check .grx files.
 *
 * Usage:
 *   grx run <file.grx> [--async]    Run a .grx file
 *   grx build <file.grx> -o <out>   Transpile to TypeScript
 *   grx check <file.grx>            Parse and validate without running
 */

import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { Parser } from '../core/parser/parser.js';
import { transpile } from '../core/transpiler/transpile.js';
import { GrxParseError } from '../core/parser/errors.js';
import type { GrxFile, NodeDefinitionBlock } from '../core/parser/ast.js';

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case 'run':
      handleRun(args.slice(1));
      break;
    case 'build':
      handleBuild(args.slice(1));
      break;
    case 'check':
      handleCheck(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function handleRun(args: string[]): void {
  const filePath = args[0];
  if (!filePath) {
    console.error('Usage: grx run <file.grx> [--async]');
    process.exit(1);
  }

  const absPath = resolve(filePath);
  const grxFile = parseWithImports(absPath);
  const tsSource = transpile(grxFile);

  // Write to temp file and execute via tsx (using execFileSync for safety)
  const tempDir = mkdtempSync(join(tmpdir(), 'grx-'));
  const tempFile = join(tempDir, 'run.ts');
  writeFileSync(tempFile, tsSource);

  try {
    execFileSync('npx', ['tsx', tempFile], {
      stdio: 'inherit',
      cwd: dirname(absPath),
    });
  } catch {
    process.exit(1);
  }
}

function handleBuild(args: string[]): void {
  const filePath = args[0];
  if (!filePath) {
    console.error('Usage: grx build <file.grx> -o <output.ts>');
    process.exit(1);
  }

  const outputIdx = args.indexOf('-o');
  const outputPath = outputIdx >= 0 ? args[outputIdx + 1] : undefined;
  if (!outputPath) {
    console.error('Usage: grx build <file.grx> -o <output.ts>');
    process.exit(1);
  }

  const absPath = resolve(filePath);
  const grxFile = parseWithImports(absPath);
  const tsSource = transpile(grxFile);

  writeFileSync(resolve(outputPath), tsSource);
  console.log(`Transpiled: ${filePath} → ${outputPath}`);
}

function handleCheck(args: string[]): void {
  const filePath = args[0];
  if (!filePath) {
    console.error('Usage: grx check <file.grx>');
    process.exit(1);
  }

  const absPath = resolve(filePath);

  try {
    const grxFile = parseWithImports(absPath);
    const defCount = grxFile.definitions.length;
    const importCount = grxFile.imports.length;
    const hasGraph = grxFile.graph !== null;
    const nodeCount = hasGraph ? countNodes(grxFile) : 0;

    console.log(`File: ${filePath}`);
    console.log(`  Imports: ${importCount}`);
    console.log(`  Definitions: ${defCount} (${grxFile.definitions.map(d => d.component).join(', ')})`);
    console.log(`  Graph: ${hasGraph ? `"${grxFile.graph!.id}" with ${nodeCount} node declarations` : 'none (definitions only)'}`);
    console.log('  Status: OK');
  } catch (e) {
    if (e instanceof GrxParseError) {
      console.error(`Parse error: ${e.message}`);
    } else {
      console.error(`Error: ${(e as Error).message}`);
    }
    process.exit(1);
  }
}

/**
 * Parse a .grx file and recursively resolve its imports.
 */
function parseWithImports(absPath: string, visited: Set<string> = new Set()): GrxFile {
  if (visited.has(absPath)) {
    throw new GrxParseError(`Circular import detected: ${absPath}`, 0, 0);
  }
  visited.add(absPath);

  const source = readFileSync(absPath, 'utf-8');
  const grxFile = Parser.parseFile(source);

  // Resolve imports
  const baseDir = dirname(absPath);
  const allDefinitions: NodeDefinitionBlock[] = [];

  for (const imp of grxFile.imports) {
    const importPath = resolve(baseDir, imp.src);
    const imported = parseWithImports(importPath, visited);

    // Merge definitions from imported file
    allDefinitions.push(...imported.definitions);
  }

  // Prepend imported definitions before local ones
  grxFile.definitions = [...allDefinitions, ...grxFile.definitions];

  return grxFile;
}

function countNodes(file: GrxFile): number {
  if (!file.graph) return 0;
  let count = 0;
  function walk(children: any[]): void {
    for (const child of children) {
      if (child.type === 'NodeDecl') {
        count++;
        if (child.children) walk(child.children);
      }
    }
  }
  walk(file.graph.children);
  return count;
}

function printHelp(): void {
  console.log(`
grx — GraphReact CLI

Usage:
  grx run <file.grx> [--async]    Run a .grx file directly
  grx build <file.grx> -o <out>   Transpile .grx to TypeScript
  grx check <file.grx>            Parse and validate without running

Examples:
  grx run my-system.grx
  grx build sensors.grx -o sensors.ts
  grx check network.grx
`.trim());
}

main();
