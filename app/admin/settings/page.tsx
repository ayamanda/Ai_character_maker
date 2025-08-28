// app/admin/settings/page.tsx
'use client';

import { AdminRouteGuard } from '@/components/admin/AdminRouteGuard';
import { useAdminAuth } from '@/lib/adminAuth';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Shield, 

  Bell,  
  MessageSquare,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface SystemSettings {
  maintenance: {
    enabled: boolean;
    message: string;
    allowAdmins: boolean;
  };
  security: {
    maxLoginAttempts: number;
    sessionTimeout: number;
    requireMFA: boolean;
    allowedDomains: string[];
  };
  content: {
    autoModeration: boolean;
    flaggedContentThreshold: number;
    maxCharactersPerUser: number;
    maxMessagesPerDay: number;
  };
  notifications: {
    emailAlerts: boolean;
    adminEmail: string;
    alertThresholds: {
      newUsers: number;
      flaggedContent: number;
      systemErrors: number;
    };
  };
}

const defaultSettings: SystemSettings = {
  maintenance: {
    enabled: false,
    message: 'System is under maintenance. Please try again later.',
    allowAdmins: true,
  },
  security: {
    maxLoginAttempts: 5,
    sessionTimeout: 24,
    requireMFA: false,
    allowedDomains: [],
  },
  content: {
    autoModeration: true,
    flaggedContentThreshold: 3,
    maxCharactersPerUser: 10,
    maxMessagesPerDay: 1000,
  },
  notifications: {
    emailAlerts: true,
    adminEmail: '',
    alertThresholds: {
      newUsers: 50,
      flaggedContent: 10,
      systemErrors: 5,
    },
  },
};

