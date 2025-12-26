/**
 * Result of screenshot capture
 */
export interface ScreenshotResult {
  success: boolean;
  buffer: Buffer | null;
  error?: string;
}

/**
 * Browserless API request payload
 */
interface BrowserlessPayload {
  url: string;
  options: {
    type: "png" | "jpeg";
    fullPage: boolean;
  };
  viewport: {
    width: number;
    height: number;
  };
  waitForTimeout?: number;
}

/**
 * Captures a screenshot of a URL using Browserless API
 * @param url - URL to capture
 * @param apiKey - Browserless API key (defaults to env var)
 * @returns Screenshot buffer or error
 */
export async function captureScreenshot(
  url: string,
  apiKey?: string
): Promise<ScreenshotResult> {
  const key = apiKey ?? getApiKey();

  if (!key) {
    return {
      success: false,
      buffer: null,
      error: "BROWSERLESS_API_KEY not configured",
    };
  }

  const payload: BrowserlessPayload = {
    url,
    options: {
      type: "png",
      fullPage: false,
    },
    viewport: {
      width: 1280,
      height: 800,
    },
    waitForTimeout: 3000, // Wait 3s for page to settle
  };

  try {
    const response = await fetch(
      `https://chrome.browserless.io/screenshot?token=${key}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30s timeout
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        buffer: null,
        error: `Browserless API error: ${response.status} - ${errorText}`,
      };
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      success: true,
      buffer,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const isTimeout =
      message.includes("timeout") || message.includes("abort");

    return {
      success: false,
      buffer: null,
      error: isTimeout ? "Screenshot capture timeout" : message,
    };
  }
}

/**
 * Gets Browserless API key from environment
 */
function getApiKey(): string | undefined {
  // In Netlify Functions context
  if (typeof Netlify !== "undefined" && Netlify?.env) {
    return Netlify.env.get("BROWSERLESS_API_KEY");
  }
  // In Node.js/test context
  return process.env.BROWSERLESS_API_KEY;
}

