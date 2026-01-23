import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Mail,
  Briefcase,
  FileText,
  Globe,
  Save,
  Loader2,
  Camera,
  Bell,
  AtSign,
  ChevronRight,
} from 'lucide-react';
import MainHeader from '../components/MainHeader';
import { useAuthStore, type User as UserType } from '../lib/stores/auth';
import { useWorkspaceStore } from '../lib/stores/workspace';
import { usePermissions } from '../lib/hooks/usePermissions';
import { getAccessToken } from '../lib/api/client';

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
  'Africa/Nairobi',
];

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { canProfile } = usePermissions(currentWorkspace?.id);
  const canEditProfile = canProfile('edit', true);
  const canDeleteProfile = canProfile('delete', true);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Header */}
      <MainHeader />

      {/* Page Title */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Profile Settings</h1>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          {/* Profile Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {formData.displayName?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <button className="absolute bottom-0 right-0 bg-white dark:bg-gray-700 rounded-full p-1.5 shadow-md border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <Camera className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {formData.displayName || user?.username}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">@{user?.username}</p>
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {message && (
              <div
                className={`px-4 py-3 rounded-lg text-sm ${
                  message.type === 'success'
                    ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <User className="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" />
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  disabled={!canEditProfile}
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-colors ${canEditProfile ? 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-not-allowed'} placeholder:text-gray-400 dark:placeholder:text-gray-500`}
                  placeholder="Your display name"
                />
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Mail className="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Email cannot be changed here</p>
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Briefcase className="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" />
                  Job Title
                </label>
                <input
                  type="text"
                  value={formData.jobTitle}
                  onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                  disabled={!canEditProfile}
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-colors ${canEditProfile ? 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-not-allowed'} placeholder:text-gray-400 dark:placeholder:text-gray-500`}
                  placeholder="e.g. Product Manager"
                />
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <AtSign className="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" />
                  @Mention Handle
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">@</span>
                  <input
                    type="text"
                    value={formData.mentionHandle}
                    onChange={(e) => setFormData({ ...formData, mentionHandle: e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() })}
                    disabled={!canEditProfile}
                    className={`w-full pl-8 pr-4 py-2.5 border rounded-lg outline-none transition-colors ${canEditProfile ? 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-not-allowed'} placeholder:text-gray-400 dark:placeholder:text-gray-500`}
                    placeholder="your_handle"
                    maxLength={30}
                  />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Used for @mentions in cards. Letters, numbers, and underscores only.</p>
              </div>

              <div>
                <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Globe className="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" />
                  Timezone
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  disabled={!canEditProfile}
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-colors ${canEditProfile ? 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-not-allowed'}`}
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
              <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <FileText className="h-4 w-4 mr-2 text-gray-400 dark:text-gray-500" />
                Bio
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                disabled={!canEditProfile}
                rows={4}
                className={`w-full px-4 py-2.5 border rounded-lg outline-none transition-colors resize-none ${canEditProfile ? 'border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-not-allowed'} placeholder:text-gray-400 dark:placeholder:text-gray-500`}
                placeholder="Tell us a bit about yourself..."
              />
            </div>

            {canEditProfile && (
              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
            )}
          </form>
        </div>

        {/* Notification Settings Link */}
        <Link
          to="/notifications/settings"
          className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors block"
        >
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-4">
              <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Settings</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage in-app, email, and push notification preferences
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </Link>

        {/* Danger Zone */}
        {canDeleteProfile && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Danger Zone</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Permanently delete your account and all associated data.
              </p>
              <button className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-medium text-sm border border-red-200 dark:border-red-800 px-4 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                Delete Account
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
