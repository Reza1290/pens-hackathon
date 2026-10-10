import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { graphSchema } from '@kasirnusa/contracts';
import type { z } from 'zod';
import { nodeTheme } from './graph-theme';
import './graph.css';

type GraphData = z.infer<typeof graphSchema>;

export function Graph({ graph, onEvidence }: { graph: GraphData; onEvidence: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<cytoscape.Core | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const edge = graph.edges.find((item) => item.id === selectedEdge);
  const name = (id: string) => graph.nodes.find((node) => node.id === id)?.label ?? id;
  const kinds = [...new Set(graph.nodes.map((node) => node.kind))];

  useEffect(() => {
    if (!container.current || !graph.nodes.length) return;
    setSelectedEdge(null);
    const cy = cytoscape({
      container: container.current,
      elements: [
        ...graph.nodes.map((node) => {
          const theme = nodeTheme(node.kind);
          return { data: { id: node.id, label: `${theme.label.toUpperCase()}\n${node.label}`, height: Math.max(64, 32 + Math.ceil(node.label.length / 23) * 15), ink: theme.ink, fill: theme.fill, border: theme.border } };
        }),
        ...graph.edges.map((item) => ({ data: { id: item.id, source: item.from, target: item.to, label: item.relation.replaceAll('_', ' '), relation: item.relation } })),
      ],
      layout: { name: 'breadthfirst', directed: true, padding: 45, spacingFactor: 1.25 },
      style: [
        { selector: 'node', style: {
          shape: 'round-rectangle', width: 156, height: 'data(height)',
          'background-color': 'data(fill)', 'border-color': 'data(border)', 'border-width': 1,
          color: 'data(ink)', label: 'data(label)', 'font-family': 'Inter, system-ui, sans-serif',
          'font-size': 10, 'font-weight': 500, 'text-wrap': 'wrap', 'text-max-width': '140px',
          'text-valign': 'center', 'text-halign': 'center', 'line-height': 1.5,
        } },
        { selector: 'edge', style: {
          width: 1.2, 'line-color': '#b6b9bf', 'target-arrow-color': '#b6b9bf',
          'target-arrow-shape': 'triangle', 'arrow-scale': .7, 'curve-style': 'bezier',
          label: 'data(label)', color: '#626770', 'font-family': 'ui-monospace, monospace',
          'font-size': 8, 'text-background-color': '#fafaf9', 'text-background-opacity': 1,
          'text-background-padding': '4px', 'text-rotation': 'autorotate',
        } },
        { selector: 'edge[relation = "SUGGESTS_ACTION"]', style: { 'line-color': '#f48120', 'target-arrow-color': '#f48120', width: 1.8 } },
        { selector: 'edge:selected', style: { 'line-color': '#0051c3', 'target-arrow-color': '#0051c3', color: '#0051c3', width: 2.5 } },
        { selector: 'node:selected', style: { 'border-width': 2, 'border-color': '#f48120' } },
      ],
      minZoom: .08, maxZoom: 2, wheelSensitivity: .2,
    });
    instance.current = cy;
    cy.on('tap', 'edge', (event) => setSelectedEdge(event.target.id()));
    cy.on('tap', (event) => { if (event.target === cy) setSelectedEdge(null); });
    const observer = new ResizeObserver(() => { cy.resize(); cy.fit(undefined, 45); });
    observer.observe(container.current);
    return () => { observer.disconnect(); cy.destroy(); instance.current = null; };
  }, [graph]);

  function zoom(factor: number) {
    const cy = instance.current;
    if (cy) cy.zoom({ level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * factor)), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  }

  const sources = (ids: string[]) => ids.length ? ids.map((id) => <button key={id} type="button" className="graph-source" onClick={() => onEvidence(id)}>View source {graph.evidence.find((item) => item.source_id === id)?.source_external_id ?? 'record'} <span aria-hidden="true">↗</span></button>) : <span className="graph-no-source">No linked source record</span>;

  return <section className="context-graph">
    <header className="graph-header"><div><h2><span className="graph-heading-dot" />Relationship path</h2><p>Follow the connections behind this account.</p></div><span className="graph-count">{graph.nodes.length} nodes / {graph.edges.length} edges</span></header>
    <div className="graph-toolbar"><span>CONTEXT GRAPH</span><div role="group" aria-label="Graph view controls"><button type="button" disabled={!graph.nodes.length} onClick={() => zoom(1 / 1.25)} aria-label="Zoom out">−</button><button type="button" disabled={!graph.nodes.length} onClick={() => zoom(1.25)} aria-label="Zoom in">+</button><button type="button" disabled={!graph.nodes.length} onClick={() => instance.current?.fit(undefined, 45)}>Fit view</button></div></div>
    {graph.nodes.length ? <div ref={container} className="graph-canvas" role="img" aria-label="Evidence relationship graph. Use the relationship list below for keyboard access to all sources." /> : <div className="graph-empty">No relationships available in this evidence scope.</div>}
    <div className="graph-legend">{kinds.map((kind) => { const theme = nodeTheme(kind); return <span key={kind}><i style={{ background: theme.fill, borderColor: theme.border }} />{theme.label}</span>; })}</div>
    <div className="graph-inspector" aria-live="polite">{edge ? <><p><strong>{name(edge.from)}</strong><span> → {edge.relation.replaceAll('_', ' ')} → </span><strong>{name(edge.to)}</strong></p><div className="graph-source-list">{sources(edge.evidence_ids)}</div></> : <p>Select a connection to inspect its supporting evidence.</p>}</div>
    <div className="graph-bottom"><p>Bounded to {graph.limits.max_hops} hops / {graph.limits.max_nodes} nodes. {graph.limits.truncated ? 'Path truncated; some relationships are not shown.' : 'Complete within these limits.'}</p>
      <details><summary>Accessible relationship list ({graph.edges.length})</summary><ul>{graph.edges.map((item) => <li key={item.id}><span>{name(item.from)} <span className="graph-relation">→ {item.relation.replaceAll('_', ' ')} →</span> {name(item.to)}</span><div className="graph-source-list">{sources(item.evidence_ids)}</div></li>)}</ul></details>
    </div>
  </section>;
}
