/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "@electric-sql/pglite-socket", "pg"],
};

export default nextConfig;
