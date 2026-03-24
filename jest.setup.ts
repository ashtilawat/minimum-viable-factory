import "@testing-library/jest-dom";

// Polyfill Web APIs used in lib/sse.ts and Next.js route handlers
const { TextEncoder, TextDecoder } = require("util");
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
