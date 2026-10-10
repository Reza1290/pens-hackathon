/** Shared visual vocabulary for the product graph and the illustrative landing diagram. */
export const graphTheme = {
  account: { label: 'Account', ink: '#9a3c08', fill: '#fff4e8', border: '#f48120' },
  signal: { label: 'Signal', ink: '#9a3c08', fill: '#fffaf4', border: '#f48120' },
  employee: { label: 'Internal owner', ink: '#0051c3', fill: '#f1f6fd', border: '#8aaddb' },
  contact: { label: 'Stakeholder', ink: '#364152', fill: '#ffffff', border: '#a7adb5' },
  action: { label: 'Proposed action', ink: '#9a3c08', fill: '#fff4e8', border: '#f48120' },
  contract: { label: 'Contract', ink: '#364152', fill: '#ffffff', border: '#a7adb5' },
  decision: { label: 'Decision', ink: '#364152', fill: '#ffffff', border: '#a7adb5' },
};

export const nodeTheme = (kind: string) => graphTheme[kind as keyof typeof graphTheme]
  ?? { label: kind.replaceAll('_', ' '), ink: '#364152', fill: '#ffffff', border: '#a7adb5' };
