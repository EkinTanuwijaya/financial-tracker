module.exports = {
  testEnvironment: "node",
  maxWorkers: 2,
  testMatch: ["<rootDir>/src/**/*.spec.ts"],
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
};
