/**
 * Lexer (tokenizer) for .grx files.
 *
 * Handles:
 *  - <Tag>, </Tag>, <Tag />
 *  - key="string" and key={expression} attributes
 *  - <!-- comments -->
 *  - Whitespace and text between tags
 */

import { GrxParseError } from './errors.js';

export enum TokenType {
  OpenTag,       // <TagName
  CloseTag,      // </TagName>
  SelfClose,     // />
  TagEnd,        // >
  AttrName,      // key
  AttrEquals,    // =
  StringLiteral, // "value"
  ExprLiteral,   // {expression}
  Comment,       // <!-- ... -->
  RawContent,    // raw code inside <ComponentName>...</ComponentName> definition blocks
  EOF,
}

/** Tags that are part of the graph markup (not definition blocks) */
const RESERVED_TAGS = new Set(['Graph', 'edge', 'import']);

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export class Lexer {
  private input: string;
  private pos: number;
  private line: number;
  private column: number;
  private tokens: Token[];

  constructor(input: string) {
    this.input = input;
    this.pos = 0;
    this.line = 1;
    this.column = 1;
    this.tokens = [];
  }

  tokenize(): Token[] {
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      if (this.match('<!--')) {
        this.readComment();
      } else if (this.match('</')) {
        this.readCloseTag();
      } else if (this.match('<')) {
        this.readOpenTag();
      } else {
        // Skip any text content between tags
        this.skipUntil('<');
      }
    }

    this.tokens.push({ type: TokenType.EOF, value: '', line: this.line, column: this.column });
    return this.tokens;
  }

  /**
   * Tokenize a full .grx file (Phase 7).
   * At the top level, non-reserved tags (not Graph/edge/import) are
   * treated as definition blocks — their content is captured as RawContent.
   */
  tokenizeFile(): Token[] {
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      if (this.pos >= this.input.length) break;

      if (this.match('<!--')) {
        this.readComment();
      } else if (this.match('</')) {
        this.readCloseTag();
      } else if (this.match('<')) {
        // Peek at the tag name to decide if it's a definition block
        const savedPos = this.pos;
        const savedLine = this.line;
        const savedCol = this.column;
        const savedTokenLen = this.tokens.length;

        this.readOpenTag();

        // Check the last OpenTag token we just produced
        const openTagToken = this.tokens[savedTokenLen];
        if (openTagToken && openTagToken.type === TokenType.OpenTag) {
          const tagName = openTagToken.value;
          const lastToken = this.tokens[this.tokens.length - 1];

          // If it's a non-reserved tag that ended with > (not />), it's a definition block
          if (!RESERVED_TAGS.has(tagName) && lastToken.type === TokenType.TagEnd) {
            // Check if this looks like a top-level definition (no id attribute = definition)
            const hasIdAttr = this.tokens.slice(savedTokenLen).some(
              (t, i, arr) => t.type === TokenType.AttrName && t.value === 'id'
            );

            if (!hasIdAttr) {
              // This is a definition block — read raw content until </TagName>
              this.readRawContent(tagName);
              continue;
            }
          }
        }
      } else {
        this.skipUntil('<');
      }
    }

    this.tokens.push({ type: TokenType.EOF, value: '', line: this.line, column: this.column });
    return this.tokens;
  }

  /**
   * Read raw content (code) until the closing tag </tagName>.
   */
  private readRawContent(tagName: string): void {
    const startLine = this.line;
    const startCol = this.column;
    const closeTag = `</${tagName}>`;
    let content = '';

    while (this.pos < this.input.length) {
      if (this.match(closeTag)) {
        // Consume the closing tag
        for (let i = 0; i < closeTag.length; i++) this.advance();
        this.tokens.push({
          type: TokenType.RawContent,
          value: content.trim(),
          line: startLine,
          column: startCol,
        });
        // Also push the close tag token
        this.tokens.push({
          type: TokenType.CloseTag,
          value: tagName,
          line: this.line,
          column: this.column,
        });
        return;
      }
      content += this.advance();
    }

    throw new GrxParseError(`Unterminated definition block <${tagName}>`, startLine, startCol);
  }

  private match(str: string): boolean {
    return this.input.startsWith(str, this.pos);
  }

  private peek(): string {
    return this.input[this.pos] ?? '';
  }

  private advance(): string {
    const ch = this.input[this.pos++];
    if (ch === '\n') {
      this.line++;
      this.column = 1;
    } else {
      this.column++;
    }
    return ch;
  }

  private skipWhitespace(): void {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.advance();
    }
  }

  private skipUntil(ch: string): void {
    while (this.pos < this.input.length && this.input[this.pos] !== ch) {
      this.advance();
    }
  }

  private readComment(): void {
    const startLine = this.line;
    const startCol = this.column;
    // Skip <!--
    for (let i = 0; i < 4; i++) this.advance();

    let value = '';
    while (this.pos < this.input.length) {
      if (this.match('-->')) {
        for (let i = 0; i < 3; i++) this.advance();
        this.tokens.push({ type: TokenType.Comment, value: value.trim(), line: startLine, column: startCol });
        return;
      }
      value += this.advance();
    }
    throw new GrxParseError('Unterminated comment', startLine, startCol);
  }

  private readCloseTag(): void {
    const startLine = this.line;
    const startCol = this.column;
    // Skip </
    this.advance(); this.advance();

    this.skipWhitespace();
    const name = this.readIdentifier();
    this.skipWhitespace();

    if (this.peek() !== '>') {
      throw new GrxParseError(`Expected '>' after closing tag name '${name}'`, this.line, this.column);
    }
    this.advance(); // >

    this.tokens.push({ type: TokenType.CloseTag, value: name, line: startLine, column: startCol });
  }

  private readOpenTag(): void {
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // <

    this.skipWhitespace();
    const name = this.readIdentifier();
    this.tokens.push({ type: TokenType.OpenTag, value: name, line: startLine, column: startCol });

    // Read attributes until > or />
    while (this.pos < this.input.length) {
      this.skipWhitespace();

      if (this.match('/>')) {
        this.advance(); this.advance();
        this.tokens.push({ type: TokenType.SelfClose, value: '/>', line: this.line, column: this.column });
        return;
      }

      if (this.peek() === '>') {
        this.advance();
        this.tokens.push({ type: TokenType.TagEnd, value: '>', line: this.line, column: this.column });
        return;
      }

      // Read attribute
      this.readAttribute();
    }

    throw new GrxParseError('Unterminated tag', startLine, startCol);
  }

  private readAttribute(): void {
    const nameLine = this.line;
    const nameCol = this.column;
    const name = this.readIdentifier();
    this.tokens.push({ type: TokenType.AttrName, value: name, line: nameLine, column: nameCol });

    this.skipWhitespace();
    if (this.peek() !== '=') {
      // Boolean attribute (no value)
      return;
    }
    this.advance(); // =
    this.tokens.push({ type: TokenType.AttrEquals, value: '=', line: this.line, column: this.column });

    this.skipWhitespace();
    if (this.peek() === '"') {
      this.readStringLiteral();
    } else if (this.peek() === '{') {
      this.readExprLiteral();
    } else {
      throw new GrxParseError(
        `Expected '"' or '{' after '=' in attribute '${name}'`,
        this.line, this.column
      );
    }
  }

  private readIdentifier(): string {
    let name = '';
    while (this.pos < this.input.length && /[a-zA-Z0-9_\-]/.test(this.input[this.pos])) {
      name += this.advance();
    }
    if (!name) {
      throw new GrxParseError('Expected identifier', this.line, this.column);
    }
    return name;
  }

  private readStringLiteral(): void {
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // opening "

    let value = '';
    while (this.pos < this.input.length && this.input[this.pos] !== '"') {
      if (this.input[this.pos] === '\\') {
        this.advance(); // skip backslash
        value += this.advance(); // add escaped char
      } else {
        value += this.advance();
      }
    }

    if (this.pos >= this.input.length) {
      throw new GrxParseError('Unterminated string literal', startLine, startCol);
    }
    this.advance(); // closing "

    this.tokens.push({ type: TokenType.StringLiteral, value, line: startLine, column: startCol });
  }

  private readExprLiteral(): void {
    const startLine = this.line;
    const startCol = this.column;
    this.advance(); // opening {

    let value = '';
    let depth = 1;

    while (this.pos < this.input.length && depth > 0) {
      const ch = this.input[this.pos];
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth > 0) {
        value += this.advance();
      } else {
        this.advance(); // closing }
      }
    }

    if (depth > 0) {
      throw new GrxParseError('Unterminated expression literal', startLine, startCol);
    }

    this.tokens.push({ type: TokenType.ExprLiteral, value: value.trim(), line: startLine, column: startCol });
  }
}
