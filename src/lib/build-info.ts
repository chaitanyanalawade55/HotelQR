// Deployment telemetry, inlined at build time via next.config.mjs `env`.
// The same global values for every hotel — one Vercel deployment serves all.
export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA || "dev";
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || "";
export const DEPLOYER = process.env.NEXT_PUBLIC_DEPLOYER || "";
