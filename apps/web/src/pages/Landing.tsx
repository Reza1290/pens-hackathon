import { useState, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { nodeTheme } from '../components/graph-theme';
import './landing.css';

const exampleNodes = [
  { id: 'account', kind: 'account', x: 240, y: 205, title: 'Your customer', detail: 'Start with one account. Connect its requests, commercial terms and the people involved in a decision.', meta: 'Account context' },
  { id: 'request', kind: 'signal', x: 40, y: 65, title: 'Expansion request', detail: 'A request for more outlets is a buying signal. Check its scope and timing against recorded opportunities before suggesting follow-up.', meta: 'What could grow?' },
  { id: 'stakeholder', kind: 'contact', x: 400, y: 65, title: 'Customer stakeholder', detail: 'Keep the evaluator, intermediary and approver distinct. A title alone does not establish purchasing authority.', meta: 'Who should be involved?' },
  { id: 'terms', kind: 'contract', x: 40, y: 345, title: 'Current terms', detail: 'Read the effective package and pricing before calculating additional business. Show assumptions when new terms are needed.', meta: 'What needs checking?' },
  { id: 'action', kind: 'action', x: 400, y: 345, title: 'Prepare follow-up', detail: 'Bring the account owner, supporting evidence and the customer’s documented requirements into one proposed next action.', meta: 'What happens next?' },
];

function ContextIllustration() {
  const [selected, setSelected] = useState('request');
  const active = exampleNodes.find((node) => node.id === selected)!;
  return <div className="context-example">
    <div className="example-bar"><span><span className="orange-dot" /> Context graph</span><span>ILLUSTRATIVE ACCOUNT</span></div>
    <div className="example-map">
      <svg viewBox="0 0 620 460" aria-hidden="true" className="example-wires">
        <path d="M130 115V162H310V205 M490 115V162H310 M130 345V304H310V255 M490 345V304H310" />
        <path className="active-wire" d={selected === 'request' ? 'M130 115V162H310V205' : selected === 'stakeholder' ? 'M490 115V162H310V205' : selected === 'terms' ? 'M130 345V304H310V255' : 'M490 345V304H310V255'} />
        <circle cx="310" cy="162" r="4" /><circle cx="310" cy="304" r="4" />
        <text x="165" y="151">FOR ACCOUNT</text><text x="361" y="151">INVOLVES</text>
        <text x="163" y="325">COVERS ACCOUNT</text><text x="359" y="325">SUGGESTS ACTION</text>
      </svg>
      {exampleNodes.map((node) => { const theme = nodeTheme(node.kind); return <button key={node.id} aria-pressed={selected === node.id} onClick={() => setSelected(node.id)} className={`example-node ${node.id === 'account' ? 'example-account' : ''}`} style={{ left: `${node.x / 620 * 100}%`, top: `${node.y / 460 * 100}%`, '--node-ink': theme.ink, '--node-fill': theme.fill, '--node-border': theme.border } as CSSProperties}>
        <span className="node-kind"><span className="node-port" />{theme.label}</span><strong>{node.title}</strong>
      </button>; })}
      <span className="map-caption">SELECT A NODE TO EXPLORE</span>
    </div>
    <div className="example-inspector" aria-live="polite"><span className="eyebrow">{active.meta}</span><p>{active.detail}</p></div>
  </div>;
}

export function Landing() {
  const { search } = useLocation();
  const workspace = `/opportunities${search}`;
  return <div className="landing">
    <a className="skip" href="#landing-main">Skip to content</a>
    <header className="landing-header">
      <Link to={`/${search}`} className="landing-brand" aria-label="KasirNusa home"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2L2 19.5h20L12 2zm0 4.2l6.5 11.3H5.5L12 6.2z" /></svg>KasirNusa<span className="brand-divider" /><span className="brand-product">Account expansion</span></Link>
      <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#context">Context graph</a><Link className="landing-button small" to={workspace}>Open dashboard <span aria-hidden="true">↗</span></Link></nav>
    </header>
    <main id="landing-main">
      <section className="landing-hero">
        <div className="hero-copy"><p className="eyebrow"><span className="orange-rule" /> THE ACCOUNT EXPANSION WORKBENCH</p>
          <h1>The next opportunity.<br />Already in<br /><span>your accounts.</span></h1>
          <p className="hero-description">Connect customer requests, stakeholder context and commercial terms. See where an account can grow—and what needs to happen next.</p>
          <div className="hero-actions"><Link to={workspace} className="landing-button">Explore your accounts <span aria-hidden="true">→</span></Link><a className="text-link" href="#context">Follow the evidence <span aria-hidden="true">↓</span></a></div>
          <p className="hero-note">Built for account managers, customer success and sales.</p>
        </div>
        <ContextIllustration />
      </section>
      <div className="source-strip"><span>ONE ACCOUNT. CONNECTED CONTEXT.</span><div><span>CRM records</span><span>Customer conversations</span><span>Commercial terms</span><span>Product & support</span></div></div>
      <section className="landing-section" id="how-it-works">
        <div className="section-heading"><p className="eyebrow">FROM REQUEST TO NEXT STEP</p><h2>Find the opening.<br />Understand the decision.</h2><p>A quotation request is a starting point. A useful action plan also needs the right people, the current constraints and a reason to move.</p></div>
        <div className="workflow-list">
          <article><span className="step-number">01</span><div><h3>Find the request that needs attention.</h3><p>Surface explicit expansion plans and quotation requests. Compare them with CRM opportunities to see what has a recorded next step.</p><span className="workflow-tag">Request → CRM reconciliation</span></div></article>
          <article><span className="step-number">02</span><div><h3>Know who to involve—and why.</h3><p>See who evaluates, who approves and what each person has asked for. Keep useful intermediaries in the conversation.</p><span className="workflow-tag">Stakeholder → Documented requirement</span></div></article>
          <article><span className="step-number">03</span><div><h3>Make the next conversation specific.</h3><p>Prepare discussion points, check prerequisites and calculate conditional value. Review an editable follow-up before taking it to the customer.</p><span className="workflow-tag">Evidence → Proposed action</span></div></article>
        </div>
      </section>
      <section className="context-section" id="context">
        <div className="context-copy"><p className="eyebrow">EVERY CONNECTION HAS A REASON</p><h2>A graph you can<br />actually use.</h2><p>Go from a recommendation to the records behind it. See how a request connects to an account, a decision requirement and the next proposed action.</p><Link to={workspace} className="text-link">Open the workbench <span aria-hidden="true">→</span></Link></div>
        <div className="evidence-specimen"><div className="specimen-heading"><span className="orange-dot" />Inside a relationship path<span>EXAMPLE</span></div>
          <div className="specimen-route"><span>Customer request</span><span aria-hidden="true">↓ <small>SUPPORTED BY</small></span><span>Original source record</span><span aria-hidden="true">↓ <small>DERIVED FROM</small></span><span className="specimen-action">Proposed next action</span></div>
          <dl><div><dt>Traceable</dt><dd>Source record, passage and event date</dd></div><div><dt>Scoped</dt><dd>Account, decision and stakeholder</dd></div><div><dt>Explicit</dt><dd>Known facts, assumptions and open questions</dd></div></dl>
        </div>
      </section>
      <section className="landing-close"><div><p className="eyebrow">START WITH THE ACCOUNT</p><h2>Go into the next conversation<br />with the context behind you.</h2></div><Link to={workspace} className="landing-button">Open dashboard <span aria-hidden="true">→</span></Link></section>
    </main>
    <footer className="landing-footer"><span>KasirNusa <span className="footer-muted">/ Account Expansion Assistant</span></span><span>Evidence first. Human decisions.</span><a href="#landing-main">Back to top ↑</a></footer>
  </div>;
}
