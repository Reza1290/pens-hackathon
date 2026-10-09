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
        ...graph.nodes.map((n) => ({
          data: { id: n.id, label: n.label, kind: n.kind },
        })),
        ...graph.edges.map((e) => ({
          data: {
            id: e.id,
            source: e.from,
            target: e.to,
            label: e.relation.replaceAll('_', ' '),
            evidence: e.evidence_ids,
            relation: e.relation,
          },
        })),
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 32 },
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#475569',
            shape: 'ellipse',
            width: 28,
            height: 28,
            'border-width': 1.5,
            'border-color': '#CBD5E1',
            color: '#0F172A',
            label: 'data(label)',
            'font-family': 'Inter, system-ui, sans-serif',
            'font-size': 10,
            'font-weight': 600,
            'text-wrap': 'wrap',
            'text-max-width': '110px',
            'text-valign': 'bottom',
            'text-margin-y': 5,
          },
        },
        {
          selector: 'node[kind = "account"]',
          style: {
            'background-color': '#0F172A',
            shape: 'round-rectangle',
            width: 32,
            height: 32,
            'border-color': '#334155',
          },
        },
        {
          selector: 'node[kind = "signal"]',
          style: {
            'background-color': '#0D9488',
            shape: 'diamond',
            width: 30,
            height: 30,
          },
        },
        {
          selector: 'node[kind = "employee"]',
          style: {
            'background-color': '#2563EB',
            shape: 'ellipse',
            width: 26,
            height: 26,
          },
        },
        {
          selector: 'node[kind = "contact"]',
          style: {
            'background-color': '#64748B',
            shape: 'ellipse',
            width: 26,
            height: 26,
          },
        },
        {
          selector: 'node[kind = "contract"]',
          style: {
            'background-color': '#475569',
            shape: 'round-rectangle',
            width: 26,
            height: 26,
          },
        },
        {
          selector: 'node[kind = "decision"]',
          style: {
            'background-color': '#6B7280',
            shape: 'hexagon',
            width: 26,
            height: 26,
          },
        },
        {
          selector: 'node[kind = "action"]',
          style: {
            'background-color': '#EA580C',
            shape: 'round-rectangle',
            width: 34,
            height: 34,
            'border-width': 2,
            'border-color': '#9A3412',
            'font-weight': 700,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#CBD5E1',
            'target-arrow-color': '#94A3B8',
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
        {
          selector: 'edge[relation = "SUGGESTS_ACTION"]',
          style: {
            width: 2,
            'line-color': '#EA580C',
            'target-arrow-color': '#EA580C',
          },
        },
        {
          selector: 'edge[relation = "ASSIGNED_TO"]',
          style: {
            width: 1.8,
            'line-color': '#2563EB',
            'target-arrow-color': '#2563EB',
          },
        },
        {
          selector: 'edge[relation = "ENGAGES"]',
          style: {
            width: 1.8,
            'line-color': '#64748B',
            'target-arrow-color': '#64748B',
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

      {/* Clean Context Graph Legend */}
      <div className="flex flex-wrap items-center gap-3 pt-0.5 pb-1 text-[10px] font-mono text-brand-muted border-b border-brand-border/60">
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded bg-[#0F172A] inline-block" />
          <span>Account</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] inline-block" />
          <span>Owner</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#64748B] inline-block" />
          <span>Stakeholder</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rotate-45 bg-[#0D9488] inline-block" />
          <span>Signal</span>
        </span>
        <span className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded bg-[#EA580C] inline-block" />
          <span className="text-[#EA580C] font-semibold">Proposed Action</span>
        </span>
      </div>


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
