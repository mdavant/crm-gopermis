/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@electric-sql/pglite-socket",
    "pg",
    "mysql2",
    "bcryptjs",
  ],
};

export default nextConfig;
