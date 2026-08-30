/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment:
        "Circular dependencies make module initialization order ambiguous.",
      severity: "error",
      from: { path: "^(src|netlify/functions|scripts)/" },
      to: { circular: true },
    },
    {
      name: "no-unresolvable",
      comment:
        "Every internal dependency must resolve in the configured TypeScript projects.",
      severity: "error",
      from: { path: "^(src|netlify/functions|scripts)/" },
      to: { couldNotResolve: true },
    },
    {
      name: "no-production-to-test",
      comment: "Production code must not depend on test-only modules.",
      severity: "error",
      from: { pathNot: "(^|/)(__tests__|test|e2e)(/|$)" },
      to: { path: "(^|/)(__tests__|test|e2e)(/|$)" },
    },
    {
      name: "no-client-to-functions",
      comment:
        "Browser bundles communicate with Netlify Functions over API contracts, never imports.",
      severity: "error",
      from: { path: "^src/(api|components|hooks|pages)/" },
      to: { path: "^netlify/functions/" },
    },
    {
      name: "no-functions-to-client-ui",
      comment:
        "Server functions may share schemas and pure libraries, but not browser UI or client hooks.",
      severity: "error",
      from: { path: "^netlify/functions/" },
      to: { path: "^src/(api|components|hooks|pages)/" },
    },
    {
      name: "no-production-dev-dependency",
      comment: "Runtime code cannot rely on a development-only package.",
      severity: "error",
      from: { path: "^(src|netlify/functions)/" },
      to: { dependencyTypes: ["npm-dev"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: "(^|/)(node_modules|dist|coverage)(/|$)",
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
