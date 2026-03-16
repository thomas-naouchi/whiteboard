import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /**
         * Mark heavy Node.js-only packages as server external so that Next.js
     * does not try to bundle them. This is required for packages that rely
     * on native bindings, dynamic requires, or Node.js built-ins that the
     * webpack bundler cannot handle in a server component / API route.
     */
    serverExternalPackages: ["pdf-parse", "officeparser", "mammoth"],
};

export default nextConfig;
