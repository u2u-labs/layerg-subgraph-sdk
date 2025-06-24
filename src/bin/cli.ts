#!/usr/bin/env node

const [, , command, ...args] = process.argv;

switch (command) {
  case "deploy":
    import("./deployer/index.js").then((m) => m.deploy?.());
    break;
  case "generate":
    import("./generator/index.js").then((m) => m.generate?.());
    break;
  case "verify":
    import("./verifier/index.js").then((m) => m.getSubgraphConfig?.());
    break;
  default:
    console.error("Unknown command:", command);
    process.exit(1);
}
