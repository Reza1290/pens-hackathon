import { expect } from '@playwright/test';
import { test } from './browser-session';

// Inspect rendered geometry, rather than treating a screenshot as proof of spacing.
async function geometry(page: import('@playwright/test').Page) {
  return page.locator('.graph-canvas').evaluate((element) => {
    const cy = (element as HTMLElement & { _cyreg: { cy: import('cytoscape').Core } })._cyreg.cy;
    const boxes = cy.nodes().map(node => ({ id: node.id(), box: node.boundingBox({ includeLabels: false }), position: node.position() }));
    const overlaps: string[] = [];
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      const x = boxes[a].box; const y = boxes[b].box;
      if (x.x1 < y.x2 && x.x2 > y.x1 && x.y1 < y.y2 && x.y2 > y.y1) overlaps.push(`${boxes[a].id}/${boxes[b].id}`);
    }
    return { boxes, overlaps, zoom: cy.zoom(), positions: boxes.map(node => node.position) };
  });
}

test('C06 and C01 organic graphs keep nodes apart and preserve a dragged layout on resize', async ({ page, request }) => {
  const { items } = await (await request.get('/api/datasets')).json();
  const dataset = items.find((item: { version: string }) => item.version === 'kasirnusa-2026-10-01');
  expect(dataset).toBeTruthy();
  const { items: accounts } = await (await request.get(`/api/accounts?dataset_id=${dataset.id}&page_size=100`)).json();
  await page.setViewportSize({ width: 1440, height: 1100 });
  for (const code of ['C06', 'C01']) {
    const account = accounts.find((item: { externalId: string }) => item.externalId === code);
    await page.goto(`/accounts/${account.id}?dataset_id=${dataset.id}`);
    await page.getByRole('button', { name: 'Relationship Graph', exact: true }).click();
    await expect(page.locator('.graph-canvas canvas').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rapikan', exact: true })).toBeEnabled();
    await expect.poll(async () => (await geometry(page)).overlaps).toEqual([]);
    await page.screenshot({ path: `artifacts/organic-${code}.png` });
    const canvas = await page.locator('.graph-canvas').boundingBox();
    const point = await page.locator('.graph-canvas').evaluate(element => {
      const cy = (element as HTMLElement & { _cyreg: { cy: import('cytoscape').Core } })._cyreg.cy;
      return cy.nodes()[0].renderedPosition();
    });
    const before = await geometry(page);
    await page.mouse.move(canvas!.x + point.x, canvas!.y + point.y);
    await page.mouse.down();
    await page.mouse.move(canvas!.x + point.x + 35, canvas!.y + point.y + 25, { steps: 12 });
    await page.mouse.up();
    expect((await geometry(page)).positions[0]).not.toEqual(before.positions[0]);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const moved = await geometry(page);
    await page.setViewportSize({ width: 1100, height: 950 });
    await expect.poll(async () => (await geometry(page)).zoom).toBe(moved.zoom);
    expect((await geometry(page)).positions).toEqual(moved.positions);
    await page.getByRole('button', { name: 'Rapikan', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Rapikan', exact: true })).toBeEnabled();
    await expect.poll(async () => (await geometry(page)).overlaps).toEqual([]);
    await page.getByText(/Accessible relationship list/).click();
    await page.locator('.graph-source').first().click();
    await expect(page.getByRole('complementary', { name: 'Original source' })).toBeVisible();
    await page.getByRole('button', { name: 'Close source' }).click();
    await page.setViewportSize({ width: 1440, height: 1100 });
  }
});

test('hidden initial container, cycles and disconnected nodes do not collapse', async ({ page, request }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { items } = await (await request.get('/api/datasets')).json();
  const dataset = items.find((item: { version: string }) => item.version === 'kasirnusa-2026-10-01');
  const { items: accounts } = await (await request.get(`/api/accounts?dataset_id=${dataset.id}&page_size=100`)).json();
  const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const nodes = Array.from({ length: 50 }, (_, i) => ({ id: id(i + 1), kind: i ? 'contact' : 'account', label: `Synthetic node ${i + 1}` }));
  const edges = Array.from({ length: 40 }, (_, i) => ({ id: id(100 + i), from: id(i + 1), to: id((i + 1) % 40 + 1), relation: 'RELATED_TO', evidence_ids: [] }));
  await page.route('**/diagnosis/evidence?*', route => route.fulfill({ json: { nodes, edges, evidence: [], limits: { max_hops: 3, max_nodes: 50, truncated: false } } }));
  await page.goto(`/accounts/${accounts[0].id}?dataset_id=${dataset.id}`);
  const hidden = await page.addStyleTag({ content: '.graph-canvas { display: none !important; }' });
  await page.getByRole('button', { name: 'Relationship Graph', exact: true }).click();
  await expect(page.locator('.graph-canvas')).toBeAttached();
  await hidden.evaluate(element => element.parentNode?.removeChild(element));
  await expect.poll(async () => (await geometry(page)).overlaps).toEqual([]);
  expect((await geometry(page)).boxes).toHaveLength(50);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Fit view', exact: true }).click();
  expect((await geometry(page)).overlaps).toEqual([]);
});
