import "./globals.css";
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
      <body>{children}</body>
    </html>
  );
}
