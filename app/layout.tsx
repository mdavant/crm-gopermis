import "./globals.css";
export const metadata = {
  title: "GoPermis CRM",
  description: "Espace administratif GoPermis",
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
