import { Header, Footer } from "./components/layout";

/**
 * MakerBench App Root Component
 */
function App() {
  return (
    <div className="App">
      <Header />
      <main>{/* Primary content goes here */}</main>
      <Footer />
    </div>
  );
}

export default App;
