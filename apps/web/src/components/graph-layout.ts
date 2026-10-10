import type { Core, CoseLayoutOptions } from 'cytoscape';

/** Separate starting positions also work for cycles and disconnected components. */
export function seedGraphPositions(cy: Core) {
  cy.nodes().sort((a, b) => a.id().localeCompare(b.id())).positions((_node, index) => {
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    const radius = 125 * Math.sqrt(index);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

export function organicLayout(animate: boolean): CoseLayoutOptions {
  return {
    name: 'cose', randomize: false, animate,
    animationThreshold: 0, refresh: 16,
    fit: true, padding: 45, nodeDimensionsIncludeLabels: true,
    nodeRepulsion: () => 9000, nodeOverlap: 24,
    idealEdgeLength: () => 60, edgeElasticity: () => 32,
    componentSpacing: 80, gravity: .8, numIter: 1200,
    initialTemp: 200, coolingFactor: .97, minTemp: .5,
  };
}

/** CoSE is approximate: pack any remaining card collisions without flattening its layout. */
export function separateGraphNodes(cy: Core, gap = 24) {
  const placed: Array<{ x1: number; x2: number; y1: number; y2: number }> = [];
  cy.batch(() => {
    cy.nodes().sort((a, b) => a.id().localeCompare(b.id())).forEach(node => {
      const box = node.boundingBox({ includeLabels: false, includeOverlays: false });
      const origin = { ...node.position() };
      const intersects = (candidate: typeof box) => placed.some(other =>
        candidate.x1 < other.x2 + gap && candidate.x2 + gap > other.x1 &&
        candidate.y1 < other.y2 + gap && candidate.y2 + gap > other.y1);
      let candidate = box;
      let dx = 0; let dy = 0;
      for (let step = 1; intersects(candidate) && step <= 2000; step++) {
        const angle = step * Math.PI * (3 - Math.sqrt(5));
        const radius = 18 * Math.sqrt(step);
        dx = Math.cos(angle) * radius; dy = Math.sin(angle) * radius;
        candidate = { ...box, x1: box.x1 + dx, x2: box.x2 + dx, y1: box.y1 + dy, y2: box.y2 + dy };
      }
      // Bounded fallback for unusually wide/long cards: place beyond all occupied boxes.
      if (intersects(candidate)) {
        dx = Math.max(...placed.map(other => other.x2)) + gap + 1 - box.x1; dy = 0;
        candidate = { ...box, x1: box.x1 + dx, x2: box.x2 + dx };
      }
      node.position({ x: origin.x + dx, y: origin.y + dy });
      placed.push(candidate);
    });
  });
}
