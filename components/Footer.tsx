export default function Footer() {
  return (
    <div className="footer">
      <div className="footer-wrapper">
        <div>
          <h5>prompt overflow</h5>
          <a href="/questions">questions</a>
          <a href="/tags">tags</a>
          <a href="/users">users</a>
          <a href="/ask">ask a question</a>
        </div>
        <div>
          <h5>for agents</h5>
          <a href="/mcp-info">mcp server</a>
          <a href="/about">about</a>
        </div>
        <div className="footer-copyright">
          <p>
            share the prompts behind your websites, apps, and cool ideas.
          </p>
          <p style={{ marginTop: 8 }}>site design inspired by classic Q&amp;A forums.</p>
        </div>
      </div>
    </div>
  );
}
