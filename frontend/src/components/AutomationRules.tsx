import React, { useState, useEffect } from 'react';
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
  getAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
  toggleAutomationRule,
  getAutomationLogs,
} from '../lib/api/automations';

interface AutomationRulesProps {
  boardUuid: string;
  lists: Array<{ id: string; name: string }>;
  labels: Array<{ id: string; name: string; color: string }>;
  members: Array<{ id: string; name: string }>;
  onClose?: () => void;
}

export function AutomationRules({
  boardUuid,
  lists,
  labels,
  members,
  onClose,
}: AutomationRulesProps) {
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
    } catch (err) {
      setError('Failed to toggle rule');
    }
  }

  async function handleDeleteRule(rule: AutomationRule) {
    if (!confirm(`Delete automation rule "${rule.name}"?`)) return;

    try {
      await deleteAutomationRule(rule.id);
      setRules(rules.filter(r => r.id !== rule.id));
    } catch (err) {
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
    } catch (err) {
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
        onSave={handleSaveRule}
        onCancel={() => {
          setShowEditor(false);
          setEditingRule(null);
        }}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-semibold">Automation Rules</h2>
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
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'rules'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('rules')}
        >
          Rules ({rules.length})
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            activeTab === 'logs'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('logs')}
        >
          Activity Log
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
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
      <div className="text-center py-8 text-gray-500">
        <Zap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
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
          className={`border rounded-lg ${rule.enabled ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}
        >
          {/* Rule Header */}
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <button
                onClick={() => onToggleExpanded(rule.id)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                {expandedRules.has(rule.id) ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${!rule.enabled && 'text-gray-400'}`}>
                    {rule.name}
                  </span>
                  {!rule.enabled && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                      Disabled
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
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
                className="p-2 hover:bg-gray-100 rounded"
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
                className="p-2 hover:bg-gray-100 rounded"
                title="Edit"
              >
                <Edit className="w-4 h-4 text-gray-500" />
              </button>
              <button
                onClick={() => onDeleteRule(rule)}
                className="p-2 hover:bg-gray-100 rounded"
                title="Delete"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>

          {/* Expanded Details */}
          {expandedRules.has(rule.id) && (
            <div className="px-4 pb-3 pt-0 border-t bg-gray-50">
              <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                <div>
                  <span className="font-medium text-gray-600">Trigger:</span>
                  <p>{getTriggerLabel(rule.triggerType)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Executions:</span>
                  <p>{rule.executionCount} times</p>
                </div>
                {rule.conditions.length > 0 && (
                  <div className="col-span-2">
                    <span className="font-medium text-gray-600">Conditions:</span>
                    <ul className="list-disc list-inside mt-1">
                      {rule.conditions.map((c, i) => (
                        <li key={i}>
                          {CONDITION_TYPES.find(ct => ct.id === c.type)?.label || c.type}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="col-span-2">
                  <span className="font-medium text-gray-600">Actions:</span>
                  <ul className="list-disc list-inside mt-1">
                    {rule.actions.map((a, i) => (
                      <li key={i}>{getActionLabel(a.type)}</li>
                    ))}
                  </ul>
                </div>
                {rule.lastExecuted && (
                  <div className="col-span-2 text-gray-500">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Last run: {new Date(rule.lastExecuted).toLocaleString()}
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
      <div className="text-center py-8 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
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
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {log.status === 'success' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="font-medium">
                {getTriggerLabel(log.triggerType)}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(log.createdAt).toLocaleString()}
            </span>
          </div>
          {log.status === 'error' && log.errorMessage && (
            <p className="mt-1 text-sm text-red-600">{log.errorMessage}</p>
          )}
          {log.actionsExecuted.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              Actions: {log.actionsExecuted.map(a => a.type).join(', ')}
            </div>
          )}
          <div className="mt-1 text-xs text-gray-500">
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
  onSave: (rule: {
    name: string;
    triggerType: string;
    triggerConfig: Record<string, unknown>;
    conditions: AutomationCondition[];
    actions: AutomationAction[];
  }) => void;
  onCancel: () => void;
}

function RuleEditor({ rule, lists, labels, members, onSave, onCancel }: RuleEditorProps) {
  const [name, setName] = useState(rule?.name || '');
  const [triggerType, setTriggerType] = useState(rule?.triggerType || 'card_created');
  const [triggerConfig, _setTriggerConfig] = useState<Record<string, unknown>>(
    rule?.triggerConfig || {}
  );
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
    <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">
          {rule ? 'Edit Automation Rule' : 'Create Automation Rule'}
        </h2>
        <button onClick={onCancel} className="p-1 hover:bg-gray-100 rounded">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-6">
        {errors.length > 0 && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg">
            <ul className="list-disc list-inside">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Rule Name */}
        <div>
          <label className="block font-medium mb-1">Rule Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g., Move completed cards to Done"
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Trigger */}
        <div>
          <label className="block font-medium mb-1">
            <Play className="w-4 h-4 inline mr-1" />
            When this happens...
          </label>
          <select
            value={triggerType}
            onChange={e => setTriggerType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TRIGGER_TYPES.map(t => (
              <option key={t.id} value={t.id}>
                {t.label} - {t.description}
              </option>
            ))}
          </select>
        </div>

        {/* Conditions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="font-medium">
              Conditions (optional)
            </label>
            <button
              type="button"
              onClick={addCondition}
              className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded-md text-sm flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Condition
            </button>
          </div>
          {conditions.length === 0 ? (
            <p className="text-sm text-gray-500">
              No conditions - rule will run on every trigger
            </p>
          ) : (
            <div className="space-y-2">
              {conditions.map((condition, index) => (
                <div key={index} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <select
                    value={condition.type}
                    onChange={e =>
                      updateCondition(index, { type: e.target.value, config: {} })
                    }
                    className="flex-1 px-2 py-1 border rounded"
                  >
                    {CONDITION_TYPES.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>

                  {/* Condition config based on type */}
                  {condition.type === 'card_has_label' && (
                    <select
                      value={(condition.config.label as string) || ''}
                      onChange={e =>
                        updateCondition(index, {
                          config: { ...condition.config, label: e.target.value },
                        })
                      }
                      className="flex-1 px-2 py-1 border rounded"
                    >
                      <option value="">Select label...</option>
                      {labels.map(l => (
                        <option key={l.id} value={l.name}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {condition.type === 'card_in_list' && (
                    <select
                      value={(condition.config.list_id as string) || ''}
                      onChange={e =>
                        updateCondition(index, {
                          config: { ...condition.config, list_id: e.target.value },
                        })
                      }
                      className="flex-1 px-2 py-1 border rounded"
                    >
                      <option value="">Select list...</option>
                      {lists.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
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
                      className="flex-1 px-2 py-1 border rounded"
                    />
                  )}

                  {(condition.type === 'card_has_watcher' || condition.type === 'card_has_member' || condition.type === 'card_approved_by') && (
                    <select
                      value={(condition.config.user_id as string) || ''}
                      onChange={e =>
                        updateCondition(index, {
                          config: { ...condition.config, user_id: e.target.value },
                        })
                      }
                      className="flex-1 px-2 py-1 border rounded"
                    >
                      <option value="">Any user (or select specific)</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    className="p-1 hover:bg-gray-200 rounded text-red-500"
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
            <label className="font-medium">
              <Zap className="w-4 h-4 inline mr-1" />
              Then do this...
            </label>
            <button
              type="button"
              onClick={addAction}
              className="px-3 py-1.5 border border-gray-300 hover:bg-gray-50 rounded-md text-sm flex items-center"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Action
            </button>
          </div>
          <div className="space-y-2">
            {actions.map((action, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                <select
                  value={action.type}
                  onChange={e =>
                    updateAction(index, { type: e.target.value, config: {} })
                  }
                  className="flex-1 px-2 py-1 border rounded"
                >
                  {ACTION_TYPES.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>

                {/* Action config based on type */}
                {action.type === 'add_label' || action.type === 'remove_label' ? (
                  <select
                    value={(action.config.label as string) || ''}
                    onChange={e =>
                      updateAction(index, {
                        config: { ...action.config, label: e.target.value },
                      })
                    }
                    className="flex-1 px-2 py-1 border rounded"
                  >
                    <option value="">Select label...</option>
                    {labels.map(l => (
                      <option key={l.id} value={l.name}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                ) : null}

                {action.type === 'move_card' && (
                  <select
                    value={(action.config.list_id as string) || ''}
                    onChange={e =>
                      updateAction(index, {
                        config: { ...action.config, list_id: e.target.value },
                      })
                    }
                    className="flex-1 px-2 py-1 border rounded"
                  >
                    <option value="">Select list...</option>
                    {lists.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}

                {action.type === 'add_member' && (
                  <select
                    value={(action.config.user_id as string) || ''}
                    onChange={e =>
                      updateAction(index, {
                        config: { ...action.config, user_id: e.target.value },
                      })
                    }
                    className="flex-1 px-2 py-1 border rounded"
                  >
                    <option value="">Select member...</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
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
                    className="flex-1 px-2 py-1 border rounded"
                  />
                )}

                {action.type === 'mark_complete' && (
                  <select
                    value={String(action.config.completed ?? true)}
                    onChange={e =>
                      updateAction(index, {
                        config: { ...action.config, completed: e.target.value === 'true' },
                      })
                    }
                    className="flex-1 px-2 py-1 border rounded"
                  >
                    <option value="true">Mark as complete</option>
                    <option value="false">Mark as incomplete</option>
                  </select>
                )}

                {(action.type === 'add_watcher' || action.type === 'remove_watcher') && (
                  <select
                    value={(action.config.user_id as string) || ''}
                    onChange={e =>
                      updateAction(index, {
                        config: { ...action.config, user_id: e.target.value },
                      })
                    }
                    className="flex-1 px-2 py-1 border rounded"
                  >
                    <option value="">Select user...</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
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
                    className="flex-1 px-2 py-1 border rounded"
                  />
                )}

                {action.type === 'send_email' && (
                  <div className="flex-1 flex flex-col gap-2">
                    <select
                      value={(action.config.recipient_type as string) || 'members'}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, recipient_type: e.target.value },
                        })
                      }
                      className="w-full px-2 py-1 border rounded"
                    >
                      <option value="members">Send to card members</option>
                      <option value="watchers">Send to card watchers</option>
                      <option value="creator">Send to card creator</option>
                      <option value="specific">Send to specific emails</option>
                    </select>
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
                        className="w-full px-2 py-1 border rounded"
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
                      className="w-full px-2 py-1 border rounded"
                    />
                    <textarea
                      value={(action.config.message as string) || ''}
                      onChange={e =>
                        updateAction(index, {
                          config: { ...action.config, message: e.target.value },
                        })
                      }
                      placeholder="Email message (use {card_title}, {board_name})"
                      className="w-full px-2 py-1 border rounded"
                      rows={2}
                    />
                  </div>
                )}

                {(action.type === 'approve_card' || action.type === 'reject_card') && (
                  <select
                    value={(action.config.user_id as string) || ''}
                    onChange={e =>
                      updateAction(index, {
                        config: { ...action.config, user_id: e.target.value },
                      })
                    }
                    className="flex-1 px-2 py-1 border rounded"
                  >
                    <option value="">System (automated)</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => removeAction(index)}
                  className="p-1 hover:bg-gray-200 rounded text-red-500"
                  disabled={actions.length <= 1}
                >
                  <Trash2 className={`w-4 h-4 ${actions.length <= 1 ? 'opacity-30' : ''}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </form>

      <div className="flex justify-end gap-2 p-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-md"
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
