import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native / heavy server packages are loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node', '@libsql/client', 'libsql', 'unpdf', 'sharp'],
  // Keep functions under Vercel's size limit: only the Linux x64 ONNX runtime is needed there.
  outputFileTracingExcludes: {
    '*': [
      '.data/**',
      'node_modules/**/onnxruntime-node/bin/napi-v*/darwin/**',
      'node_modules/**/onnxruntime-node/bin/napi-v*/win32/**',
      'node_modules/**/onnxruntime-node/bin/napi-v*/linux/arm64/**',
      'node_modules/**/onnxruntime-web/**',
      // transformers.js imports sharp at load time, so keep it, minus non-Linux binaries.
      'node_modules/**/@img/*darwin*/**',
      'node_modules/**/@img/*win32*/**',
    ],
  },
  // The starter knowledge reads the Python reference scripts from disk.
  outputFileTracingIncludes: {
    '/api/lab/knowledge/starter': ['./reference/python/*.py'],
    // The ONNX runtime loads its native binding by computed path, which tracing cannot see.
    '/api/lab/**': [
      './node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/package.json',
      './node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/dist/**',
      './node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v*/linux/x64/**',
      './node_modules/.pnpm/onnxruntime-common@*/node_modules/onnxruntime-common/**',
    ],
  },
  experimental: {
    // Vercel restores .next/cache between deploys; with this on, a restored
    // Turbopack cache served a stale styles/globals.css. Builds are small, so
    // always compile from scratch.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
