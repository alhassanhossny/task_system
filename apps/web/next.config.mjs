import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const workspaceRoot = new URL("../..", import.meta.url).pathname;

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@taskflow/ui", "@taskflow/types", "@taskflow/config", "@taskflow/shared"],
  typedRoutes: false,
  outputFileTracingRoot: workspaceRoot
};

export default withNextIntl(nextConfig);
