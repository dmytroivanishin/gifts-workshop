import type { Metadata } from "next";
import AdminShell from "./AdminShell";

// The admin has its own manifest so "add to home screen" from /admin opens the admin, not the public
// start page. This layout is a server component only so it can export metadata; the client shell
// (navigation, auth check) lives in AdminShell.
export const metadata: Metadata = {
  manifest: "/manifest-admin.webmanifest",
};

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <AdminShell>{children}</AdminShell>;
}
