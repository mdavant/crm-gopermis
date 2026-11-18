/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Les migrations MySQL sont lues au démarrage : les inclure dans le build standalone.
  outputFileTracingIncludes: {
    "/api/**/*": ["./db/migrations-mysql/**/*"],
  },
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@electric-sql/pglite-socket",
    "pg",
    "mysql2",
    "bcryptjs",
  ],
};

export default nextConfig;
