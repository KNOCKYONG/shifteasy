'use client';

import { api } from '@/components/providers/trpc-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Calendar, Settings } from 'lucide-react';

export function TenantInfo() {
  const { data: tenant, isLoading: tenantLoading } = api.tenant.getCurrent.useQuery();
  const { data: stats, isLoading: statsLoading } = api.tenant.getStats.useQuery();

  if (tenantLoading || statsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tenant || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No organization data available</p>
        </CardContent>
      </Card>
    );
  }

  const planColors = {
    free: 'bg-gray-100 text-gray-800',
    pro: 'bg-blue-100 text-blue-800',
    enterprise: 'bg-purple-100 text-purple-800',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {tenant.name}
        </CardTitle>
        <CardDescription>
          Organization ID: {tenant.slug}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Plan</span>
          <Badge className={planColors[tenant.plan as keyof typeof planColors]}>
            {tenant.plan.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-sm">Users</span>
            </div>
            <p className="text-lg font-semibold">
              {stats.users}
              {stats.settings?.maxUsers && (
                <span className="text-sm text-muted-foreground">
                  {' '}/ {stats.settings.maxUsers}
                </span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Settings className="h-4 w-4" />
              <span className="text-sm">Departments</span>
            </div>
            <p className="text-lg font-semibold">
              {stats.departments}
              {stats.settings?.maxDepartments && (
                <span className="text-sm text-muted-foreground">
                  {' '}/ {stats.settings.maxDepartments}
                </span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Shift Types</span>
            </div>
            <p className="text-lg font-semibold">{stats.shiftTypes}</p>
          </div>
        </div>

        {tenant.settings && (
          <div className="pt-2 border-t space-y-2">
            <p className="text-xs text-muted-foreground">
              Timezone: {tenant.settings.timezone}
            </p>
            <p className="text-xs text-muted-foreground">
              Locale: {tenant.settings.locale}
            </p>
            {tenant.settings.signupEnabled !== undefined && (
              <p className="text-xs text-muted-foreground">
                Signup: {tenant.settings.signupEnabled ? 'Enabled' : 'Disabled'}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// UI Components (simplified versions - you should have these in your components/ui folder)
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col space-y-1.5 p-6">{children}</div>;
}

function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
}

function CardDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-6 pt-0 ${className}`}>{children}</div>;
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${className}`}>
      {children}
    </span>
  );
}