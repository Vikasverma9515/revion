import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The libSQL client ships a native binding; load it from node_modules at runtime.
  serverExternalPackages: ['@libsql/client', 'libsql'],
  outputFileTracingExcludes: { '*': ['.data/**'] },
  experimental: {
    // Vercel restores .next/cache between deploys; with this on, a restored
    // Turbopack cache served a stale styles/globals.css. Builds are small, so
    // always compile from scratch.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
