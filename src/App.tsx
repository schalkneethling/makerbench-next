import { BrowserRouter, Routes, Route } from "react-router-dom";

import { MainLayout } from "./components/layout";
import {
  HomePage,
  ResourcesPage,
  SubmitPage,
  AboutPage,
  PrivacyPage,
  NotFoundPage,
} from "./pages";

/**
 * MakerBench App Root Component
 */
function App() {
  return (
    <BrowserRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tools" element={<HomePage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/submit" element={<SubmitPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MainLayout>
    </BrowserRouter>
  );
}

export default App;
