// app/admin/dashboard/page.tsx
'use client';

import { useAdminAuth } from '@/lib/adminAuth';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  MessageSquare,
  UserCog,
  Settings,
  RefreshCw,
  Database,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Flag,
  Zap
} from 'lucide-react';
import { useAdminCache } from '@/lib/useAdminData';
import { triggerMetadataSync, getSystemAnalytics, getAdminActionLogs } from '@/lib/admin';
import { testAdminOptimizations } from '@/lib/admin-test';
import { toast } from 'sonner';
import Link from 'next/link';
import { AuditTrail } from '@/components/admin/AuditTrail';

interface SystemAnalytics {
  totalUsers: number;
  activeUsers: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  totalCharacters: number;
  totalMessages: number;
  popularCharacters: Array<{
    characterId: string;
    name: string;
    messageCount: number;
    userCount: number;
  }>;
  usagePatterns: {
    peakHours: number[];
    dailyActivity: Array<{
      date: string;
      users: number;
      messages: number;
    }>;
  };
  flaggedContent: {
    characters: number;
    chats: number;
    users: number;
  };
  growth: {
    usersGrowth: number;
    messagesGrowth: number;
    charactersGrowth: number;
  };
}

interface AdminAction {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: 'user' | 'character' | 'chat';
  targetId: string;
  reason: string;
  timestamp: Date;
  details: Record<string, any>;
}

