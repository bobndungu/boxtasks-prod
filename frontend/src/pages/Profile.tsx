import { useState, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Layout,
  ArrowLeft,
  User,
  Mail,
  Briefcase,
  FileText,
  Globe,
  Save,
  Loader2,
  Camera,
  Bell,
  MailIcon,
  AtSign,
} from 'lucide-react';
import { useAuthStore, type User as UserType } from '../lib/stores/auth';
import { getAccessToken } from '../lib/api/client';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCE_LABELS,
  type NotificationPreferences,
} from '../lib/api/notifications';
import {
  isPushSupported,
  isPushSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
  getNotificationPermission,
} from '../lib/api/push';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
];

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    email: user?.email || '',
    jobTitle: user?.jobTitle || '',
    mentionHandle: user?.mentionHandle || '',
    bio: user?.bio || '',
    timezone: user?.timezone || 'UTC',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifMessage, setNotifMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Load notification preferences
  useEffect(() => {
    if (user?.id) {
      fetchNotificationPreferences(user.id)
        .then(setNotifPrefs)
        .catch(console.error);
    }
  }, [user?.id]);

  // Check push notification status
  useEffect(() => {
    setPushSupported(isPushSupported());
    isPushSubscribed().then(setPushEnabled);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const token = getAccessToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site'}/jsonapi/user/user/${user?.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/vnd.api+json',
            'Accept': 'application/vnd.api+json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            data: {
              type: 'user--user',
              id: user?.id,
              attributes: {
                field_display_name: formData.displayName,
                field_job_title: formData.jobTitle,
                field_mention_handle: formData.mentionHandle,
                field_bio: { value: formData.bio },
                field_timezone: formData.timezone,
              },
            },
          }),
        }
      );

      if (response.ok) {
        // Update local user state
        const updatedUser: UserType = {
          ...user!,
          displayName: formData.displayName,
          jobTitle: formData.jobTitle,
          mentionHandle: formData.mentionHandle,
          bio: formData.bio,
          timezone: formData.timezone,
        };
        setUser(updatedUser);
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        const data = await response.json();
        setMessage({
          type: 'error',
          text: data.errors?.[0]?.detail || 'Failed to update profile',
        });
      }
    } catch {
      setMessage({ type: 'error', text: 'Unable to connect to server' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center h-16">
            <Link to="/dashboard" className="flex items-center space-x-2 mr-8">
              <Layout className="h-7 w-7 text-blue-600" />
              <span className="text-xl font-bold text-gray-900">BoxTasks</span>
            </Link>
            <div className="flex items-center text-gray-500">
              <Link to="/dashboard" className="hover:text-gray-700">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <span className="mx-4">/</span>
              <span className="font-medium text-gray-900">Profile Settings</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Profile Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {formData.displayName?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <button className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 shadow-md border border-gray-200 hover:bg-gray-50">
                  <Camera className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {formData.displayName || user?.username}
                </h1>
                <p className="text-gray-500">@{user?.username}</p>
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {message && (
              <div
                className={`px-4 py-3 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-600'
                    : 'bg-red-50 border border-red-200 text-red-600'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                  <User className="h-4 w-4 mr-2 text-gray-400" />
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="Your display name"
                />
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                  <Mail className="h-4 w-4 mr-2 text-gray-400" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed here</p>
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                  <Briefcase className="h-4 w-4 mr-2 text-gray-400" />
                  Job Title
                </label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                  placeholder="e.g. Product Manager"
                />
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                  <AtSign className="h-4 w-4 mr-2 text-gray-400" />
                  @Mention Handle
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
                  <input
                    type="text"
                    value={formData.mentionHandle}
                    onChange={(e) => setFormData({ ...formData, mentionHandle: e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() })}
                    className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    placeholder="your_handle"
                    maxLength={30}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Used for @mentions in cards. Letters, numbers, and underscores only.</p>
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                  <Globe className="h-4 w-4 mr-2 text-gray-400" />
                  Timezone
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                <FileText className="h-4 w-4 mr-2 text-gray-400" />
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors resize-none"
                placeholder="Tell us a bit about yourself..."
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Notification Preferences */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bell className="h-5 w-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
              </div>
              {notifMessage && (
                <span
                  className={`text-sm ${
                    notifMessage.type === 'success' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {notifMessage.text}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Control how you receive notifications
            </p>
          </div>

          <div className="p-6 space-y-8">
            {/* In-App Notifications */}
            <div>
              <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                <Bell className="h-4 w-4 mr-2 text-blue-600" />
                In-App Notifications
              </h3>
              <div className="space-y-3">
                {(Object.keys(notifPrefs.inApp) as Array<keyof typeof notifPrefs.inApp>).map((key) => {
                  const labels = NOTIFICATION_PREFERENCE_LABELS[key];
                  if (!labels) return null;
                  return (
                    <label key={key} className="flex items-start cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={notifPrefs.inApp[key]}
                        onChange={(e) =>
                          setNotifPrefs({
                            ...notifPrefs,
                            inApp: { ...notifPrefs.inApp, [key]: e.target.checked },
                          })
                        }
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      />
                      <div className="ml-3">
                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                          {labels.label}
                        </span>
                        <p className="text-xs text-gray-500">{labels.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Email Notifications */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                <MailIcon className="h-4 w-4 mr-2 text-blue-600" />
                Email Notifications
              </h3>
              <div className="space-y-3">
                {(Object.keys(notifPrefs.email) as Array<keyof typeof notifPrefs.email>).map((key) => {
                  const labels = NOTIFICATION_PREFERENCE_LABELS[key];
                  if (!labels) return null;
                  return (
                    <label key={key} className="flex items-start cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={notifPrefs.email[key]}
                        onChange={(e) =>
                          setNotifPrefs({
                            ...notifPrefs,
                            email: { ...notifPrefs.email, [key]: e.target.checked },
                          })
                        }
                        className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                      />
                      <div className="ml-3">
                        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                          {labels.label}
                        </span>
                        <p className="text-xs text-gray-500">{labels.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Push Notifications */}
            {pushSupported && (
              <div className="pt-6 border-t border-gray-200">
                <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                  <Bell className="h-4 w-4 mr-2 text-purple-600" />
                  Browser Push Notifications
                </h3>
                <p className="text-sm text-gray-500 mb-3">
                  Receive instant notifications in your browser, even when BoxTasks is closed
                </p>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {pushEnabled ? 'Push notifications are enabled' : 'Enable push notifications'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {getNotificationPermission() === 'denied'
                        ? 'Permission denied - please enable in browser settings'
                        : pushEnabled
                        ? 'You will receive notifications for important events'
                        : 'Get notified instantly when something happens'}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!user?.id) return;
                      setPushLoading(true);
                      try {
                        if (pushEnabled) {
                          await unsubscribeFromPush(user.id);
                          setPushEnabled(false);
                        } else {
                          const subscription = await subscribeToPush(user.id);
                          setPushEnabled(!!subscription);
                        }
                      } catch (error) {
                        console.error('Push subscription error:', error);
                      } finally {
                        setPushLoading(false);
                      }
                    }}
                    disabled={pushLoading || getNotificationPermission() === 'denied'}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center ${
                      pushEnabled
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-purple-600 text-white hover:bg-purple-700'
                    }`}
                  >
                    {pushLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : pushEnabled ? (
                      'Disable'
                    ) : (
                      'Enable'
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Email Digest */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-4">Email Digest</h3>
              <p className="text-sm text-gray-500 mb-3">
                Receive a summary of activity instead of individual emails
              </p>
              <div className="flex space-x-4">
                {(['none', 'daily', 'weekly'] as const).map((option) => (
                  <label key={option} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="emailDigest"
                      value={option}
                      checked={notifPrefs.emailDigest === option}
                      onChange={() => setNotifPrefs({ ...notifPrefs, emailDigest: option })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 cursor-pointer"
                    />
                    <span className="ml-2 text-sm text-gray-700 capitalize">{option}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-6 border-t border-gray-200">
              <button
                onClick={async () => {
                  if (!user?.id) return;
                  setNotifLoading(true);
                  setNotifMessage(null);
                  try {
                    await updateNotificationPreferences(user.id, notifPrefs);
                    setNotifMessage({ type: 'success', text: 'Preferences saved!' });
                    setTimeout(() => setNotifMessage(null), 3000);
                  } catch (error) {
                    setNotifMessage({
                      type: 'error',
                      text: error instanceof Error ? error.message : 'Failed to save preferences',
                    });
                  } finally {
                    setNotifLoading(false);
                  }
                }}
                disabled={notifLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {notifLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Notification Preferences
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Danger Zone</h2>
            <p className="text-sm text-gray-500 mb-4">
              Permanently delete your account and all associated data.
            </p>
            <button className="text-red-600 hover:text-red-700 font-medium text-sm border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
