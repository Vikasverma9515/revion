import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Native / heavy server packages are loaded from node_modules at runtime, not bundled.
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node', '@libsql/client', 'libsql', 'unpdf', 'sharp'],
  // Keep functions under Vercel's size limit: only the Linux x64 ONNX runtime is needed there.
  outputFileTracingExcludes: {
    '*': [
      'node_modules/**/onnxruntime-node/bin/napi-v*/darwin/**',
      'node_modules/**/onnxruntime-node/bin/napi-v*/win32/**',
      'node_modules/**/onnxruntime-node/bin/napi-v*/linux/arm64/**',
      'node_modules/**/onnxruntime-web/**',
      'node_modules/**/@img/**',
      'node_modules/**/sharp/**',
    ],
  },
  // The starter knowledge reads the Python reference scripts from disk.
  outputFileTracingIncludes: {
    '/api/lab/knowledge/starter': ['./reference/python/*.py'],
  },
  experimental: {
    // Vercel restores .next/cache between deploys; with this on, a restored
    // Turbopack cache served a stale styles/globals.css. Builds are small, so
    // always compile from scratch.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
