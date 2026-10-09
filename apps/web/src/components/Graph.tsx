import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import { graphSchema } from '@kasirnusa/contracts';
import type { z } from 'zod';

export function Graph({
  graph,
  onEvidence,
}: {
  graph: z.infer<typeof graphSchema>;
  onEvidence: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const cy = cytoscape({
      container: container.current,
      elements: [
        ...graph.nodes.map((n) => ({ data: { id: n.id, label: n.label } })),
        ...graph.edges.map((e) => ({
          data: {
            id: e.id,
            source: e.from,
            target: e.to,
            label: e.relation.replaceAll('_', ' '),
            evidence: e.evidence_ids,
          },
        })),
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 32 },
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#0051C3',
            color: '#111827',
            label: 'data(label)',
            'font-family': 'Inter, sans-serif',
            'font-size': 11,
            'font-weight': 600,
            'text-wrap': 'wrap',
            'text-max-width': '120px',
            'text-valign': 'bottom',
            'text-margin-y': 6,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#94A3B8',
            'target-arrow-color': '#64748B',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-family': 'ui-monospace, monospace',
            'font-size': 9,
            'text-background-color': '#FFFFFF',
            'text-background-opacity': 0.95,
            'text-background-padding': '2px',
          },
        },
      ],
      minZoom: 0.15,
      maxZoom: 2,
    });

    cy.on('tap', 'edge', (event) => {
      const ids = event.target.data('evidence') as string[];
      if (ids[0]) onEvidence(ids[0]);
    });

    const observer = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, 32);
    });
    observer.observe(container.current);

    return () => {
      observer.disconnect();
      cy.destroy();
    };
  }, [graph, onEvidence]);

  const name = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <section className="border border-brand-border rounded-lg bg-white p-5 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-brand-text">Relationship path</h2>
          <p className="text-xs text-brand-subtle">
            Bounded to {graph.limits.max_hops} hops / {graph.limits.max_nodes} nodes.{' '}
            {graph.limits.truncated ? 'Path truncated.' : 'Complete within these limits.'} Select an edge to inspect evidence.
          </p>
        </div>
        <span className="text-[11px] font-mono bg-gray-50 border border-brand-border px-2 py-0.5 rounded text-brand-muted">
          {graph.nodes.length} nodes · {graph.edges.length} edges
        </span>
      </div>

      <div
        ref={container}
        className="graph w-full rounded-md border border-brand-border bg-slate-50/50"
        role="img"
        aria-label="Evidence relationship graph; equivalent relationships listed below"
      />

      <details className="text-xs text-brand-muted pt-1">
        <summary className="cursor-pointer hover:text-brand-text font-medium select-none">
          Accessible relationship list ({graph.edges.length})
        </summary>
        <ul className="mt-2 divide-y divide-gray-100 max-h-48 overflow-y-auto font-mono text-[11px] pl-2">
          {graph.edges.map((e) => (
            <li key={e.id} className="py-1 flex items-center justify-between">
              <span>
                {name(e.from)} <span className="text-brand-subtle">→ {e.relation.replaceAll('_', ' ')} →</span>{' '}
                {name(e.to)}
              </span>
              <span className="space-x-1 shrink-0">
                {e.evidence_ids.map((id) => (
                  <button
                    key={id}
                    onClick={() => onEvidence(id)}
                    className="h-6 px-2 text-[10px] border border-brand-border rounded bg-white hover:bg-gray-50 text-brand-blue"
                  >
                    View source {graph.evidence.find((v) => v.source_id === id)?.source_external_id ?? 'record'}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
