import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

// Next 16 builds with Turbopack by default. The previous `webpack()` override
// only existed to force `cheap-module-source-map` in dev, working around an
// eval-source-map quirk in webpack — Turbopack does not use eval-source-map,
// so the workaround is obsolete, and keeping a webpack config without a
// matching turbopack config is a hard build error.
const nextConfig: NextConfig = {};

export default nextConfig;

initOpenNextCloudflareForDev();
