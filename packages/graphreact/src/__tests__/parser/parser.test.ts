import { describe, it, expect, beforeEach } from 'vitest';
import { Parser } from '../../core/parser/parser.js';
import { Lexer, TokenType } from '../../core/parser/lexer.js';
import { GrxParseError } from '../../core/parser/errors.js';

describe('Lexer', () => {
  it('tokenizes a simple self-closing tag', () => {
    const tokens = new Lexer('<Counter id="c1" />').tokenize();
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.OpenTag,
      TokenType.AttrName, TokenType.AttrEquals, TokenType.StringLiteral,
      TokenType.SelfClose,
      TokenType.EOF,
    ]);
    expect(tokens[0].value).toBe('Counter');
    expect(tokens[1].value).toBe('id');
    expect(tokens[3].value).toBe('c1');
  });

  it('tokenizes expression attributes', () => {
    const tokens = new Lexer('<Node count={42} />').tokenize();
    const exprToken = tokens.find(t => t.type === TokenType.ExprLiteral);
    expect(exprToken?.value).toBe('42');
  });

  it('tokenizes nested tags', () => {
    const tokens = new Lexer('<Parent id="p"><Child id="c" /></Parent>').tokenize();
    const types = tokens.map(t => t.type);
    expect(types).toContain(TokenType.OpenTag);  // Parent
    expect(types).toContain(TokenType.TagEnd);    // >
    expect(types).toContain(TokenType.SelfClose); // />
    expect(types).toContain(TokenType.CloseTag);  // </Parent>
  });

  it('skips comments', () => {
    const tokens = new Lexer('<!-- hello --><Node id="n" />').tokenize();
    const comment = tokens.find(t => t.type === TokenType.Comment);
    expect(comment?.value).toBe('hello');
  });

  it('handles complex expression values', () => {
    const tokens = new Lexer('<N x={[1,2,3]} />').tokenize();
    const expr = tokens.find(t => t.type === TokenType.ExprLiteral);
    expect(expr?.value).toBe('[1,2,3]');
  });
});

describe('Parser', () => {
  it('parses a minimal graph', () => {
    const ast = Parser.parse(`
      <Graph id="test">
        <Counter id="c1" />
      </Graph>
    `);

    expect(ast.type).toBe('Graph');
    expect(ast.id).toBe('test');
    expect(ast.children.length).toBe(1);
    expect(ast.children[0].type).toBe('NodeDecl');
  });

  it('parses node with string and expression attributes', () => {
    const ast = Parser.parse(`
      <Graph id="g">
        <Counter id="c1" label="main" initialCount={0} enabled={true} />
      </Graph>
    `);

    const node = ast.children[0];
    expect(node.type).toBe('NodeDecl');
    if (node.type === 'NodeDecl') {
      expect(node.id).toBe('c1');
      expect(node.component).toBe('Counter');
      expect(node.attrs.label).toBe('main');
      expect(node.attrs.initialCount).toBe(0);
      expect(node.attrs.enabled).toBe(true);
    }
  });

  it('parses nested nodes (parent-child)', () => {
    const ast = Parser.parse(`
      <Graph id="g">
        <Aggregator id="agg">
          <Counter id="c1" />
          <Counter id="c2" />
        </Aggregator>
      </Graph>
    `);

    expect(ast.children.length).toBe(1);
    const agg = ast.children[0];
    expect(agg.type).toBe('NodeDecl');
    if (agg.type === 'NodeDecl') {
      expect(agg.children.length).toBe(2);
      expect(agg.children[0].type).toBe('NodeDecl');
    }
  });

  it('parses multi-parent via duplicate ID', () => {
    const ast = Parser.parse(`
      <Graph id="g">
        <Parent1 id="p1">
          <Child id="c1" initialCount={0} />
        </Parent1>
        <Parent2 id="p2">
          <Child id="c1" />
        </Parent2>
      </Graph>
    `);

    expect(ast.children.length).toBe(2);
    // Both parents have c1 as child
    const p1 = ast.children[0] as any;
    const p2 = ast.children[1] as any;
    expect(p1.children[0].id).toBe('c1');
    expect(p2.children[0].id).toBe('c1');
  });

  it('parses edge declarations', () => {
    const ast = Parser.parse(`
      <Graph id="g">
        <NodeA id="a" />
        <NodeB id="b" />
        <edge source="a" target="b" />
      </Graph>
    `);

    expect(ast.children.length).toBe(3);
    const edge = ast.children[2];
    expect(edge.type).toBe('EdgeDecl');
    if (edge.type === 'EdgeDecl') {
      expect(edge.source).toBe('a');
      expect(edge.target).toBe('b');
    }
  });

  it('parses edge with attributes', () => {
    const ast = Parser.parse(`
      <Graph id="g">
        <edge source="a" target="b" channel="data" ttl={5} />
      </Graph>
    `);

    const edge = ast.children[0];
    if (edge.type === 'EdgeDecl') {
      expect(edge.attrs.channel).toBe('data');
      expect(edge.attrs.ttl).toBe(5);
    }
  });

  it('parses comments (ignored in AST)', () => {
    const ast = Parser.parse(`
      <Graph id="g">
        <!-- This is a comment -->
        <Node id="n" />
        <!-- Another comment -->
      </Graph>
    `);

    expect(ast.children.length).toBe(1);
    expect(ast.children[0].type).toBe('NodeDecl');
  });

  it('throws on missing Graph root', () => {
    expect(() => Parser.parse('<Counter id="c" />')).toThrow('Root element must be <Graph>');
  });

  it('throws on missing id attribute', () => {
    expect(() => Parser.parse('<Graph id="g"><Counter /></Graph>')).toThrow('requires an id');
  });

  it('throws on edge without source', () => {
    expect(() => Parser.parse('<Graph id="g"><edge target="b" /></Graph>')).toThrow('requires source and target');
  });

  it('tracks line/column in errors', () => {
    try {
      Parser.parse(`
<Graph id="g">
  <Counter />
</Graph>`);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(GrxParseError);
      expect((e as GrxParseError).line).toBe(3);
    }
  });

  it('parses the full example from the design doc', () => {
    const ast = Parser.parse(`
      <Graph id="my-network">
        <Aggregator id="agg">
          <Counter id="counter-a" initialCount={0} />
          <Counter id="counter-b" initialCount={10} />
        </Aggregator>

        <Logger id="logger" level="debug">
          <Counter id="counter-a" />
          <Counter id="counter-b" />
        </Logger>

        <!-- Sibling edge -->
        <edge source="counter-a" target="counter-b" />
        <edge source="counter-a" target="counter-b" channel="control" ttl={3} />
      </Graph>
    `);

    expect(ast.id).toBe('my-network');
    // 2 top-level nodes + 2 edges
    expect(ast.children.length).toBe(4);
    expect(ast.children.filter(c => c.type === 'NodeDecl').length).toBe(2);
    expect(ast.children.filter(c => c.type === 'EdgeDecl').length).toBe(2);
  });
});
