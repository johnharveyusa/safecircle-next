/**
 * app/layout.tsx
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SafeCircle",
  description: "Neighborhood safety · Shelby County, TN",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body className="bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
