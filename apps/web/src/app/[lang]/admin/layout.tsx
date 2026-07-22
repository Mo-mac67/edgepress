/**
 * The admin panel UI is English (LTR), so keep it left-to-right even when the
 * site's locale is right-to-left (e.g. /fa/admin) — the public site still
 * renders RTL via the [lang] layout's <html dir>.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div dir="ltr">{children}</div>;
}
