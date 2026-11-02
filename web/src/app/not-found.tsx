import Shell from "./_consumer/Shell";
export default function NotFound() {
  return (
    <Shell>
      <section style={{ maxWidth: 620, margin: "60px auto" }}>
        <p>SOR7ED</p>
        <h1>This page has moved or disappeared.</h1>
        <p>Your saved links may still be in your account.</p>
        <p>
          <a href="/account">Open your saved links →</a>
        </p>
        <p>
          <a href="/">Back to SOR7ED</a>
        </p>
      </section>
    </Shell>
  );
}
