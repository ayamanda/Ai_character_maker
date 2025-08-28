'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AdminUser } from '@/types';

interface AdminUserContextType {
  selectedUser: AdminUser | null;
  setSelectedUser: (user: AdminUser | null) => void;
  clearSelectedUser: () => void;
}

const AdminUserContext = createContext<AdminUserContextType | undefined>(undefined);

export function AdminUserProvider({ children }: { children: ReactNode }) {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const clearSelectedUser = () => setSelectedUser(null);

  return (
    <AdminUserContext.Provider value={{
      selectedUser,
      setSelectedUser,
      clearSelectedUser
    }}>
      {children}
    </AdminUserContext.Provider>
  );
}

export function useAdminUserContext() {
  const context = useContext(AdminUserContext);
  if (context === undefined) {
    throw new Error('useAdminUserContext must be used within an AdminUserProvider');
  }
  return context;
}