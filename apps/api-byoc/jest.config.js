/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/src/**/*.spec.ts"],
  transform: {
    "^.+\\.ts$": [
      "@swc/jest",
      {
        jsc: {
          target: "es2022",
          parser: { syntax: "typescript", decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
        module: { type: "commonjs" },
      },
    ],
  },
  // Les tests n'ont pas besoin que packages/shared soit compilé :
  // on pointe directement sur ses sources TypeScript.
  moduleNameMapper: {
    "^@finops-lab/shared$": "<rootDir>/../../packages/shared/src/index.ts",
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.spec.ts",
    "!src/generated/**",
    "!src/main.ts",
    "!src/**/*.module.ts",
    "!src/azure/mock-cost-data.ts",
  ],
  coverageReporters: ["text-summary", "lcov"],
};
