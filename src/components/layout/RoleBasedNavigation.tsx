'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROLE_NAVIGATION, type Role } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { api } from '@/lib/trpc/client';
import { useAuth } from '@clerk/nextjs';
import {
  Calendar,
  Users,
  Settings,
  Bell,
  BarChart3,
  LayoutDashboard,
  ClipboardList,
  Shield
} from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  '/dashboard': LayoutDashboard,
  '/schedule': Calendar,
  '/team': Users,
  '/config': Settings,
  '/requests': ClipboardList,
  '/notifications': Bell,
  '/analytics': BarChart3,
  '/settings': Shield,
};

export function RoleBasedNavigation() {
  const pathname = usePathname();
  const { userId, orgId } = useAuth();
  const { data: currentUser } = api.tenant.users.current.useQuery(undefined, {
    enabled: !!userId && !!orgId,
  });

  if (!currentUser) {
    return null;
  }

  const navigation = ROLE_NAVIGATION[currentUser.role as Role] || [];

  return (
    <nav className="space-y-1">
      {navigation.map((item) => {
        const Icon = iconMap[item.href] || LayoutDashboard;
        const isActive = pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}