import { BrowserRouter, Routes, Route } from "react-router-dom";

import { MainLayout } from "./components/layout/MainLayout";
import { AuthProvider } from "./hooks/useAuth";
import { AboutPage } from "./pages/AboutPage";
import { HomePage } from "./pages/HomePage";
import { LibraryPage } from "./pages/LibraryPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { ResourcesPage } from "./pages/ResourcesPage";
import { SubmitPage } from "./pages/SubmitPage";

/**
 * MakerBench App Root Component
 */
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MainLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/tools" element={<HomePage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/submit" element={<SubmitPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
