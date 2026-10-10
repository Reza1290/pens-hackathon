import { useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { graphSchema } from '@kasirnusa/contracts';
import type { z } from 'zod';
import { nodeTheme } from './graph-theme';
import { organicLayout, seedGraphPositions, separateGraphNodes } from './graph-layout';
import './graph.css';

type GraphData = z.infer<typeof graphSchema>;

export function Graph({ graph, onEvidence }: { graph: GraphData; onEvidence: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<cytoscape.Core | null>(null);
  const rearrange = useRef<(() => void) | null>(null);
  const [arranging, setArranging] = useState(false);
  // Equal API payloads and source-panel rerenders must not reset a user's layout.
  const geometryKey = JSON.stringify({ nodes: graph.nodes, edges: graph.edges.map(({ id, from, to, relation }) => ({ id, from, to, relation })) });
  const geometry = useMemo(() => JSON.parse(geometryKey) as Pick<GraphData, 'nodes' | 'edges'>, [geometryKey]);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const edge = graph.edges.find((item) => item.id === selectedEdge);
  const name = (id: string) => graph.nodes.find((node) => node.id === id)?.label ?? id;
  const kinds = [...new Set(graph.nodes.map((node) => node.kind))];

  useEffect(() => {
    if (!container.current || !geometry.nodes.length) return;
    setSelectedEdge(null);
    const cy = cytoscape({
      container: container.current,
      elements: [
        ...geometry.nodes.map((node) => {
          const theme = nodeTheme(node.kind);
          return { data: { id: node.id, label: `${theme.label.toUpperCase()}\n${node.label}`, height: Math.max(64, 32 + Math.ceil(node.label.length / 23) * 15), ink: theme.ink, fill: theme.fill, border: theme.border } };
        }),
        ...geometry.edges.map((item) => ({ data: { id: item.id, source: item.from, target: item.to, label: item.relation.replaceAll('_', ' '), relation: item.relation } })),
      ],
      layout: { name: 'preset', fit: false },
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
          'min-zoomed-font-size': 7,
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
    let layout: cytoscape.Layouts | undefined;
    let initialized = false;
    let previousSize = { width: 0, height: 0 };
    let resizeFrame = 0;
    let cancelled = false;
    const runLayout = () => {
      cancelled = true;
      layout?.stop();
      cy.elements().stop();
      seedGraphPositions(cy);
      cy.fit(undefined, 45);
      setArranging(true);
      cancelled = false;
      layout = cy.layout(organicLayout(!window.matchMedia('(prefers-reduced-motion: reduce)').matches));
      layout.one('layoutstop', () => {
        if (cancelled) return;
        separateGraphNodes(cy);
        cy.fit(undefined, 45);
        setArranging(false);
      });
      layout.run();
    };
    rearrange.current = runLayout;
    // Dragging must never compete with a layout animation.
    cy.on('grab', 'node', () => { cancelled = true; layout?.stop(); cy.elements().stop(); setArranging(false); });
    const resize = () => {
      const { width, height } = container.current!.getBoundingClientRect();
      if (width < 2 || height < 2) return; // Accordion/tab may still be hidden.
      const pan = cy.pan();
      cy.resize();
      if (!initialized) { initialized = true; runLayout(); }
      else cy.pan({ x: pan.x + (width - previousSize.width) / 2, y: pan.y + (height - previousSize.height) / 2 });
      previousSize = { width, height };
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect(); cancelAnimationFrame(resizeFrame);
      cancelled = true;
      layout?.stop(); cy.destroy(); instance.current = null; rearrange.current = null;
    };
  }, [geometry]);

  function zoom(factor: number) {
    const cy = instance.current;
    if (cy) cy.zoom({ level: Math.max(cy.minZoom(), Math.min(cy.maxZoom(), cy.zoom() * factor)), renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  }

  const sources = (ids: string[]) => ids.length ? ids.map((id) => <button key={id} type="button" className="graph-source" onClick={() => onEvidence(id)}>View source {graph.evidence.find((item) => item.source_id === id)?.source_external_id ?? 'record'} <span aria-hidden="true">↗</span></button>) : <span className="graph-no-source">No linked source record</span>;

  return <section className="context-graph">
    <header className="graph-header"><div><h2><span className="graph-heading-dot" />Relationship path</h2><p>Follow the connections behind this account.</p></div><span className="graph-count">{graph.nodes.length} nodes / {graph.edges.length} edges</span></header>
    <div className="graph-toolbar"><span aria-live="polite">{arranging ? 'MENATA GRAPH…' : 'CONTEXT GRAPH'}</span><div role="group" aria-label="Graph view controls"><button type="button" disabled={!graph.nodes.length || arranging} onClick={() => zoom(1 / 1.25)} aria-label="Zoom out">−</button><button type="button" disabled={!graph.nodes.length || arranging} onClick={() => zoom(1.25)} aria-label="Zoom in">+</button><button type="button" disabled={!graph.nodes.length || arranging} onClick={() => instance.current?.fit(undefined, 45)}>Fit view</button><button type="button" disabled={!graph.nodes.length || arranging} onClick={() => rearrange.current?.()} title="Susun ulang node dengan jarak yang lebih nyaman">Rapikan</button></div></div>
    {graph.nodes.length ? <div ref={container} className="graph-canvas" role="img" aria-label="Evidence relationship graph. Use the relationship list below for keyboard access to all sources." /> : <div className="graph-empty">No relationships available in this evidence scope.</div>}
    {graph.nodes.length > 0 && <p className="graph-gesture-hint">Geser node untuk mengatur posisi · Geser area kosong untuk menjelajah · Scroll atau cubit untuk zoom</p>}
    <div className="graph-legend">{kinds.map((kind) => { const theme = nodeTheme(kind); return <span key={kind}><i style={{ background: theme.fill, borderColor: theme.border }} />{theme.label}</span>; })}</div>
    <div className="graph-inspector" aria-live="polite">{edge ? <><p><strong>{name(edge.from)}</strong><span> → {edge.relation.replaceAll('_', ' ')} → </span><strong>{name(edge.to)}</strong></p><div className="graph-source-list">{sources(edge.evidence_ids)}</div></> : <p>Select a connection to inspect its supporting evidence.</p>}</div>
    <div className="graph-bottom"><p>Bounded to {graph.limits.max_hops} hops / {graph.limits.max_nodes} nodes. {graph.limits.truncated ? 'Path truncated; some relationships are not shown.' : 'Complete within these limits.'}</p>
      <details><summary>Accessible relationship list ({graph.edges.length})</summary><ul>{graph.edges.map((item) => <li key={item.id}><span>{name(item.from)} <span className="graph-relation">→ {item.relation.replaceAll('_', ' ')} →</span> {name(item.to)}</span><div className="graph-source-list">{sources(item.evidence_ids)}</div></li>)}</ul></details>
    </div>
  </section>;
}
