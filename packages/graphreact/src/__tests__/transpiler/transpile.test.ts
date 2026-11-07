import { describe, it, expect } from 'vitest';
import { Parser } from '../../core/parser/parser.js';
import { transpile } from '../../core/transpiler/transpile.js';

describe('Transpiler', () => {
  it('generates valid TypeScript from a single-file .grx', () => {
    const file = Parser.parseFile(`
      <Graph id="test">
        <Sender id="s1">
          <Receiver id="r1" />
        </Sender>
      </Graph>

      <Sender>
        const emit = useEmit();
        useEffect(() => {
          emit('ping', { value: 1 });
        }, []);
        return { accepts: [], emits: ['ping'] };
      </Sender>

      <Receiver>
        useMessage('ping', (msg) => {
          console.log(msg.payload);
        });
        return { accepts: ['ping'], emits: [] };
      </Receiver>
    `);

    const output = transpile(file);

    // Should have import statement
    expect(output).toContain("from '@graphreact/core'");

    // Should have defineNode calls
    expect(output).toContain("const Sender = defineNode('Sender', (ctx) => {");
    expect(output).toContain("const Receiver = defineNode('Receiver', (ctx) => {");

    // Should have the user's code inside
    expect(output).toContain('useEmit()');
    expect(output).toContain("emit('ping'");
    expect(output).toContain("useMessage('ping'");

    // Should have loadGraph call
    expect(output).toContain('loadGraph(__grx_source');
    expect(output).toContain('Sender');
    expect(output).toContain('Receiver');
  });

  it('detects used hooks and imports only those', () => {
    const file = Parser.parseFile(`
      <Graph id="test"><Node id="n" /></Graph>

      <Node>
        const [x, setX] = useState(0);
        const m = useMemo(() => x * 2, [x]);
        return { accepts: [], emits: [] };
      </Node>
    `);

    const output = transpile(file);

    expect(output).toContain('useState');
    expect(output).toContain('useMemo');
    expect(output).not.toContain('useMessage');
    expect(output).not.toContain('useEmit');
  });

  it('reconstructs graph markup in output', () => {
    const file = Parser.parseFile(`
      <Graph id="my-app">
        <NodeA id="a" label="hello">
          <NodeB id="b" />
        </NodeA>
        <edge source="a" target="b" channel="data" />
      </Graph>

      <NodeA>
        return { accepts: [], emits: [] };
      </NodeA>

      <NodeB>
        return { accepts: [], emits: [] };
      </NodeB>
    `);

    const output = transpile(file);

    // The reconstructed graph markup is in a JSON-escaped string
    expect(output).toContain('my-app');
    expect(output).toContain('NodeA');
    expect(output).toContain('NodeB');
    expect(output).toContain('__grx_source');
  });

  it('handles definitions-only file (no graph)', () => {
    const file = Parser.parseFile(`
      <Helper>
        return { accepts: ['cmd'], emits: ['result'] };
      </Helper>
    `);

    const output = transpile(file);

    expect(output).toContain("const Helper = defineNode('Helper'");
    // No loadGraph call since there's no graph
    expect(output).not.toContain('loadGraph');
  });

  it('handles props destructuring in code', () => {
    const file = Parser.parseFile(`
      <Graph id="test">
        <Sensor id="s1" role="temperature" zone="A" interval={30} />
      </Graph>

      <Sensor>
        const { role, zone, interval } = ctx.props;
        const [reading, setReading] = useState(0);
        return { accepts: ['poll'], emits: ['sensor-data'] };
      </Sensor>
    `);

    const output = transpile(file);
    expect(output).toContain('ctx.props');
    expect(output).toContain('useState(0)');
  });
});
