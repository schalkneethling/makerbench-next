import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/**
 * MSW server instance for Node.js test environment
 */
export const server = setupServer(...handlers);

