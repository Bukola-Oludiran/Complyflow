import { useEffect, useMemo, useRef } from 'react';
import cytoscape, { type Core, type ElementDefinition, type StylesheetCSS } from 'cytoscape';
import coseBilkent from 'cytoscape-cose-bilkent';
import type { CytoscapeElements } from '../types/api';

cytoscape.use(coseBilkent);

interface TopologyGraphProps {
    elements: CytoscapeElements;
}

/**
 * Color scheme: services blue, resources green, edges fade-out gray.
 * Node IDs from ComplyFlow are prefixed (`svc:...`, `res:...`) so we color
 * by prefix.
 */
const STYLE: StylesheetCSS[] = [
    {
        selector: 'node',
        css: {
            'background-color': '#1f2937',
            'border-color': '#3b82f6',
            'border-width': 2,
            label: 'data(label)',
            color: '#e5e5e5',
            'font-size': 11,
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-outline-color': '#0a0a0a',
            'text-outline-width': 2,
            width: 36,
            height: 36,
        },
    },
    {
        selector: 'node[id ^= "svc:"]',
        css: {
            'background-color': '#1e3a8a',
            'border-color': '#60a5fa',
            shape: 'round-rectangle',
            width: 44,
            height: 28,
        },
    },
    {
        selector: 'node[id ^= "res:"]',
        css: {
            'background-color': '#064e3b',
            'border-color': '#34d399',
            shape: 'ellipse',
        },
    },
    {
        selector: 'edge',
        css: {
            width: 1.5,
            'line-color': '#404040',
            'target-arrow-color': '#525252',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            opacity: 0.7,
        },
    },
    {
        selector: 'edge:selected',
        css: {
            'line-color': '#fbbf24',
            'target-arrow-color': '#fbbf24',
            opacity: 1,
        },
    },
    {
        selector: 'node:selected',
        css: {
            'border-color': '#fbbf24',
            'border-width': 3,
        },
    },
];

/**
 * Wraps Cytoscape.js in a React component that survives re-renders while
 * incrementally updating the graph in place (so the layout doesn't reset on
 * every poll tick).
 */
export function TopologyGraph({ elements }: TopologyGraphProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const cyRef = useRef<Core | null>(null);

    // Stable element-definition projection — labels default to the last
    // segment of the id when not set by the backend.
    const elementDefs: ElementDefinition[] = useMemo(() => {
        const defs: ElementDefinition[] = [];
        for (const n of elements.nodes) {
            const id = n.data.id;
            const label = (n.data.label as string | undefined) ?? id.split(':').pop() ?? id;
            defs.push({ data: { ...n.data, label } });
        }
        for (const e of elements.edges) {
            // Cytoscape requires unique edge ids; compose from source/target if missing.
            const id = (e.data.id as string | undefined) ?? `${e.data.source}->${e.data.target}`;
            defs.push({ data: { ...e.data, id } });
        }
        return defs;
    }, [elements]);

    useEffect(() => {
        if (!containerRef.current) return;
        if (cyRef.current) return;

        cyRef.current = cytoscape({
            container: containerRef.current,
            elements: elementDefs,
            style: STYLE,
            layout: { name: 'cose-bilkent', animate: false, idealEdgeLength: 80 } as never,
            wheelSensitivity: 0.2,
        });

        return () => {
            cyRef.current?.destroy();
            cyRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Incremental updates: diff against current graph rather than rebuild.
    useEffect(() => {
        const cy = cyRef.current;
        if (!cy) return;

        const presentIds = new Set(elementDefs.map(d => String(d.data.id)));
        const currentIds = new Set(cy.elements().map(el => el.id()));

        const added = elementDefs.filter(d => !currentIds.has(String(d.data.id)));
        const removed = cy.elements().filter(el => !presentIds.has(el.id()));

        if (added.length === 0 && removed.length === 0) return;

        cy.batch(() => {
            removed.remove();
            cy.add(added);
        });

        if (added.length > 0) {
            cy.layout({ name: 'cose-bilkent', animate: 'end', animationDuration: 400, idealEdgeLength: 80 } as never).run();
        }
    }, [elementDefs]);

    return (
        <div className="relative h-full w-full bg-neutral-950">
            <div ref={containerRef} className="h-full w-full" />
            {elementDefs.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-neutral-500">
                    No topology data yet — send an event to populate this view.
                </div>
            )}
        </div>
    );
}
