'use client';

import { useState, useEffect } from 'react';
import { AdminDashboard } from '@/components/dashboard/AdminDashboard';
import { MemberDashboard } from '@/components/dashboard/MemberDashboard';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function DashboardClient() {
  const [mounted, setMounted] = useState(false);
  const currentUser = useCurrentUser();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Avoid SSR/CSR mismatch by rendering nothing until mounted
    return null;
  }

  // Show member dashboard for members
  if (currentUser.role === 'member') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="container mx-auto px-4 py-8">
          <MemberDashboard />
        </div>
      </div>
    );
  }

  // Show admin dashboard for managers and admins
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-8">
        <AdminDashboard />
      </div>
    </div>
  );
}
