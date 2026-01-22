import React, { useState, useEffect } from 'react';
import { useConfirmDialog } from '../lib/hooks/useConfirmDialog';
import { Select } from './ui/select';
import {
  Zap,
  Plus,
  Trash2,
  Edit,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertCircle,
  CheckCircle,
  X,
  Play,
} from 'lucide-react';
import type {
  AutomationRule,
  AutomationCondition,
  AutomationAction,
  AutomationLog,
} from '../lib/api/automations';
import {
  TRIGGER_TYPES,
  CONDITION_TYPES,
  ACTION_TYPES,
  DUE_DATE_OPERATORS,
  RELATIVE_TIME_UNITS,
  getAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  toggleAutomationRule,
  getAutomationLogs,
} from '../lib/api/automations';
import { formatDateTime } from '../lib/utils/date';

interface AutomationRulesProps {
  boardUuid: string;
  lists: Array<{ id: string; name: string }>;
  labels: Array<{ id: string; name: string; color: string }>;
  members: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  clients?: Array<{ id: string; name: string }>;
  customFields?: Array<{ id: string; title: string; type: string; options?: string[] }>;
  onClose?: () => void;
}

export function AutomationRules({
  boardUuid,
  lists,
  labels,
  members,
  departments = [],
  clients = [],
  customFields = [],
  onClose,
}: AutomationRulesProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');

  useEffect(() => {
    loadRules();
    loadLogs();
  }, [boardUuid]);

  async function loadRules() {
    try {
      setLoading(true);
      const data = await getAutomationRules(boardUuid);
      setRules(data);
      setError(null);
    } catch (err) {
      setError('Failed to load automation rules');
      console.error('Error loading rules:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    try {
      const data = await getAutomationLogs(boardUuid, { limit: 50 });
      setLogs(data);
    } catch (err) {
      console.error('Error loading logs:', err);
    }
  }

  async function handleToggleRule(rule: AutomationRule) {
    try {
      const updated = await toggleAutomationRule(rule.id, !rule.enabled);
      setRules(rules.map(r => r.id === rule.id ? updated : r));
    } catch {
      setError('Failed to toggle rule');
    }
  }

  async function handleDeleteRule(rule: AutomationRule) {
    const confirmed = await confirm({
      title: 'Delete Automation Rule',
      message: `Are you sure you want to delete the automation rule "${rule.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteAutomationRule(rule.id);
      setRules(rules.filter(r => r.id !== rule.id));
    } catch {
      setError('Failed to delete rule');
    }
  }

  function handleEditRule(rule: AutomationRule) {
    setEditingRule(rule);
    setShowEditor(true);
  }

  function handleCreateRule() {
    setEditingRule(null);
    setShowEditor(true);
  }

  async function handleSaveRule(ruleData: {
    name: string;
    triggerType: string;
    triggerConfig: Record<string, unknown>;
    conditions: AutomationCondition[];
    actions: AutomationAction[];
  }) {
    try {
      if (editingRule) {
        const updated = await updateAutomationRule(editingRule.id, ruleData);
        setRules(rules.map(r => r.id === editingRule.id ? updated : r));
      } else {
        const created = await createAutomationRule(boardUuid, ruleData);
        setRules([created, ...rules]);
      }
      setShowEditor(false);
      setEditingRule(null);
    } catch {
      setError('Failed to save rule');
    }
  }

  function toggleExpanded(ruleId: string) {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  }

  function getTriggerLabel(type: string): string {
    return TRIGGER_TYPES.find(t => t.id === type)?.label || type;
  }

  function getActionLabel(type: string): string {
    return ACTION_TYPES.find(a => a.id === type)?.label || type;
  }

  if (showEditor) {
    return (
      <RuleEditor
        rule={editingRule}
        lists={lists}
        labels={labels}
        members={members}
        departments={departments}
        clients={clients}
        customFields={customFields}
        onSave={handleSaveRule}
        onCancel={() => {
          setShowEditor(false);
          setEditingRule(null);
        }}
      />
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-semibold dark:text-gray-100">Automation Rules</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateRule}
            className="px-3 py-1.5 bg-blue-500 text-white hover:bg-blue-600 rounded-md text-sm flex items-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Rule
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b dark:border-gray-700">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'rules'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('rules')}
        >
          Rules ({rules.length})
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'logs'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('logs')}
        >
          Activity Log
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : activeTab === 'rules' ? (
          <RulesList
            rules={rules}
            expandedRules={expandedRules}
            onToggleExpanded={toggleExpanded}
            onToggleRule={handleToggleRule}
            onEditRule={handleEditRule}
            onDeleteRule={handleDeleteRule}
            getTriggerLabel={getTriggerLabel}
            getActionLabel={getActionLabel}
          />
        ) : (
          <LogsList logs={logs} getTriggerLabel={getTriggerLabel} />
        )}
      </div>
      <ConfirmDialog />
    </div>
  );
}

interface RulesListProps {
  rules: AutomationRule[];
  expandedRules: Set<string>;
  onToggleExpanded: (id: string) => void;
  onToggleRule: (rule: AutomationRule) => void;
  onEditRule: (rule: AutomationRule) => void;
  onDeleteRule: (rule: AutomationRule) => void;
  getTriggerLabel: (type: string) => string;
  getActionLabel: (type: string) => string;
}

function RulesList({
  rules,
  expandedRules,
  onToggleExpanded,
  onToggleRule,
  onEditRule,
  onDeleteRule,
  getTriggerLabel,
  getActionLabel,
}: RulesListProps) {
  if (rules.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Zap className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="font-medium">No automation rules yet</p>
        <p className="text-sm">Create your first rule to automate tasks</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rules.map(rule => (
        <div
          key={rule.id}
          className={`border rounded-lg ${rule.enabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50'}`}
        >
          {/* Rule Header */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={() => onToggleExpanded(rule.id)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-gray-300"
              >
                {expandedRules.has(rule.id) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${!rule.enabled ? 'text-gray-400 dark:text-gray-500' : 'dark:text-gray-100'}`}>
                    {rule.name}
                  </span>
                  {!rule.enabled && (
                    <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">
                      Disabled
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  When: {getTriggerLabel(rule.triggerType)}
                  {rule.actions.length > 0 && (
                    <span> → {getActionLabel(rule.actions[0].type)}</span>
                  )}
                  {rule.actions.length > 1 && (
                    <span> +{rule.actions.length - 1} more</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onToggleRule(rule)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title={rule.enabled ? 'Disable' : 'Enable'}
              >
                {rule.enabled ? (
                  <ToggleRight className="w-5 h-5 text-green-500" />
                ) : (
                  <ToggleLeft className="w-5 h-5 text-gray-400" />
                )}
              </button>
              <button
                onClick={() => onEditRule(rule)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Edit"
              >
                <Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </button>
              <button
                onClick={() => onDeleteRule(rule)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>

          {/* Expanded Details */}
          {expandedRules.has(rule.id) && (
            <div className="px-4 pb-3 pt-0 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">Trigger:</span>
                  <p className="dark:text-gray-200">{getTriggerLabel(rule.triggerType)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">Executions:</span>
                  <p className="dark:text-gray-200">{rule.executionCount} times</p>
                </div>
                {rule.conditions.length > 0 && (
                  <div className="col-span-2">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Conditions:</span>
                    <ul className="list-disc list-inside mt-1 dark:text-gray-200">
                      {rule.conditions.map((c, i) => (
                        <li key={i}>
                          {CONDITION_TYPES.find(ct => ct.id === c.type)?.label || c.type}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Actions:</span>
                  <ul className="list-disc list-inside mt-1 dark:text-gray-200">
                    {rule.actions.map((a, i) => (
                      <li key={i}>{getActionLabel(a.type)}</li>
                    ))}
                  </ul>
                </div>
                {rule.lastExecuted && (
                  <div className="col-span-2 text-gray-500 dark:text-gray-400">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Last run: {formatDateTime(rule.lastExecuted)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface LogsListProps {
  logs: AutomationLog[];
  getTriggerLabel: (type: string) => string;
}

function LogsList({ logs, getTriggerLabel }: LogsListProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="font-medium">No activity yet</p>
        <p className="text-sm">Rule executions will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div
          key={log.id}
          className={`p-3 rounded-lg border ${
            log.status === 'success'
              ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30'
              : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {log.status === 'success' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="font-medium dark:text-gray-100">
                {getTriggerLabel(log.triggerType)}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDateTime(log.createdAt)}
            </span>
          </div>
          {log.status === 'error' && log.errorMessage && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{log.errorMessage}</p>
          )}
          {log.actionsExecuted.length > 0 && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Actions: {log.actionsExecuted.map(a => a.type).join(', ')}
            </div>
          )}
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Execution time: {log.executionTime}ms
          </div>
        </div>
      ))}
    </div>
  );
}

interface RuleEditorProps {
  rule: AutomationRule | null;
  lists: Array<{ id: string; name: string }>;
  labels: Array<{ id: string; name: string; color: string }>;
  members: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
  customFields: Array<{ id: string; title: string; type: string; options?: string[] }>;
  onSave: (rule: {
    name: string;
    triggerType: string;
    triggerConfig: Record<string, unknown>;
    conditions: AutomationCondition[];
    actions: AutomationAction[];
  }) => void;
  onCancel: () => void;
}

function RuleEditor({ rule, lists, labels, members, departments, clients, customFields, onSave, onCancel }: RuleEditorProps) {
  const [name, setName] = useState(rule?.name || '');
  const [triggerType, setTriggerType] = useState(rule?.triggerType || 'card_created');
  const triggerConfig = rule?.triggerConfig || {};
  const [conditions, setConditions] = useState<AutomationCondition[]>(
    rule?.conditions || []
  );
  const [actions, setActions] = useState<AutomationAction[]>(
    rule?.actions || [{ type: 'move_card', config: {} }]
  );
  const [errors, setErrors] = useState<string[]>([]);

  function addCondition() {
    setConditions([...conditions, { type: 'card_has_label', config: {} }]);
  }

  function removeCondition(index: number) {
    setConditions(conditions.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, updates: Partial<AutomationCondition>) {
    setConditions(
      conditions.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  }

  function addAction() {
    setActions([...actions, { type: 'move_card', config: {} }]);
  }

  function removeAction(index: number) {
    if (actions.length <= 1) return;
    setActions(actions.filter((_, i) => i !== index));
  }

  function updateAction(index: number, updates: Partial<AutomationAction>) {
    setActions(actions.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: string[] = [];
    if (!name.trim()) newErrors.push('Rule name is required');
    if (actions.length === 0) newErrors.push('At least one action is required');

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: name.trim(),
      triggerType,
      triggerConfig,
      conditions,
      actions,
    });
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <h2 className="text-lg font-semibold dark:text-gray-100">
          {rule ? 'Edit Automation Rule' : 'Create Automation Rule'}
        </h2>
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-gray-300">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-6">
        {errors.length > 0 && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg">
            <ul className="list-disc list-inside">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Rule Name */}
        <div>
          <label className="block font-medium mb-1 dark:text-gray-100">Rule Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Move completed cards to Done"
            className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Trigger */}
        <div>
          <label className="block font-medium mb-1 dark:text-gray-100">
            <Play className="w-4 h-4 inline mr-1" />
            When this happens...
          </label>
          <Select
            value={triggerType}
            onChange={e => setTriggerType(e.target.value)}
            options={TRIGGER_TYPES.map(t => ({
              value: t.id,
              label: `${t.label} - ${t.description}`,
            }))}
          />
        </div>

        {/* Conditions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-medium dark:text-gray-100">
              Conditions (optional)
            </label>
            <button
              type="button"
              onClick={addCondition}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md text-sm flex items-center dark:text-gray-200"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Condition
            </button>
          </div>
          {conditions.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No conditions - rule will run on every trigger
            </p>
          ) : (
            <div className="space-y-2">
              {conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <Select
                      value={condition.type}
                      onChange={e =>
                        updateCondition(index, { type: e.target.value, config: {} })
                      }
                      size="sm"
                      options={CONDITION_TYPES.map(c => ({
                        value: c.id,
                        label: c.label,
                      }))}
                    />
                  </div>

                  {/* Condition config based on type */}
                  {condition.type === 'card_has_label' && (
                    <div className="flex-1">
                      <Select
                        value={(condition.config.label as string) || ''}
                        onChange={e =>
                          updateCondition(index, {
                            config: { ...condition.config, label: e.target.value },
                          })
                        }
                        size="sm"
                        placeholder="Select label..."
                        options={labels.map(l => ({
                          value: l.name,
                          label: l.name,
                        }))}
                      />
                    </div>
                  )}

                  {condition.type === 'card_in_list' && (
                    <div className="flex-1">
                      <Select
                        value={(condition.config.list_id as string) || ''}
                        onChange={e =>
                          updateCondition(index, {
                            config: { ...condition.config, list_id: e.target.value },
                          })
                        }
                        size="sm"
                        placeholder="Select list..."
                        options={lists.map(l => ({
                          value: l.id,
                          label: l.name,
                        }))}
                      />
                    </div>
                  )}

                  {condition.type === 'card_title_contains' && (
                    <input
                      type="text"
                      value={(condition.config.text as string) || ''}
                      onChange={e =>
                        updateCondition(index, {
                          config: { ...condition.config, text: e.target.value },
                        })
                      }
                      placeholder="Text to match..."
                      className="flex-1 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                    />
                  )}

                  {(condition.type === 'card_has_watcher' || condition.type === 'card_has_member' || condition.type === 'card_approved_by') && (
                    <div className="flex-1">
                      <Select
                        value={(condition.config.user_id as string) || ''}
                        onChange={e =>
                          updateCondition(index, {
                            config: { ...condition.config, user_id: e.target.value },
                          })
                        }
                        size="sm"
                        options={[
                          { value: '', label: 'Any user (or select specific)' },
                          ...members.map(m => ({
                            value: m.id,
                            label: m.name,
                          })),
                        ]}
                      />
                    </div>
                  )}

                  {condition.type === 'card_has_department' && (
                    <div className="flex-1">
                      <Select
                        value={(condition.config.department_id as string) || ''}
                        onChange={e =>
                          updateCondition(index, {
                            config: { ...condition.config, department_id: e.target.value },
                          })
                        }
                        size="sm"
                        placeholder="Select department..."
                        options={departments.map(d => ({
                          value: d.id,
                          label: d.name,
                        }))}
                      />
                    </div>
                  )}

                  {condition.type === 'card_has_client' && (
                    <div className="flex-1">
                      <Select
                        value={(condition.config.client_id as string) || ''}
                        onChange={e =>
                          updateCondition(index, {
                            config: { ...condition.config, client_id: e.target.value },
                          })
                        }
                        size="sm"
                        placeholder="Select client..."
                        options={clients.map(c => ({
                          value: c.id,
                          label: c.name,
                        }))}
                      />
                    </div>
                  )}

                  {condition.type === 'custom_field_equals' && (
                    <div className="flex-1 flex gap-2">
                      <Select
                        value={(condition.config.field_id as string) || ''}
                        onChange={e =>
                          updateCondition(index, {
                            config: { ...condition.config, field_id: e.target.value, value: '' },
                          })
                        }
                        size="sm"
                        placeholder="Select field..."
                        options={customFields.map(f => ({
                          value: f.id,
                          label: f.title,
                        }))}
                      />
                      {Boolean(condition.config.field_id) && customFields.find(f => f.id === condition.config.field_id)?.type === 'dropdown' && (
                        <Select
                          value={(condition.config.value as string) || ''}
                          onChange={e =>
                            updateCondition(index, {
                              config: { ...condition.config, value: e.target.value },
                            })
                          }
                          size="sm"
                          placeholder="Select value..."
                          options={(customFields.find(f => f.id === condition.config.field_id)?.options || []).map(opt => ({
                            value: opt,
                            label: opt,
                          }))}
                        />
                      )}
                      {Boolean(condition.config.field_id) && customFields.find(f => f.id === condition.config.field_id)?.type === 'checkbox' && (
                        <Select
                          value={(condition.config.value as string) || ''}
                          onChange={e =>
                            updateCondition(index, {
                              config: { ...condition.config, value: e.target.value },
                            })
                          }
                          size="sm"
                          options={[
                            { value: 'true', label: 'Checked' },
                            { value: 'false', label: 'Unchecked' },
                          ]}
                        />
                      )}
                      {Boolean(condition.config.field_id) && !['dropdown', 'checkbox'].includes(customFields.find(f => f.id === condition.config.field_id)?.type || '') && (
                        <input
                          type={customFields.find(f => f.id === condition.config.field_id)?.type === 'number' ? 'number' : 'text'}
                          value={(condition.config.value as string) || ''}
                          onChange={e =>
                            updateCondition(index, {
                              config: { ...condition.config, value: e.target.value },
                            })
                          }
                          placeholder="Value..."
                          className="flex-1 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                        />
                      )}
                    </div>
                  )}

                  {condition.type === 'custom_field_not_empty' && (
                    <div className="flex-1">
                      <Select
                        value={(condition.config.field_id as string) || ''}
                        onChange={e =>
                          updateCondition(index, {
                            config: { ...condition.config, field_id: e.target.value },
                          })
                        }
                        size="sm"
                        placeholder="Select field..."
                        options={customFields.map(f => ({
                          value: f.id,
                          label: f.title,
                        }))}
                      />
                    </div>
                  )}

                  {condition.type === 'card_has_due_date' && (
                    <div className="flex-1 flex gap-2 flex-wrap">
                      <Select
                        value={(condition.config.operator as string) || 'is_set'}
                        onChange={e =>
                          updateCondition(index, {
                            config: { ...condition.config, operator: e.target.value },
                          })
                        }
                        size="sm"
                        options={DUE_DATE_OPERATORS.map(op => ({
                          value: op.id,
                          label: op.label,
                        }))}
                      />
                      {/* Show relative time inputs for comparison operators */}
                      {!['is_set', 'is_not_set'].includes((condition.config.operator as string) || 'is_set') && (
                        <>
                          <input
                            type="number"
                            value={(condition.config.relative_value as number) ?? 0}
                            onChange={e =>
                              updateCondition(index, {
                                config: { ...condition.config, relative_value: parseInt(e.target.value) || 0 },
                              })
                            }
                            placeholder="0"
                            className="w-20 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm"
                          />
                          <Select
                            value={(condition.config.relative_unit as string) || 'days'}
                            onChange={e =>
                              updateCondition(index, {
                                config: { ...condition.config, relative_unit: e.target.value },
                              })
                            }
                            size="sm"
                            options={RELATIVE_TIME_UNITS.map(unit => ({
                              value: unit.id,
                              label: unit.label,
                            }))}
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400 self-center">
                            from now (use negative for past)
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-medium dark:text-gray-100">
              <Zap className="w-4 h-4 inline mr-1" />
              Then do this...
            </label>
            <button
              type="button"
              onClick={addAction}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md text-sm flex items-center dark:text-gray-200"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Action
            </button>
          </div>
          <div className="space-y-2">
            {actions.map((action, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <div className="flex-1">
                  <Select
                    value={action.type}
                    onChange={e =>
                      updateAction(index, { type: e.target.value, config: {} })
                    }
                    size="sm"
                    options={ACTION_TYPES.map(a => ({
                      value: a.id,
                      label: a.label,
                    }))}
                  />
                </div>

                {/* Action config based on type */}
                {action.type === 'add_label' || action.type === 'remove_label' ? (
                  <div className="flex-1">
                    <Select
                      value={(action.config.label as string) || ''}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, label: e.target.value },
                        })
                      }
                      size="sm"
                      placeholder="Select label..."
                      options={labels.map(l => ({
                        value: l.name,
                        label: l.name,
                      }))}
                    />
                  </div>
                ) : null}

                {action.type === 'move_card' && (
                  <div className="flex-1">
                    <Select
                      value={(action.config.list_id as string) || ''}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, list_id: e.target.value },
                        })
                      }
                      size="sm"
                      placeholder="Select list..."
                      options={lists.map(l => ({
                        value: l.id,
                        label: l.name,
                      }))}
                    />
                  </div>
                )}

                {action.type === 'add_member' && (
                  <div className="flex-1">
                    <Select
                      value={(action.config.user_id as string) || ''}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, user_id: e.target.value },
                        })
                      }
                      size="sm"
                      placeholder="Select member..."
                      options={members.map(m => ({
                        value: m.id,
                        label: m.name,
                      }))}
                    />
                  </div>
                )}

                {action.type === 'set_due_date' && (
                  <input
                    type="text"
                    value={(action.config.date as string) || ''}
                    onChange={e =>
                      updateAction(index, {
                        config: { ...action.config, date: e.target.value },
                      })
                    }
                    placeholder="+3 days, +1 week, etc."
                    className="flex-1 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                )}

                {action.type === 'mark_complete' && (
                  <div className="flex-1">
                    <Select
                      value={String(action.config.completed ?? true)}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, completed: e.target.value === 'true' },
                        })
                      }
                      size="sm"
                      options={[
                        { value: 'true', label: 'Mark as complete' },
                        { value: 'false', label: 'Mark as incomplete' },
                      ]}
                    />
                  </div>
                )}

                {(action.type === 'add_watcher' || action.type === 'remove_watcher') && (
                  <div className="flex-1">
                    <Select
                      value={(action.config.user_id as string) || ''}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, user_id: e.target.value },
                        })
                      }
                      size="sm"
                      placeholder="Select user..."
                      options={members.map(m => ({
                        value: m.id,
                        label: m.name,
                      }))}
                    />
                  </div>
                )}

                {action.type === 'add_comment' && (
                  <input
                    type="text"
                    value={(action.config.text as string) || ''}
                    onChange={e =>
                      updateAction(index, {
                        config: { ...action.config, text: e.target.value },
                      })
                    }
                    placeholder="Comment text... (use {card_title}, {board_name})"
                    className="flex-1 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                )}

                {action.type === 'send_email' && (
                  <div className="flex-1 flex flex-col gap-2">
                    <Select
                      value={(action.config.recipient_type as string) || 'members'}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, recipient_type: e.target.value },
                        })
                      }
                      size="sm"
                      options={[
                        { value: 'members', label: 'Send to card members' },
                        { value: 'watchers', label: 'Send to card watchers' },
                        { value: 'creator', label: 'Send to card creator' },
                        { value: 'specific', label: 'Send to specific emails' },
                      ]}
                    />
                    {action.config.recipient_type === 'specific' && (
                      <input
                        type="text"
                        value={(action.config.emails as string) || ''}
                        onChange={e =>
                          updateAction(index, {
                            config: { ...action.config, emails: e.target.value },
                          })
                        }
                        placeholder="email1@example.com, email2@example.com"
                        className="w-full px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    )}
                    <input
                      type="text"
                      value={(action.config.subject as string) || ''}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, subject: e.target.value },
                        })
                      }
                      placeholder="Email subject (use {card_title}, {board_name})"
                      className="w-full px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    <textarea
                      value={(action.config.message as string) || ''}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, message: e.target.value },
                        })
                      }
                      placeholder="Email message (use {card_title}, {board_name})"
                      className="w-full px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      rows={2}
                    />
                  </div>
                )}

                {(action.type === 'approve_card' || action.type === 'reject_card') && (
                  <div className="flex-1">
                    <Select
                      value={(action.config.user_id as string) || ''}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, user_id: e.target.value },
                        })
                      }
                      size="sm"
                      options={[
                        { value: '', label: 'System (automated)' },
                        ...members.map(m => ({
                          value: m.id,
                          label: m.name,
                        })),
                      ]}
                    />
                  </div>
                )}

                {action.type === 'set_department' && (
                  <div className="flex-1">
                    <Select
                      value={(action.config.department_id as string) || ''}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, department_id: e.target.value },
                        })
                      }
                      size="sm"
                      placeholder="Select department..."
                      options={departments.map(d => ({
                        value: d.id,
                        label: d.name,
                      }))}
                    />
                  </div>
                )}

                {action.type === 'set_client' && (
                  <div className="flex-1">
                    <Select
                      value={(action.config.client_id as string) || ''}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, client_id: e.target.value },
                        })
                      }
                      size="sm"
                      placeholder="Select client..."
                      options={clients.map(c => ({
                        value: c.id,
                        label: c.name,
                      }))}
                    />
                  </div>
                )}

                {action.type === 'set_custom_field' && (
                  <div className="flex-1 flex gap-2">
                    <Select
                      value={(action.config.field_id as string) || ''}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, field_id: e.target.value, value: '' },
                        })
                      }
                      size="sm"
                      placeholder="Select field..."
                      options={customFields.map(f => ({
                        value: f.id,
                        label: f.title,
                      }))}
                    />
                    {Boolean(action.config.field_id) && customFields.find(f => f.id === action.config.field_id)?.type === 'dropdown' && (customFields.find(f => f.id === action.config.field_id)?.options?.length ?? 0) > 0 && (
                      <Select
                        value={(action.config.value as string) || ''}
                        onChange={e =>
                          updateAction(index, {
                            config: { ...action.config, value: e.target.value },
                          })
                        }
                        size="sm"
                        placeholder="Select value..."
                        options={(customFields.find(f => f.id === action.config.field_id)?.options || []).map(opt => ({
                          value: opt,
                          label: opt,
                        }))}
                      />
                    )}
                    {Boolean(action.config.field_id) && customFields.find(f => f.id === action.config.field_id)?.type === 'checkbox' && (
                      <Select
                        value={(action.config.value as string) || ''}
                        onChange={e =>
                          updateAction(index, {
                            config: { ...action.config, value: e.target.value },
                          })
                        }
                        size="sm"
                        options={[
                          { value: 'true', label: 'Check' },
                          { value: 'false', label: 'Uncheck' },
                        ]}
                      />
                    )}
                    {Boolean(action.config.field_id) && customFields.find(f => f.id === action.config.field_id)?.type === 'rating' && (
                      <Select
                        value={(action.config.value as string) || ''}
                        onChange={e =>
                          updateAction(index, {
                            config: { ...action.config, value: e.target.value },
                          })
                        }
                        size="sm"
                        options={[1, 2, 3, 4, 5].map(n => ({
                          value: String(n),
                          label: `${n} star${n > 1 ? 's' : ''}`,
                        }))}
                      />
                    )}
                    {Boolean(action.config.field_id) && !['dropdown', 'checkbox', 'rating'].includes(customFields.find(f => f.id === action.config.field_id)?.type || '') && (
                      <input
                        type={['number', 'currency'].includes(customFields.find(f => f.id === action.config.field_id)?.type || '') ? 'number' : 'text'}
                        value={(action.config.value as string) || ''}
                        onChange={e =>
                          updateAction(index, {
                            config: { ...action.config, value: e.target.value },
                          })
                        }
                        placeholder="Value..."
                        className="flex-1 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => removeAction(index)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-red-500"
                  disabled={actions.length <= 1}
                >
                  <Trash2 className={`w-4 h-4 ${actions.length <= 1 ? 'opacity-30' : ''}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </form>

      <div className="flex justify-end gap-2 p-4 border-t dark:border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md dark:text-gray-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-md"
        >
          {rule ? 'Save Changes' : 'Create Rule'}
        </button>
      </div>
    </div>
  );
}

export default AutomationRules;
