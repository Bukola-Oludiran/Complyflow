/**
 * AST node types for .grx files.
 */

export interface SourceLocation {
  line: number;
  column: number;
}

export type GrxNode = GraphDecl | NodeDecl | EdgeDecl | ImportDirective | NodeDefinitionBlock;

export interface GraphDecl {
  type: 'Graph';
  id: string;
  children: GrxNode[];
  loc: SourceLocation;
}

export interface NodeDecl {
  type: 'NodeDecl';
  /** Component tag name (e.g., 'Counter', 'Logger') */
  component: string;
  /** Node ID attribute */
  id: string;
  /** All other attributes */
  attrs: Record<string, unknown>;
  /** Nested children (other NodeDecls) */
  children: GrxNode[];
  /** Whether this is a self-closing tag */
  selfClosing: boolean;
  loc: SourceLocation;
}

export interface EdgeDecl {
  type: 'EdgeDecl';
  source: string;
  target: string;
  attrs: Record<string, unknown>;
  loc: SourceLocation;
}

// --- Phase 7: Single-file format additions ---

export interface ImportDirective {
  type: 'ImportDirective';
  src: string;
  loc: SourceLocation;
}

export interface NodeDefinitionBlock {
  type: 'NodeDefinitionBlock';
  /** Tag name = component name */
  component: string;
  /** Raw function body code (TypeScript/JavaScript) */
  code: string;
  loc: SourceLocation;
}

/** Top-level representation of a complete .grx file */
export interface GrxFile {
  imports: ImportDirective[];
  graph: GraphDecl | null;
  definitions: NodeDefinitionBlock[];
}
