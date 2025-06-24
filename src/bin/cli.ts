#!/usr/bin/env node

const [, , command, ...args] = process.argv;

switch (command) {
  case "deploy":
    import("./deployer/index.js").then((m) => m.deploy?.());
    break;
  case "generate":
    import("./generator/index.js").then((m: any) => m.generate?.());
    break;
  default:
    console.error("Unknown command:", command);
    process.exit(1);
}
