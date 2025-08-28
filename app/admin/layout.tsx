// app/admin/layout.tsx
import { AdminRouteGuard } from '@/components/admin/AdminRouteGuard';
import { AdminLayout } from '@/components/admin/AdminLayout';

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminRouteGuard requiredLevel="support" redirectTo="/">
      <AdminLayout>
        {children}
      </AdminLayout>
    </AdminRouteGuard>
  );
}