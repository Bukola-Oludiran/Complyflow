/**
 * Recursive descent parser for .grx files.
 * Consumes tokens from the lexer and builds an AST.
 */

import type { Token } from './lexer.js';
import { TokenType, Lexer } from './lexer.js';
import type { GrxNode, GraphDecl, NodeDecl, EdgeDecl, GrxFile, ImportDirective, NodeDefinitionBlock } from './ast.js';
import { GrxParseError } from './errors.js';

export class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  static parse(input: string): GraphDecl {
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parseGraph();
  }

  /**
   * Parse a complete .grx file (Phase 7).
   * Returns imports, graph declaration, and inline node definitions.
   */
  static parseFile(input: string): GrxFile {
    const lexer = new Lexer(input);
    const tokens = lexer.tokenizeFile();
    const parser = new Parser(tokens);
    return parser.parseGrxFile();
  }

  private parseGrxFile(): GrxFile {
    const imports: ImportDirective[] = [];
    const definitions: NodeDefinitionBlock[] = [];
    let graph: GraphDecl | null = null;

    while (this.pos < this.tokens.length) {
      this.skipComments();
      const token = this.peek();

      if (token.type === TokenType.EOF) break;

      if (token.type === TokenType.OpenTag) {
        if (token.value === 'import') {
          imports.push(this.parseImportDirective());
        } else if (token.value === 'Graph') {
          if (graph) {
            throw new GrxParseError('Only one <Graph> block allowed per file', token.line, token.column);
          }
          graph = this.parseGraph();
        } else {
          // Check if next relevant token is RawContent (definition block)
          // or if it has an id attr (node in graph — shouldn't be at top level)
          definitions.push(this.parseDefinitionBlock());
        }
      } else if (token.type === TokenType.CloseTag) {
        // Stray close tag from a definition block — skip
        this.advance();
      } else {
        // Skip unexpected tokens at top level
        this.advance();
      }
    }

    return { imports, graph, definitions };
  }

  private parseImportDirective(): ImportDirective {
    const openTag = this.expect(TokenType.OpenTag, 'import');
    const attrs = this.parseAttributes();

    const src = attrs.src as string;
    if (!src) {
      throw new GrxParseError('<import> requires a src attribute', openTag.line, openTag.column);
    }

    // Must be self-closing
    const next = this.peek();
    if (next.type === TokenType.SelfClose) {
      this.advance();
    } else {
      throw new GrxParseError('<import> must be self-closing (/>) ', next.line, next.column);
    }

    return {
      type: 'ImportDirective',
      src,
      loc: { line: openTag.line, column: openTag.column },
    };
  }

  private parseDefinitionBlock(): NodeDefinitionBlock {
    const openTag = this.expect(TokenType.OpenTag, 'definition');
    const component = openTag.value;

    // Expect > after tag name (no attributes on definition blocks)
    this.expect(TokenType.TagEnd, component);

    // Next token should be RawContent
    const contentToken = this.peek();
    let code = '';
    if (contentToken.type === TokenType.RawContent) {
      code = this.advance().value;
    }

    // Close tag was already consumed by the lexer's readRawContent,
    // but it pushed a CloseTag token — skip it if present
    if (this.peek().type === TokenType.CloseTag && this.peek().value === component) {
      this.advance();
    }

    return {
      type: 'NodeDefinitionBlock',
      component,
      code,
      loc: { line: openTag.line, column: openTag.column },
    };
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType, context?: string): Token {
    const token = this.peek();
    if (token.type !== type) {
      const ctx = context ? ` (in ${context})` : '';
      throw new GrxParseError(
        `Expected ${TokenType[type]} but got ${TokenType[token.type]} '${token.value}'${ctx}`,
        token.line,
        token.column
      );
    }
    return this.advance();
  }

  /**
   * Parse the root <Graph> element.
   */
  parseGraph(): GraphDecl {
    // Skip comments
    this.skipComments();

    const openTag = this.expect(TokenType.OpenTag, 'root');
    if (openTag.value !== 'Graph') {
      throw new GrxParseError(
        `Root element must be <Graph>, got <${openTag.value}>`,
        openTag.line,
        openTag.column
      );
    }

    const attrs = this.parseAttributes();
    const id = attrs.id as string;
    if (!id) {
      throw new GrxParseError('Graph element requires an id attribute', openTag.line, openTag.column);
    }

    // Expect > (not self-closing)
    this.expect(TokenType.TagEnd, 'Graph');

    // Parse children
    const children = this.parseChildren('Graph');

    // Expect </Graph>
    const closeTag = this.expect(TokenType.CloseTag, 'Graph');
    if (closeTag.value !== 'Graph') {
      throw new GrxParseError(
        `Expected </Graph>, got </${closeTag.value}>`,
        closeTag.line,
        closeTag.column
      );
    }

    return {
      type: 'Graph',
      id,
      children,
      loc: { line: openTag.line, column: openTag.column },
    };
  }

  /**
   * Parse children until a closing tag is found.
   */
  private parseChildren(parentTag: string): GrxNode[] {
    const children: GrxNode[] = [];

    while (this.pos < this.tokens.length) {
      this.skipComments();
      const token = this.peek();

      if (token.type === TokenType.EOF) break;
      if (token.type === TokenType.CloseTag) break; // parent's close tag

      if (token.type === TokenType.OpenTag) {
        if (token.value === 'edge') {
          children.push(this.parseEdge());
        } else {
          children.push(this.parseNode());
        }
      } else {
        throw new GrxParseError(
          `Unexpected token ${TokenType[token.type]} '${token.value}' inside <${parentTag}>`,
          token.line,
          token.column
        );
      }
    }

    return children;
  }

  /**
   * Parse a node element: <Component id="..." ... > ... </Component>
   * or self-closing: <Component id="..." ... />
   */
  private parseNode(): NodeDecl {
    const openTag = this.expect(TokenType.OpenTag, 'node');
    const component = openTag.value;
    const allAttrs = this.parseAttributes();

    const id = allAttrs.id as string;
    if (!id) {
      throw new GrxParseError(
        `Node <${component}> requires an id attribute`,
        openTag.line,
        openTag.column
      );
    }

    // Remove 'id' from attrs (it's a separate field)
    const { id: _, ...attrs } = allAttrs;

    const next = this.peek();

    if (next.type === TokenType.SelfClose) {
      this.advance(); // consume />
      return {
        type: 'NodeDecl',
        component,
        id,
        attrs,
        children: [],
        selfClosing: true,
        loc: { line: openTag.line, column: openTag.column },
      };
    }

    // Expect >
    this.expect(TokenType.TagEnd, component);

    // Parse children
    const children = this.parseChildren(component);

    // Expect </Component>
    const closeTag = this.expect(TokenType.CloseTag, component);
    if (closeTag.value !== component) {
      throw new GrxParseError(
        `Expected </${component}>, got </${closeTag.value}>`,
        closeTag.line,
        closeTag.column
      );
    }

    return {
      type: 'NodeDecl',
      component,
      id,
      attrs,
      children,
      selfClosing: false,
      loc: { line: openTag.line, column: openTag.column },
    };
  }

  /**
   * Parse an edge element: <edge source="..." target="..." ... />
   */
  private parseEdge(): EdgeDecl {
    const openTag = this.expect(TokenType.OpenTag, 'edge');
    const allAttrs = this.parseAttributes();

    const source = allAttrs.source as string;
    const target = allAttrs.target as string;

    if (!source || !target) {
      throw new GrxParseError(
        '<edge> requires source and target attributes',
        openTag.line,
        openTag.column
      );
    }

    // Remove source/target from attrs
    const { source: _, target: __, ...attrs } = allAttrs;

    // Edge must be self-closing
    const next = this.peek();
    if (next.type === TokenType.SelfClose) {
      this.advance();
    } else if (next.type === TokenType.TagEnd) {
      // Also allow <edge ...></edge>
      this.advance();
      const close = this.expect(TokenType.CloseTag, 'edge');
      if (close.value !== 'edge') {
        throw new GrxParseError(`Expected </edge>, got </${close.value}>`, close.line, close.column);
      }
    } else {
      throw new GrxParseError(
        'Expected /> or > after <edge> attributes',
        next.line,
        next.column
      );
    }

    return {
      type: 'EdgeDecl',
      source,
      target,
      attrs,
      loc: { line: openTag.line, column: openTag.column },
    };
  }

  /**
   * Parse attributes until we hit > or />.
   */
  private parseAttributes(): Record<string, unknown> {
    const attrs: Record<string, unknown> = {};

    while (this.pos < this.tokens.length) {
      const token = this.peek();

      if (token.type === TokenType.TagEnd || token.type === TokenType.SelfClose) {
        break;
      }

      if (token.type !== TokenType.AttrName) {
        break;
      }

      const name = this.advance().value;

      // Check for value
      if (this.peek().type === TokenType.AttrEquals) {
        this.advance(); // consume =

        const valueToken = this.peek();
        if (valueToken.type === TokenType.StringLiteral) {
          attrs[name] = this.advance().value;
        } else if (valueToken.type === TokenType.ExprLiteral) {
          attrs[name] = this.parseExprValue(this.advance().value);
        } else {
          throw new GrxParseError(
            `Expected string or expression value for attribute '${name}'`,
            valueToken.line,
            valueToken.column
          );
        }
      } else {
        // Boolean attribute
        attrs[name] = true;
      }
    }

    return attrs;
  }

  /**
   * Parse an expression value from {..} syntax.
   * Supports JSON literals: numbers, booleans, strings, arrays, objects, null.
   */
  private parseExprValue(expr: string): unknown {
    // Try JSON parse first
    try {
      return JSON.parse(expr);
    } catch {
      // If not valid JSON, return as string
      return expr;
    }
  }

  private skipComments(): void {
    while (this.pos < this.tokens.length && this.peek().type === TokenType.Comment) {
      this.advance();
    }
  }
}
