/** @type {import('jest').Config} */
const config = {
  coverageProvider: "v8",
  testEnvironment: "jest-environment-jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/__tests__/**/*.test.tsx",
  ],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          transform: {
            react: {
              runtime: "automatic",
            },
          },
        },
      },
    ],
  },
  collectCoverageFrom: [
    "lib/**/*.ts",
    "app/api/**/*.ts",
    "components/**/*.tsx",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
};

module.exports = config;
