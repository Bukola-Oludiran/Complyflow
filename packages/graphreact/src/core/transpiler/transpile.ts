/**
 * Transpiler — converts a GrxFile AST into a TypeScript string.
 *
 * Same approach as Babel's JSX transform: source-to-source transformation.
 * No dynamic code construction at runtime.
 */

import type { GrxFile, GraphDecl, GrxNode } from '../parser/ast.js';

/**
 * Transpile a GrxFile AST into executable TypeScript source code.
 */
export function transpile(file: GrxFile): string {
  const lines: string[] = [];

  // 1. Generate imports
  const hookNames = detectUsedHooks(file);
  const coreImports = [
    'defineNode',
    ...(file.graph ? ['loadGraph'] : []),
    ...hookNames,
  ];
  lines.push(`import { ${coreImports.join(', ')} } from '@graphreact/core';`);
  lines.push('');

  // 2. Generate import statements for .grx imports
  //    These get resolved at the CLI level — the transpiler just notes them
  for (const imp of file.imports) {
    // Import directives are resolved by the CLI/compileFile before transpilation.
    // If we reach here, the imported definitions have already been merged.
    lines.push(`// import: ${imp.src} (resolved at compile time)`);
  }
  if (file.imports.length > 0) lines.push('');

  // 3. Generate node definitions
  const definitionNames: string[] = [];
  for (const def of file.definitions) {
    definitionNames.push(def.component);
    lines.push(`const ${def.component} = defineNode('${def.component}', (ctx) => {`);
    // Indent the user's code
    for (const codeLine of def.code.split('\n')) {
      lines.push(`  ${codeLine}`);
    }
    lines.push('});');
    lines.push('');
  }

  // 4. Generate the graph source and loadGraph call
  if (file.graph) {
    const grxSource = reconstructGraphMarkup(file.graph);
    lines.push(`const __grx_source = ${JSON.stringify(grxSource)};`);
    lines.push('');

    // Build components map — include all definitions
    const componentsObj = definitionNames.map(n => `  ${n}`).join(',\n');
    lines.push(`const { scheduler } = loadGraph(__grx_source, {`);
    lines.push(componentsObj);
    lines.push('});');
    lines.push('');

    // Export scheduler for external access
    lines.push('export { scheduler };');
  }

  return lines.join('\n');
}

/**
 * Detect which hooks are used in the definition code blocks.
 */
function detectUsedHooks(file: GrxFile): string[] {
  const allCode = file.definitions.map(d => d.code).join('\n');
  const hooks: string[] = [];
  const candidates = [
    'useState', 'useReducer', 'useEffect', 'useMemo', 'useCallback',
    'useMessage', 'useEmit', 'useNeighbors', 'useGraphQuery',
  ];
  for (const hook of candidates) {
    if (allCode.includes(hook)) {
      hooks.push(hook);
    }
  }
  return hooks;
}

/**
 * Reconstruct the <Graph> markup from the AST (for embedding in the output).
 * This produces a minified version of just the graph topology.
 */
function reconstructGraphMarkup(graph: GraphDecl): string {
  return `<Graph id="${graph.id}">${reconstructChildren(graph.children)}</Graph>`;
}

function reconstructChildren(children: GrxNode[]): string {
  return children.map(child => {
    switch (child.type) {
      case 'NodeDecl': {
        const attrs = Object.entries(child.attrs)
          .map(([k, v]) => {
            if (typeof v === 'string') return `${k}="${v}"`;
            return `${k}={${JSON.stringify(v)}}`;
          })
          .join(' ');
        const attrStr = attrs ? ` ${attrs}` : '';
        if (child.selfClosing || child.children.length === 0) {
          return `<${child.component} id="${child.id}"${attrStr} />`;
        }
        return `<${child.component} id="${child.id}"${attrStr}>${reconstructChildren(child.children)}</${child.component}>`;
      }
      case 'EdgeDecl': {
        const attrs = Object.entries(child.attrs)
          .map(([k, v]) => {
            if (typeof v === 'string') return `${k}="${v}"`;
            return `${k}={${JSON.stringify(v)}}`;
          })
          .join(' ');
        const attrStr = attrs ? ` ${attrs}` : '';
        return `<edge source="${child.source}" target="${child.target}"${attrStr} />`;
      }
      default:
        return '';
    }
  }).join('');
}