export default function AdminDashboard() {
  const { user, adminLevel } = useAdminAuth();
  const { cacheStatus, clearCaches, updateCacheStatus } = useAdminCache();
  const [syncing, setSyncing] = useState(false);
  const [analytics, setAnalytics] = useState<SystemAnalytics | null>(null);
  const [recentActions, setRecentActions] = useState<AdminAction[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  useEffect(() => {
    loadAnalytics();
    loadRecentActions();
  }, []);

  const loadAnalytics = async () => {
    try {
      const data = await getSystemAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const loadRecentActions = async () => {
    try {
      const actions = await getAdminActionLogs(10);
      setRecentActions(actions);
    } catch (error) {
      console.error('Error loading recent actions:', error);
    }
  };

  const handleClearCaches = () => {
    clearCaches();
    toast.success('All caches cleared');
  };

  const handleMetadataSync = async () => {
    setSyncing(true);
    try {
      const result = await triggerMetadataSync();
      toast.success(`Metadata sync completed: ${result.stats.usersUpdated} users updated`);
      updateCacheStatus();
      // Refresh analytics after sync
      loadAnalytics();
    } catch (error) {
      console.error('Metadata sync failed:', error);
      toast.error('Metadata sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleTestOptimizations = async () => {
    toast.info('Running admin optimization tests...');
    try {
      const results = await testAdminOptimizations();
      if (results.success) {
        toast.success(`Tests completed! Loaded ${results.results?.userCount || 0} users in ${results.results?.userLoadTime || 0}ms`);
      } else {
        toast.error(`Tests failed: ${results.error}`);
      }
    } catch (error) {
      console.error('Test failed:', error);
      toast.error('Test execution failed');
    }
  };

  const formatAge = (age: number) => {
    if (age < 60000) return `${Math.floor(age / 1000)}s ago`;
    if (age < 3600000) return `${Math.floor(age / 60000)}m ago`;
    return `${Math.floor(age / 3600000)}h ago`;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (growth < 0) return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Activity className="w-4 h-4 text-gray-600" />;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            System overview and analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadAnalytics}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics */}
          {analytics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                      <p className="text-2xl font-bold">{formatNumber(analytics.totalUsers)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {getGrowthIcon(analytics.growth.usersGrowth)}
                      <span className={`text-sm ${getGrowthColor(analytics.growth.usersGrowth)}`}>
                        {analytics.growth.usersGrowth > 0 ? '+' : ''}{analytics.growth.usersGrowth}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <Users className="w-8 h-8 text-primary opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Messages</p>
                      <p className="text-2xl font-bold">{formatNumber(analytics.totalMessages)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {getGrowthIcon(analytics.growth.messagesGrowth)}
                      <span className={`text-sm ${getGrowthColor(analytics.growth.messagesGrowth)}`}>
                        {analytics.growth.messagesGrowth > 0 ? '+' : ''}{analytics.growth.messagesGrowth}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <MessageSquare className="w-8 h-8 text-primary opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Characters</p>
                      <p className="text-2xl font-bold">{formatNumber(analytics.totalCharacters)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {getGrowthIcon(analytics.growth.charactersGrowth)}
                      <span className={`text-sm ${getGrowthColor(analytics.growth.charactersGrowth)}`}>
                        {analytics.growth.charactersGrowth > 0 ? '+' : ''}{analytics.growth.charactersGrowth}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <UserCog className="w-8 h-8 text-primary opacity-20" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Users</p>
                      <p className="text-2xl font-bold">{formatNumber(analytics.activeUsers.daily)}</p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Daily
                    </div>
                  </div>
                  <div className="mt-2">
                    <Activity className="w-8 h-8 text-primary opacity-20" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Active Users Breakdown */}
          {analytics && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Active Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{analytics.activeUsers.daily}</p>
                    <p className="text-sm text-blue-800">Daily Active</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{analytics.activeUsers.weekly}</p>
                    <p className="text-sm text-green-800">Weekly Active</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{analytics.activeUsers.monthly}</p>
                    <p className="text-sm text-purple-800">Monthly Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Popular Characters */}
          {analytics && analytics.popularCharacters.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Popular Characters
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.popularCharacters.slice(0, 5).map((character, index) => (
                    <div key={character.characterId} className="flex items-center justify-between p-3 bg-accent/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{character.name}</p>
                          <p className="text-sm text-muted-foreground">{character.userCount} users</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatNumber(character.messageCount)}</p>
                        <p className="text-sm text-muted-foreground">messages</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <>
              {/* Usage Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Daily Activity (Last 7 Days)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics.usagePatterns.dailyActivity.slice(-7).map((day, index) => (
                      <div key={day.date} className="flex items-center justify-between p-3 bg-accent/30 rounded-lg">
                        <div>
                          <p className="font-medium">{new Date(day.date).toLocaleDateString()}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' })}
                          </p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-lg font-bold text-blue-600">{day.users}</p>
                            <p className="text-xs text-muted-foreground">Users</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-green-600">{formatNumber(day.messages)}</p>
                            <p className="text-xs text-muted-foreground">Messages</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Peak Hours */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Peak Usage Hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                    {Array.from({ length: 24 }, (_, hour) => {
                      const usage = analytics.usagePatterns.peakHours[hour] || 0;
                      const maxUsage = Math.max(...analytics.usagePatterns.peakHours);
                      const intensity = maxUsage > 0 ? (usage / maxUsage) * 100 : 0;

                      return (
                        <div key={hour} className="text-center">
                          <div
                            className="w-full h-12 bg-primary rounded-sm mb-1 opacity-20"
                            style={{ opacity: Math.max(0.1, intensity / 100) }}
                          />
                          <p className="text-xs text-muted-foreground">{hour}h</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Flagged Content */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flag className="w-5 h-5" />
                    Content Moderation
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-600">{analytics.flaggedContent.users}</p>
                      <p className="text-sm text-red-800">Flagged Users</p>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{analytics.flaggedContent.characters}</p>
                      <p className="text-sm text-orange-800">Flagged Characters</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-600">{analytics.flaggedContent.chats}</p>
                      <p className="text-sm text-yellow-800">Flagged Chats</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-6">
          <AuditTrail limit={20} showFilters={false} />
        </TabsContent>

        {/* System Tab */}
        <TabsContent value="system" className="space-y-6">
          {/* Admin Info */}
          <Card>
            <CardHeader>
              <CardTitle>Admin Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-primary/10 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-muted-foreground">Admin Level</h3>
                  <p className="text-2xl font-bold text-primary capitalize">{adminLevel}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                  <p className="text-2xl font-bold text-green-600">Active</p>
                </div>
                <div className="bg-accent p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-muted-foreground">User</h3>
                  <p className="text-sm font-medium text-foreground">{user?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cache Status */}
          {cacheStatus && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Cache Status
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={updateCacheStatus}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClearCaches}>
                      Clear Caches
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMetadataSync}
                      disabled={syncing}
                    >
                      {syncing ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Database className="w-4 h-4 mr-2" />
                      )}
                      Sync Metadata
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {Object.entries(cacheStatus).map(([key, status]: [string, any]) => (
                    <div key={key} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium capitalize">{key}</h4>
                        {status.isValid ? (
                          <Badge variant="secondary" className="text-green-600">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Stale
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Count: {status.count}</div>
                        {status.lastFetch > 0 && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatAge(status.age)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/admin/users">
                  <div className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <Users className="w-5 h-5 text-primary" />
                      <h4 className="font-medium text-foreground">Manage Users</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">View and manage user accounts</p>
                  </div>
                </Link>
                <Link href="/admin/chats">
                  <div className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      <h4 className="font-medium text-foreground">Monitor Chats</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">Review chat conversations</p>
                  </div>
                </Link>
                <Link href="/admin/characters">
                  <div className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <UserCog className="w-5 h-5 text-primary" />
                      <h4 className="font-medium text-foreground">Character Oversight</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">Manage AI characters</p>
                  </div>
                </Link>
                <Link href="/admin/settings">
                  <div className="p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                    <div className="flex items-center gap-3 mb-2">
                      <Settings className="w-5 h-5 text-primary" />
                      <h4 className="font-medium text-foreground">System Settings</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">Configure admin settings</p>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* System Tests */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                System Tests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button variant="outline" onClick={handleTestOptimizations}>
                  <Activity className="w-4 h-4 mr-2" />
                  Test Performance
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}