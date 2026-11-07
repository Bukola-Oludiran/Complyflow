import { describe, it, expect } from 'vitest';
import { Parser } from '../../core/parser/parser.js';

describe('parseFile — single-file .grx format', () => {
  it('parses a file with graph and definitions', () => {
    const file = Parser.parseFile(`
      <Graph id="test">
        <Sensor id="s1">
          <Logger id="l1" />
        </Sensor>
      </Graph>

      <Sensor>
        const emit = useEmit();
        return { accepts: [], emits: ['data'] };
      </Sensor>

      <Logger>
        return { accepts: ['data'], emits: [] };
      </Logger>
    `);

    expect(file.graph).not.toBeNull();
    expect(file.graph!.id).toBe('test');
    expect(file.definitions.length).toBe(2);
    expect(file.definitions[0].component).toBe('Sensor');
    expect(file.definitions[0].code).toContain('useEmit');
    expect(file.definitions[1].component).toBe('Logger');
    expect(file.imports.length).toBe(0);
  });

  it('parses a definitions-only file (no graph)', () => {
    const file = Parser.parseFile(`
      <TempSensor>
        const emit = useEmit();
        return { accepts: ['poll'], emits: ['reading'] };
      </TempSensor>

      <HumiditySensor>
        return { accepts: ['poll'], emits: ['reading'] };
      </HumiditySensor>
    `);

    expect(file.graph).toBeNull();
    expect(file.definitions.length).toBe(2);
    expect(file.definitions[0].component).toBe('TempSensor');
    expect(file.definitions[1].component).toBe('HumiditySensor');
  });

  it('parses import directives', () => {
    const file = Parser.parseFile(`
      <import src="./sensors.grx" />
      <import src="./cloud.grx" />

      <Graph id="main">
        <Sensor id="s1" />
      </Graph>
    `);

    expect(file.imports.length).toBe(2);
    expect(file.imports[0].src).toBe('./sensors.grx');
    expect(file.imports[1].src).toBe('./cloud.grx');
    expect(file.graph).not.toBeNull();
  });

  it('preserves code block content accurately', () => {
    const file = Parser.parseFile(`
      <Graph id="test">
        <Node id="n" />
      </Graph>

      <Node>
        const [count, setCount] = useState(0);
        const emit = useEmit();

        useMessage('increment', (msg) => {
          setCount(prev => prev + 1);
        });

        useEffect(() => {
          emit('count-updated', { value: count });
        }, [count]);

        return { accepts: ['increment'], emits: ['count-updated'] };
      </Node>
    `);

    const code = file.definitions[0].code;
    expect(code).toContain('useState(0)');
    expect(code).toContain('useMessage');
    expect(code).toContain('useEffect');
    expect(code).toContain('prev => prev + 1');
    expect(code).toContain("emits: ['count-updated']");
  });

  it('handles comments in file', () => {
    const file = Parser.parseFile(`
      <!-- This is a sensor library -->
      <import src="./base.grx" />

      <!-- Main graph -->
      <Graph id="test">
        <!-- A sensor node -->
        <Sensor id="s1" />
      </Graph>

      <!-- Sensor definition -->
      <Sensor>
        return { accepts: [], emits: [] };
      </Sensor>
    `);

    expect(file.imports.length).toBe(1);
    expect(file.graph).not.toBeNull();
    expect(file.definitions.length).toBe(1);
  });

  it('throws on multiple Graph blocks', () => {
    expect(() => Parser.parseFile(`
      <Graph id="a"><Node id="n" /></Graph>
      <Graph id="b"><Node id="m" /></Graph>
    `)).toThrow('Only one <Graph> block allowed');
  });
});
