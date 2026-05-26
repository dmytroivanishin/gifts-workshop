import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Handmade gifts portfolio",
};

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">
        {children}
      </main>
      <footer className="border-t py-6 text-center text-muted-foreground">
        © {new Date().getFullYear()} Portfolio. All rights reserved.
      </footer>
    </div>
  );
}
