import "./globals.css";
import "./glass.css";
import { AppProvider } from "../components/app-context";
import { AppShell } from "../components/app-shell";

export const metadata = {
  title: "GoPermis CRM",
  description: "Espace administratif et CRM GoPermis pour la gestion des clients, plannings, véhicules et moniteurs.",
  openGraph: {
    title: "GoPermis CRM",
    description: "Espace administratif et CRM GoPermis pour la gestion des clients, plannings, véhicules et moniteurs.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Inter+Tight:wght@600;700;800&family=Instrument+Serif:ital@0;1&display=swap"
        />
      </head>
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