export default function AdminSettings() {
  const { user, adminLevel } = useAdminAuth();
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settingsRef = doc(db, 'adminSettings', 'system');
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setSettings({ ...defaultSettings, ...data });
        setLastSaved(data.lastUpdated?.toDate() || null);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settingsRef = doc(db, 'adminSettings', 'system');
      await setDoc(settingsRef, {
        ...settings,
        lastUpdated: new Date(),
        updatedBy: user?.email,
      });
      
      setLastSaved(new Date());
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (path: string, value: any) => {
    const keys = path.split('.');
    const newSettings = { ...settings };
    let current: any = newSettings;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    setSettings(newSettings);
  };

  if (loading) {
    return (
      <AdminRouteGuard requiredLevel="super">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminRouteGuard>
    );
  }

  return (
    <AdminRouteGuard requiredLevel="super">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
            <p className="text-muted-foreground">
              Configure system-wide settings and policies
            </p>
          </div>
          <div className="flex items-center gap-4">
            {lastSaved && (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                Last saved: {lastSaved.toLocaleString()}
              </div>
            )}
            <Button onClick={saveSettings} disabled={saving}>
              {saving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        <Tabs defaultValue="maintenance" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="maintenance" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Maintenance
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
          </TabsList>

          {/* Maintenance Settings */}
          <TabsContent value="maintenance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Maintenance Mode
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="maintenance-enabled">Enable Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Temporarily disable access for regular users
                    </p>
                  </div>
                  <Switch
                    id="maintenance-enabled"
                    checked={settings.maintenance.enabled}
                    onCheckedChange={(checked) => updateSetting('maintenance.enabled', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maintenance-message">Maintenance Message</Label>
                  <Textarea
                    id="maintenance-message"
                    value={settings.maintenance.message}
                    onChange={(e) => updateSetting('maintenance.message', e.target.value)}
                    placeholder="Message to display to users during maintenance"
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="allow-admins">Allow Admin Access</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow administrators to access the system during maintenance
                    </p>
                  </div>
                  <Switch
                    id="allow-admins"
                    checked={settings.maintenance.allowAdmins}
                    onCheckedChange={(checked) => updateSetting('maintenance.allowAdmins', checked)}
                  />
                </div>

                {settings.maintenance.enabled && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-orange-800">
                      <AlertTriangle className="w-5 h-5" />
                      <span className="font-medium">Maintenance Mode Active</span>
                    </div>
                    <p className="text-sm text-orange-700 mt-1">
                      Regular users are currently unable to access the application.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="max-login-attempts">Max Login Attempts</Label>
                    <Input
                      id="max-login-attempts"
                      type="number"
                      value={settings.security.maxLoginAttempts}
                      onChange={(e) => updateSetting('security.maxLoginAttempts', parseInt(e.target.value))}
                      min="1"
                      max="10"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Session Timeout (hours)</Label>
                    <Input
                      id="session-timeout"
                      type="number"
                      value={settings.security.sessionTimeout}
                      onChange={(e) => updateSetting('security.sessionTimeout', parseInt(e.target.value))}
                      min="1"
                      max="168"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="require-mfa">Require Multi-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Require MFA for all admin accounts
                    </p>
                  </div>
                  <Switch
                    id="require-mfa"
                    checked={settings.security.requireMFA}
                    onCheckedChange={(checked) => updateSetting('security.requireMFA', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="allowed-domains">Allowed Email Domains</Label>
                  <Textarea
                    id="allowed-domains"
                    value={settings.security.allowedDomains.join('\n')}
                    onChange={(e) => updateSetting('security.allowedDomains', e.target.value.split('\n').filter(d => d.trim()))}
                    placeholder="example.com&#10;company.org"
                    rows={3}
                  />
                  <p className="text-sm text-muted-foreground">
                    One domain per line. Leave empty to allow all domains.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Settings */}
          <TabsContent value="content">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Content Moderation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="auto-moderation">Enable Auto-Moderation</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically flag potentially inappropriate content
                    </p>
                  </div>
                  <Switch
                    id="auto-moderation"
                    checked={settings.content.autoModeration}
                    onCheckedChange={(checked) => updateSetting('content.autoModeration', checked)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="flagged-threshold">Flagged Content Threshold</Label>
                    <Input
                      id="flagged-threshold"
                      type="number"
                      value={settings.content.flaggedContentThreshold}
                      onChange={(e) => updateSetting('content.flaggedContentThreshold', parseInt(e.target.value))}
                      min="1"
                      max="10"
                    />
                    <p className="text-sm text-muted-foreground">
                      Number of reports before content is automatically flagged
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-characters">Max Characters per User</Label>
                    <Input
                      id="max-characters"
                      type="number"
                      value={settings.content.maxCharactersPerUser}
                      onChange={(e) => updateSetting('content.maxCharactersPerUser', parseInt(e.target.value))}
                      min="1"
                      max="100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-messages">Max Messages per Day</Label>
                  <Input
                    id="max-messages"
                    type="number"
                    value={settings.content.maxMessagesPerDay}
                    onChange={(e) => updateSetting('content.maxMessagesPerDay', parseInt(e.target.value))}
                    min="10"
                    max="10000"
                  />
                  <p className="text-sm text-muted-foreground">
                    Daily message limit per user to prevent spam
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Settings */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Alert Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-alerts">Enable Email Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Send email notifications for important events
                    </p>
                  </div>
                  <Switch
                    id="email-alerts"
                    checked={settings.notifications.emailAlerts}
                    onCheckedChange={(checked) => updateSetting('notifications.emailAlerts', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-email">Admin Email Address</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={settings.notifications.adminEmail}
                    onChange={(e) => updateSetting('notifications.adminEmail', e.target.value)}
                    placeholder="admin@example.com"
                  />
                </div>

                <div className="space-y-4">
                  <Label>Alert Thresholds</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-users-threshold">New Users (daily)</Label>
                      <Input
                        id="new-users-threshold"
                        type="number"
                        value={settings.notifications.alertThresholds.newUsers}
                        onChange={(e) => updateSetting('notifications.alertThresholds.newUsers', parseInt(e.target.value))}
                        min="1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="flagged-content-threshold">Flagged Content</Label>
                      <Input
                        id="flagged-content-threshold"
                        type="number"
                        value={settings.notifications.alertThresholds.flaggedContent}
                        onChange={(e) => updateSetting('notifications.alertThresholds.flaggedContent', parseInt(e.target.value))}
                        min="1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="system-errors-threshold">System Errors</Label>
                      <Input
                        id="system-errors-threshold"
                        type="number"
                        value={settings.notifications.alertThresholds.systemErrors}
                        onChange={(e) => updateSetting('notifications.alertThresholds.systemErrors', parseInt(e.target.value))}
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminRouteGuard>
  );
}