import React from "react";
import type { Metadata } from "next";
import { ensurePlatformSeeded } from "@/lib/bootstrap";
import { getAdminSession } from "@/lib/admin-auth";
import { AdminLoginView } from "@/components/admin/AdminLoginView";
import { AdminDashboardView } from "@/components/admin/AdminDashboardView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "LOVECRAFT — Admin",
  description: "LOVECRAFT central administration console.",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  await ensurePlatformSeeded();
  const session = await getAdminSession();

  if (!session) {
    return <AdminLoginView />;
  }

  return (
    <AdminDashboardView
      admin={{
        id: session.id,
        username: session.username,
        email: session.email,
        role: session.role,
        csrfToken: session.csrfToken,
      }}
    />
  );
}
