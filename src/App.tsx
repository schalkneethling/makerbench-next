/**
 * MakerBench App Root Component
 * Minimal shell displaying logo and tagline for foundation verification.
 */
function App() {
  return (
    <main>
      <a href="/" className="Logo Logo--xl">
        <span className="Logo-maker">Maker</span>
        <span className="Logo-bench">Bench</span>
      </a>
      <p>Save once, find forever.</p>
    </main>
  );
}

export default App;
