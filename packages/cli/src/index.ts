#!/usr/bin/env tsx
import { cli, command } from "cleye";
import { generate, findDocs } from "@ddtds/core";

export { generate, findDocs };
export type { GenerateDeps } from "@ddtds/core";

const buildCmd = command(
  {
    name: "build",
    parameters: ["[dir]"],
    flags: {
      output: {
        type: String,
        default: "__doctests__",
        description: "Directory for generated test files",
      },
    },
  },
  (argv) => {
    const searchDir = argv._.dir ?? process.cwd();
    generate(searchDir, argv.flags.output);
  },
);

void cli({
  name: "ddt",
  commands: [buildCmd],
});
