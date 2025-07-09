import type { NextConfig } from "next";

const isGithubPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = {
  output: 'export',
  basePath: isGithubPages ? '/YOUR_REPO_NAME' : '',
  assetPrefix: isGithubPages ? '/YOUR_REPO_NAME/' : '',
};

export default nextConfig;
