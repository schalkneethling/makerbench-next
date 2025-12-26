import { http, HttpResponse } from "msw";

/**
 * Default MSW request handlers for external services
 */
export const handlers = [
  // Browserless screenshot API
  http.post("https://chrome.browserless.io/screenshot", () => {
    // Return a minimal PNG buffer (1x1 transparent pixel)
    const pngBuffer = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    return HttpResponse.arrayBuffer(pngBuffer.buffer, {
      headers: { "Content-Type": "image/png" },
    });
  }),

  // Mock external page with OG metadata
  http.get("https://example.com/with-og", () => {
    return HttpResponse.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Example Tool</title>
          <meta name="description" content="A great tool for developers" />
          <meta property="og:title" content="Example Tool - OG Title" />
          <meta property="og:description" content="OG description for the tool" />
          <meta property="og:image" content="https://example.com/og-image.png" />
        </head>
        <body><h1>Example Tool</h1></body>
      </html>
    `);
  }),

  // Mock external page without OG image
  http.get("https://example.com/no-og-image", () => {
    return HttpResponse.html(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tool Without OG Image</title>
          <meta name="description" content="This tool has no OG image" />
        </head>
        <body><h1>Tool</h1></body>
      </html>
    `);
  }),

  // Mock external page with minimal metadata
  http.get("https://example.com/minimal", () => {
    return HttpResponse.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Minimal Page</title></head>
        <body></body>
      </html>
    `);
  }),

  // Mock unreachable page
  http.get("https://unreachable.invalid/*", () => {
    return HttpResponse.error();
  }),
];

