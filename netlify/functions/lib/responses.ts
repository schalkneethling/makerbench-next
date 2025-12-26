/**
 * Standard API response helpers for Netlify Functions
 */

interface SuccessResponse<T> {
  success: true;
  data: T;
}

interface ErrorResponse {
  success: false;
  error: string;
  details?: Record<string, string[]>;
}

type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * Creates a JSON response with proper headers
 */
function jsonResponse<T>(body: ApiResponse<T>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Success response (200)
 */
export function ok<T>(data: T): Response {
  return jsonResponse({ success: true, data }, 200);
}

/**
 * Created response (201)
 */
export function created<T>(data: T): Response {
  return jsonResponse({ success: true, data }, 201);
}

/**
 * Bad request error (400)
 */
export function badRequest(error: string): Response {
  return jsonResponse({ success: false, error }, 400);
}

/**
 * Validation error (422)
 */
export function validationError(
  error: string,
  details?: Record<string, string[]>
): Response {
  return jsonResponse({ success: false, error, details }, 422);
}

/**
 * Conflict error (409) - e.g., duplicate URL
 */
export function conflict(error: string): Response {
  return jsonResponse({ success: false, error }, 409);
}

/**
 * Not found error (404)
 */
export function notFound(error: string): Response {
  return jsonResponse({ success: false, error }, 404);
}

/**
 * Internal server error (500)
 */
export function serverError(error: string): Response {
  return jsonResponse({ success: false, error }, 500);
}

/**
 * Method not allowed (405)
 */
export function methodNotAllowed(allowed: string[]): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: `Method not allowed. Allowed: ${allowed.join(", ")}`,
    }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        Allow: allowed.join(", "),
      },
    }
  );
}

