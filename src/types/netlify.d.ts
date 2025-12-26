/**
 * Netlify global object type declarations
 * Available in Netlify Functions runtime
 */
declare const Netlify: {
  env: {
    get: (key: string) => string | undefined;
    has: (key: string) => boolean;
    set: (key: string, value: string) => void;
    delete: (key: string) => void;
    toObject: () => Record<string, string>;
  };
  context: unknown;
} | undefined;

