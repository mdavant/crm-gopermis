/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // Les migrations SQL sont lues à l'exécution : les inclure dans la sortie
  // standalone publiée (Hostinger lance directement .next/standalone).
  outputFileTracingIncludes: {
    "/**": ["./db/**/*", "./assets/documents/**/*"],
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
