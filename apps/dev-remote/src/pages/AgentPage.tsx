export function AgentPage() {
  return (
    <div className="card">
      <h2>Custom SDK agent (planned)</h2>
      <p className="muted">
        Tier 3: send ad-hoc prompts to <code>@cursor/sdk</code> from your phone.
      </p>
      <pre>{`POST /perf/agent
{
  "prompt": "Fix the failing test in ...",
  "model": "composer-2.5"
}`}</pre>
      <p className="muted">
        See <code>docs/remote-dev-pwa/ARCHITECTURE.md</code> for the full design.
      </p>
    </div>
  );
}
