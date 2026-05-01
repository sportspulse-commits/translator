/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/help': ['./prompts/**/*'],
    },
  },
};

export default nextConfig;
