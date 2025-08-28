'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminAuth } from '@/lib/adminAuth';
import { useAdminUsers } from '@/lib/useAdminData';
import { AdminUserProvider, useAdminUserContext } from '@/lib/adminUserContext';
import { UserSelector } from '@/components/admin/UserSelector';
import { Badge } from '@/components/ui/badge';
import SignOutButton from '@/components/SignOutButton';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  UserCog,
  Settings,
  Shield,
  User,
} from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPage?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredLevel: 'support' | 'moderator' | 'super';
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    requiredLevel: 'support',
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: Users,
    requiredLevel: 'moderator',
  },
  {
    name: 'Characters',
    href: '/admin/characters',
    icon: UserCog,
    requiredLevel: 'support',
  },
  {
    name: 'Chats',
    href: '/admin/chats',
    icon: MessageSquare,
    requiredLevel: 'support',
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: Settings,
    requiredLevel: 'super',
  },
];

function AdminLayoutContent({ children, currentPage }: AdminLayoutProps) {
  const pathname = usePathname();
  const { user, adminLevel } = useAdminAuth();
  const { users } = useAdminUsers();
  const { selectedUser } = useAdminUserContext();

  // Filter navigation items based on admin level
  const filteredNavigation = navigation.filter((item) => {
    if (!adminLevel) return false;
    
    const levels = { support: 1, moderator: 2, super: 3 };
    return levels[adminLevel] >= levels[item.requiredLevel];
  });

  // Show user selector on Characters and Chats pages
  const showUserSelector = pathname === '/admin/characters' || pathname === '/admin/chats';

  return (
    <div className="min-h-screen bg-background dark">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-card shadow-lg border-r border-border">
        <div className="flex h-full flex-col">
          {/* Logo/Header */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-border">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-primary" />
              <span className="ml-2 text-xl font-bold text-foreground">Admin</span>
            </div>
          </div>

          {/* User Info */}
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                <span className="text-sm font-medium text-primary-foreground">
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'A'}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-foreground">
                  {user?.displayName || 'Admin User'}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {adminLevel} Admin
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <item.icon
                    className={cn(
                      'mr-3 h-5 w-5 flex-shrink-0',
                      isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-accent-foreground'
                    )}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Sign Out */}
          <div className="px-4 py-4 border-t border-border">
            <SignOutButton className="w-full justify-start text-left" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        {/* Top Bar */}
        <div className="sticky top-0 z-40 bg-card shadow-sm border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-2xl font-bold text-foreground">
                  {currentPage || 'Admin Panel'}
                </h1>
                {selectedUser && (
                  <Badge variant="outline" className="flex items-center gap-2">
                    <User className="h-3 w-3" />
                    Viewing: {selectedUser.displayName || selectedUser.email}
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-4">
                {showUserSelector && (
                  <UserSelector users={users} />
                )}
                <span className="text-sm text-muted-foreground">
                  {user?.email}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminLayout({ children, currentPage }: AdminLayoutProps) {
  return (
    <AdminUserProvider>
      <AdminLayoutContent currentPage={currentPage}>
        {children}
      </AdminLayoutContent>
    </AdminUserProvider>
  );
}