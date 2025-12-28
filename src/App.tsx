/**
 * MakerBench App Root Component
 * Minimal shell displaying logo and tagline for foundation verification.
 */
function App() {
  return (
    <>
      <header>
        <hgroup>
          <a href="/" className="Logo Logo--xl">
            <span className="Logo-maker">Maker</span>
            <span className="Logo-bench">Bench</span>
          </a>
          <p>Save once, find forever.</p>
        </hgroup>
      </header>
      <main>{/* Primary content goes here */}</main>
    </>
  );
}

export default App;
