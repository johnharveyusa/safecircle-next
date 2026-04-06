import type { ReactNode } from "react";

export const metadata = {
  title: "Safe Circle",
  description: "Safe Circle",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}