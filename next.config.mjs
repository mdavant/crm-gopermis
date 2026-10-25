/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-socket", "pg"],
};

export default nextConfig;
