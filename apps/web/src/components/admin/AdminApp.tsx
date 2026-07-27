import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminUIProvider } from "@/components/admin/ui";
import { getAllowedTabs, getRole, isAuthed, listAdminUsers, type AdminUser } from "@/lib/admin-auth";
import { getAudit, type AuditEntry } from "@/lib/audit-store";
import { getEvents } from "@/lib/events-store";
import { getLeads } from "@/lib/leads-store";
import { notificationChannels } from "@/lib/notify";

/**
 * The admin application (auth gate + dashboard). Extracted so it can render at
 * BOTH the default `/[lang]/admin` route and a custom admin path (served by the
 * `[...slug]` catch-all when the owner changes the admin URL).
 */
export async function AdminApp({ lang }: { lang: string }) {
  if (!(await isAuthed())) return <AdminLogin />;

  const [leads, events, role, allowedTabs] = await Promise.all([getLeads(), getEvents(), getRole(), getAllowedTabs()]);
  const isSuper = role === "super";
  const [audit, adminUsers]: [AuditEntry[], AdminUser[]] = isSuper
    ? await Promise.all([getAudit(), listAdminUsers()])
    : [[], []];

  return (
    <AdminUIProvider>
      <AdminDashboard
        locale={lang}
        initialLeads={leads}
        events={events}
        role={role ?? "admin"}
        audit={audit}
        adminUsers={adminUsers}
        channels={notificationChannels()}
        allowedTabs={allowedTabs}
      />
    </AdminUIProvider>
  );
}
