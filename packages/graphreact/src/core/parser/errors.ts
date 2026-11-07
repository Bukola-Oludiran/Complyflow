/**
 * Parse errors with line/column info.
 */

export class GrxParseError extends Error {
  line: number;
  column: number;

  constructor(message: string, line: number, column: number) {
    super(`${message} (line ${line}, col ${column})`);
    this.name = 'GrxParseError';
    this.line = line;
    this.column = column;
  }
}
