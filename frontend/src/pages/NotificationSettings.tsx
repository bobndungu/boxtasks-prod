import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  Mail,
  Save,
  Loader2,
  ArrowLeft,
  Settings,
  FileText,
  Eye,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import MainHeader from '../components/MainHeader';
import { useAuthStore } from '../lib/stores/auth';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_PREFERENCE_LABELS,
  type NotificationPreferences,
  type EmailDeliveryTiming,
} from '../lib/api/notifications';
import {
  isPushSupported,
  isPushSubscribed,
  subscribeToPush,
  unsubscribeFromPush,
  getNotificationPermission,
} from '../lib/api/push';
import {
  fetchEmailTemplates,
  updateEmailTemplate,
  resetEmailTemplate,
  previewEmailTemplate,
  EMAIL_TEMPLATE_LABELS,
  type EmailTemplate,
  type TemplatePreview,
} from '../lib/api/emailTemplates';

export default function NotificationSettings() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'preferences' | 'templates'>('preferences');

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifMessage, setNotifMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Email templates state
  const [templates, setTemplates] = useState<Record<string, EmailTemplate>>({});
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateMessage, setTemplateMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [expandedTokens, setExpandedTokens] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Check if user is admin
  const isAdmin = user?.roles?.includes('administrator') || user?.roles?.includes('admin');

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

  // Load email templates (admin only)
  useEffect(() => {
    if (isAdmin) {
      setTemplatesLoading(true);
      fetchEmailTemplates()
        .then((data) => {
          setTemplates(data.templates);
          setTokens(data.tokens);
        })
        .catch((err) => {
          console.error('Failed to load email templates:', err);
          setTemplateMessage({ type: 'error', text: 'Failed to load email templates' });
        })
        .finally(() => setTemplatesLoading(false));
    }
  }, [isAdmin]);

  // When selecting a template, populate the editor
  useEffect(() => {
    if (selectedTemplate && templates[selectedTemplate]) {
      setEditedSubject(templates[selectedTemplate].subject);
      setEditedBody(templates[selectedTemplate].body);
      setShowPreview(false);
      setPreview(null);
    }
  }, [selectedTemplate, templates]);

  const handleSaveNotifPrefs = async () => {
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
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    setTemplateSaving(true);
    setTemplateMessage(null);
    try {
      const updated = await updateEmailTemplate(selectedTemplate, {
        subject: editedSubject,
        body: editedBody,
      });
      setTemplates((prev) => ({
        ...prev,
        [selectedTemplate]: updated,
      }));
      setTemplateMessage({ type: 'success', text: 'Template saved!' });
      setTimeout(() => setTemplateMessage(null), 3000);
    } catch (error) {
      setTemplateMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save template',
      });
    } finally {
      setTemplateSaving(false);
    }
  };

  const handleResetTemplate = async () => {
    if (!selectedTemplate) return;
    if (!confirm('Reset this template to default? Your customizations will be lost.')) return;

    setTemplateSaving(true);
    setTemplateMessage(null);
    try {
      const reset = await resetEmailTemplate(selectedTemplate);
      setTemplates((prev) => ({
        ...prev,
        [selectedTemplate]: reset,
      }));
      setEditedSubject(reset.subject);
      setEditedBody(reset.body);
      setTemplateMessage({ type: 'success', text: 'Template reset to default!' });
      setTimeout(() => setTemplateMessage(null), 3000);
    } catch (error) {
      setTemplateMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to reset template',
      });
    } finally {
      setTemplateSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const previewData = await previewEmailTemplate({
        subject: editedSubject,
        body: editedBody,
      });
      setPreview(previewData);
      setShowPreview(true);
    } catch (error) {
      setTemplateMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to generate preview',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(`{{${token}}}`);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const insertToken = (token: string) => {
    const tokenText = `{{${token}}}`;
    // Insert at cursor position if textarea is focused, otherwise append
    const textarea = document.getElementById('template-body') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = editedBody.substring(0, start) + tokenText + editedBody.substring(end);
      setEditedBody(newBody);
      // Set cursor position after inserted token
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tokenText.length, start + tokenText.length);
      }, 0);
    } else {
      setEditedBody(editedBody + tokenText);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MainHeader />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            to="/notifications"
            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage how you receive notifications
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
          <button
            onClick={() => setActiveTab('preferences')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'preferences'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Settings className="h-4 w-4 inline mr-2" />
            Preferences
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'templates'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Email Templates
            </button>
          )}
        </div>

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Bell className="h-5 w-5 text-gray-400 dark:text-gray-500 mr-2" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notification Preferences</h2>
                </div>
                {notifMessage && (
                  <span
                    className={`text-sm ${
                      notifMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {notifMessage.text}
                  </span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* In-App Notifications */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Bell className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
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
                          className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded cursor-pointer bg-white dark:bg-gray-700"
                        />
                        <div className="ml-3">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                            {labels.label}
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{labels.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Email Notifications */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                  Email Notifications
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Choose which notifications to receive by email and when to receive them
                </p>
                <div className="space-y-4">
                  {(Object.keys(notifPrefs.email) as Array<keyof typeof notifPrefs.email>).map((key) => {
                    const labels = NOTIFICATION_PREFERENCE_LABELS[key];
                    if (!labels) return null;
                    const deliveryKey = key as keyof typeof notifPrefs.emailDelivery;
                    const hasDeliveryOption = deliveryKey in notifPrefs.emailDelivery;
                    return (
                      <div key={key} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <label className="flex items-start cursor-pointer group flex-1">
                          <input
                            type="checkbox"
                            checked={notifPrefs.email[key]}
                            onChange={(e) =>
                              setNotifPrefs({
                                ...notifPrefs,
                                email: { ...notifPrefs.email, [key]: e.target.checked },
                              })
                            }
                            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded cursor-pointer bg-white dark:bg-gray-700"
                          />
                          <div className="ml-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                              {labels.label}
                            </span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{labels.description}</p>
                          </div>
                        </label>
                        {hasDeliveryOption && notifPrefs.email[key] && (
                          <select
                            value={notifPrefs.emailDelivery[deliveryKey]}
                            onChange={(e) =>
                              setNotifPrefs({
                                ...notifPrefs,
                                emailDelivery: {
                                  ...notifPrefs.emailDelivery,
                                  [deliveryKey]: e.target.value as EmailDeliveryTiming,
                                },
                              })
                            }
                            className="ml-4 text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="immediate">Immediately</option>
                            <option value="digest">In digest</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Push Notifications */}
              {pushSupported && (
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center">
                    <Bell className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-400" />
                    Browser Push Notifications
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                    Receive instant notifications in your browser, even when BoxTasks is closed
                  </p>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {pushEnabled ? 'Push notifications are enabled' : 'Enable push notifications'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
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
                          ? 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500'
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
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Email Digest</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  For notifications set to "In digest", how often should we send you a summary?
                </p>
                <div className="flex flex-wrap gap-4">
                  {([
                    { value: 'none', label: 'Never (disable digest)' },
                    { value: 'hourly', label: 'Hourly' },
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                  ] as const).map((option) => (
                    <label key={option.value} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="emailDigest"
                        value={option.value}
                        checked={notifPrefs.emailDigest === option.value}
                        onChange={() => setNotifPrefs({ ...notifPrefs, emailDigest: option.value })}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 cursor-pointer bg-white dark:bg-gray-700"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{option.label}</span>
                    </label>
                  ))}
                </div>
                {notifPrefs.emailDigest === 'none' && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Note: Notifications set to "In digest" will not be sent if digest is disabled.
                  </p>
                )}
              </div>

              {/* Save Button */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleSaveNotifPrefs}
                  disabled={notifLoading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {notifLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Preferences
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Email Templates Tab (Admin Only) */}
        {activeTab === 'templates' && isAdmin && (
          <div className="space-y-6">
            {templatesLoading ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">Loading email templates...</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {/* Template List */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-medium text-gray-900 dark:text-white">Templates</h3>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {Object.entries(templates).map(([type, template]) => {
                      const labels = EMAIL_TEMPLATE_LABELS[type];
                      return (
                        <button
                          key={type}
                          onClick={() => setSelectedTemplate(type)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                            selectedTemplate === type ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className={`text-sm font-medium ${selectedTemplate === type ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                                {labels?.label || type}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {labels?.description || ''}
                              </p>
                            </div>
                            {template.is_custom && (
                              <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                                Customized
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Template Editor */}
                <div className="md:col-span-2 space-y-6">
                  {selectedTemplate ? (
                    <>
                      {/* Editor */}
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            Edit: {EMAIL_TEMPLATE_LABELS[selectedTemplate]?.label || selectedTemplate}
                          </h3>
                          {templateMessage && (
                            <span
                              className={`text-sm ${
                                templateMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {templateMessage.text}
                            </span>
                          )}
                        </div>
                        <div className="p-4 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Subject Line
                            </label>
                            <input
                              type="text"
                              value={editedSubject}
                              onChange={(e) => setEditedSubject(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              placeholder="Email subject..."
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Email Body
                            </label>
                            <textarea
                              id="template-body"
                              value={editedBody}
                              onChange={(e) => setEditedBody(e.target.value)}
                              rows={12}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                              placeholder="Email content..."
                            />
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex gap-2">
                              <button
                                onClick={handlePreview}
                                disabled={previewLoading}
                                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center"
                              >
                                {previewLoading ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                  <Eye className="h-4 w-4 mr-2" />
                                )}
                                Preview
                              </button>
                              {templates[selectedTemplate]?.is_custom && (
                                <button
                                  onClick={handleResetTemplate}
                                  disabled={templateSaving}
                                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center"
                                >
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Reset to Default
                                </button>
                              )}
                            </div>
                            <button
                              onClick={handleSaveTemplate}
                              disabled={templateSaving}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                              {templateSaving ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Save Template
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Preview */}
                      {showPreview && preview && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <h3 className="font-medium text-gray-900 dark:text-white">Preview (with sample data)</h3>
                            <button
                              onClick={() => setShowPreview(false)}
                              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                              <ChevronUp className="h-5 w-5" />
                            </button>
                          </div>
                          <div className="p-4">
                            <div className="mb-4">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Subject:</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{preview.subject}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Body:</p>
                              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {preview.body}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Token Reference */}
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                        <button
                          onClick={() => setExpandedTokens(!expandedTokens)}
                          className="w-full p-4 flex items-center justify-between text-left"
                        >
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            Available Tokens
                          </h3>
                          {expandedTokens ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </button>
                        {expandedTokens && (
                          <div className="px-4 pb-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                              Click a token to insert it into the email body, or click the copy icon to copy it.
                            </p>
                            <div className="grid gap-2">
                              {Object.entries(tokens).map(([token, description]) => (
                                <div
                                  key={token}
                                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg group"
                                >
                                  <div className="flex-1 min-w-0">
                                    <button
                                      onClick={() => insertToken(token)}
                                      className="text-sm font-mono text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                    >
                                      {`{{${token}}}`}
                                    </button>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                      {description}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => copyToken(token)}
                                    className="ml-2 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Copy token"
                                  >
                                    {copiedToken === token ? (
                                      <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
                      <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">
                        Select a template from the list to edit it
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
