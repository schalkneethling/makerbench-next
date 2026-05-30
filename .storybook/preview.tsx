import type { Preview } from "@storybook/react-vite";
import React from "react";
import { BrowserRouter } from "react-router-dom";
import { initialize, mswLoader } from "msw-storybook-addon";

import "../src/index.css";
import { AuthProvider } from "../src/hooks/AuthProvider";
import { mswHandlers } from "./msw-handlers";

initialize({ onUnhandledRequest: "bypass" });

const preview: Preview = {
  decorators: [
    (Story) => (
      <AuthProvider>
        <BrowserRouter>
          <Story />
        </BrowserRouter>
      </AuthProvider>
    ),
  ],
  loaders: [mswLoader],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
    msw: {
      handlers: mswHandlers,
    },
  },
};

export default preview;
