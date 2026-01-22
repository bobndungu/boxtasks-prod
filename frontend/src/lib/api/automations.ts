import { getAccessToken, fetchWithCsrf } from './client';

const API_URL = import.meta.env.VITE_API_URL || 'https://boxtasks2.ddev.site';

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const method = options?.method?.toUpperCase() || 'GET';
  const isStateChanging = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);

  // Use fetchWithCsrf for state-changing requests, regular fetch for GET
  const fetchFn = isStateChanging ? fetchWithCsrf : fetch;

  const response = await fetchFn(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Accept': 'application/vnd.api+json',
      ...(isStateChanging ? {} : { 'Authorization': `Bearer ${getAccessToken()}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  // DELETE requests may return no content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export interface AutomationRule {
  id: string;
  drupalId: number;
  name: string;
  boardId: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
  applyRetroactively: boolean;
  executionCount: number;
  lastExecuted: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationCondition {
  type: string;
  config: Record<string, unknown>;
}

export interface AutomationAction {
  type: string;
  config: Record<string, unknown>;
}

export interface AutomationLog {
  id: string;
  ruleId: string;
  boardId: string;
  cardId: string | null;
  triggerType: string;
  triggerData: Record<string, unknown>;
  actionsExecuted: Array<{
    type: string;
    success: boolean;
    result: Record<string, unknown>;
  }>;
  status: 'success' | 'error';
  errorMessage: string | null;
  executionTime: number;
  createdAt: string;
}

// Available trigger types
export const TRIGGER_TYPES = [
  { id: 'card_created', label: 'Card Created', description: 'When a new card is created' },
  { id: 'card_moved', label: 'Card Moved', description: 'When a card is moved to another list' },
  { id: 'card_completed', label: 'Card Completed', description: 'When a card is marked as complete' },
  { id: 'due_date_approaching', label: 'Due Date Approaching', description: 'When a card due date is approaching' },
  { id: 'label_added', label: 'Label Added', description: 'When a label is added to a card' },
  { id: 'label_removed', label: 'Label Removed', description: 'When a label is removed from a card' },
  { id: 'member_added', label: 'Member Added', description: 'When a member is assigned to a card' },
  { id: 'checklist_completed', label: 'Checklist Completed', description: 'When all checklist items are completed' },
  { id: 'scheduled', label: 'Scheduled', description: 'Run on a schedule (daily, weekly, monthly)' },
  { id: 'comment_added', label: 'Comment Added', description: 'When a comment is added to a card' },
  { id: 'watcher_added', label: 'Watcher Added', description: 'When a watcher is added to a card' },
  { id: 'watcher_removed', label: 'Watcher Removed', description: 'When a watcher is removed from a card' },
  { id: 'custom_field_changed', label: 'Custom Field Changed', description: 'When a custom field value changes' },
  { id: 'department_changed', label: 'Department Changed', description: 'When the department is changed' },
  { id: 'client_changed', label: 'Client Changed', description: 'When the client is changed' },
  { id: 'card_approved', label: 'Card Approved', description: 'When a card is approved' },
  { id: 'card_rejected', label: 'Card Rejected', description: 'When a card is rejected' },
  { id: 'card_approval_cleared', label: 'Approval Cleared', description: 'When card approval is cleared' },
] as const;

// Schedule interval options for scheduled trigger
export const SCHEDULE_INTERVALS = [
  { id: 'hourly', label: 'Hourly', description: 'Run every hour' },
  { id: 'daily', label: 'Daily', description: 'Run once per day' },
  { id: 'weekly', label: 'Weekly', description: 'Run on specific days of the week' },
  { id: 'monthly', label: 'Monthly', description: 'Run on a specific day of the month' },
] as const;

// Days of week for weekly schedules
export const DAYS_OF_WEEK = [
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
  { id: 7, label: 'Sunday' },
] as const;

// Scope options for scheduled automations
export const SCHEDULE_SCOPES = [
  { id: 'all_cards', label: 'All Cards', description: 'Run on all cards in the board' },
  { id: 'filtered_cards', label: 'Filtered Cards', description: 'Run on cards matching filter criteria' },
  { id: 'single', label: 'Board Level', description: 'Run once (no card context)' },
] as const;

// Available condition types
export const CONDITION_TYPES = [
  { id: 'card_has_label', label: 'Card Has Label', description: 'Card has a specific label', configFields: ['label'] },
  { id: 'card_in_list', label: 'Card In List', description: 'Card is in a specific list', configFields: ['list_id'] },
  { id: 'card_has_due_date', label: 'Card Due Date', description: 'Check card due date with comparison', configFields: ['operator', 'relative_value', 'relative_unit'] },
  { id: 'card_is_overdue', label: 'Card Is Overdue', description: 'Card is past its due date', configFields: [] },
  { id: 'card_title_contains', label: 'Title Contains', description: 'Card title contains text', configFields: ['text'] },
  { id: 'card_has_department', label: 'Card Has Department', description: 'Card has a specific department', configFields: ['department_id'] },
  { id: 'card_has_client', label: 'Card Has Client', description: 'Card has a specific client', configFields: ['client_id'] },
  { id: 'custom_field_equals', label: 'Custom Field Equals', description: 'Custom field has a specific value', configFields: ['field_id', 'value'] },
  { id: 'custom_field_not_empty', label: 'Custom Field Not Empty', description: 'Custom field has any value', configFields: ['field_id'] },
  { id: 'card_has_watcher', label: 'Card Has Watcher', description: 'Card has a specific watcher', configFields: ['user_id'] },
  { id: 'card_has_comments', label: 'Card Has Comments', description: 'Card has one or more comments', configFields: [] },
  { id: 'card_has_member', label: 'Card Has Member', description: 'Card has a specific member assigned', configFields: ['user_id'] },
  { id: 'card_is_approved', label: 'Card Is Approved', description: 'Card has been approved', configFields: [] },
  { id: 'card_is_rejected', label: 'Card Is Rejected', description: 'Card has been rejected', configFields: [] },
  { id: 'card_has_no_approval', label: 'No Approval Status', description: 'Card has not been approved or rejected', configFields: [] },
  { id: 'card_approved_by', label: 'Approved By User', description: 'Card was approved by a specific user', configFields: ['user_id'] },
] as const;

// Available action types
export const ACTION_TYPES = [
  { id: 'add_label', label: 'Add Label', description: 'Add a label to the card', configFields: ['label'] },
  { id: 'remove_label', label: 'Remove Label', description: 'Remove a label from the card', configFields: ['label'] },
  { id: 'move_card', label: 'Move Card', description: 'Move the card to another list', configFields: ['list_id'] },
  { id: 'mark_complete', label: 'Mark Complete', description: 'Mark the card as complete', configFields: ['completed'] },
  { id: 'set_due_date', label: 'Set Due Date', description: 'Set or change the due date', configFields: ['date'] },
  { id: 'add_member', label: 'Add Member', description: 'Assign a member to the card', configFields: ['user_id'] },
  { id: 'send_email', label: 'Send Email', description: 'Send an email notification', configFields: ['recipient_type', 'subject', 'message', 'emails'] },
  { id: 'add_comment', label: 'Add Comment', description: 'Add a comment to the card', configFields: ['text'] },
  { id: 'set_custom_field', label: 'Set Custom Field', description: 'Set a custom field value', configFields: ['field_id', 'value'] },
  { id: 'set_department', label: 'Set Department', description: 'Set the card department', configFields: ['department_id'] },
  { id: 'remove_department', label: 'Remove Department', description: 'Remove the department from the card', configFields: [] },
  { id: 'set_client', label: 'Set Client', description: 'Set the card client', configFields: ['client_id'] },
  { id: 'remove_client', label: 'Remove Client', description: 'Remove the client from the card', configFields: [] },
  { id: 'add_watcher', label: 'Add Watcher', description: 'Add a watcher to the card', configFields: ['user_id'] },
  { id: 'remove_watcher', label: 'Remove Watcher', description: 'Remove a watcher from the card', configFields: ['user_id'] },
  { id: 'approve_card', label: 'Approve Card', description: 'Automatically approve the card', configFields: ['user_id'] },
  { id: 'reject_card', label: 'Reject Card', description: 'Automatically reject the card', configFields: ['user_id'] },
  { id: 'clear_approval', label: 'Clear Approval', description: 'Clear approval/rejection status', configFields: [] },
] as const;

// Email recipient types for send_email action
export const EMAIL_RECIPIENT_TYPES = [
  { id: 'members', label: 'Card Members', description: 'Send to all assigned members' },
  { id: 'watchers', label: 'Card Watchers', description: 'Send to all watchers' },
  { id: 'creator', label: 'Card Creator', description: 'Send to the card creator' },
  { id: 'specific', label: 'Specific Emails', description: 'Send to specific email addresses' },
] as const;

// Due date comparison operators
export const DUE_DATE_OPERATORS = [
  { id: 'is_set', label: 'Is Set', description: 'Has any due date' },
  { id: 'is_not_set', label: 'Is Not Set', description: 'Has no due date' },
  { id: 'is_before', label: 'Is Before', description: 'Due date is before relative date' },
  { id: 'is_after', label: 'Is After', description: 'Due date is after relative date' },
  { id: 'is_on_or_before', label: 'Is On or Before', description: 'Due date is on or before relative date' },
  { id: 'is_on_or_after', label: 'Is On or After', description: 'Due date is on or after relative date' },
  { id: 'equals', label: 'Equals', description: 'Due date is exactly on relative date' },
] as const;

// Relative time units for due date comparison
export const RELATIVE_TIME_UNITS = [
  { id: 'days', label: 'Days' },
  { id: 'weeks', label: 'Weeks' },
  { id: 'months', label: 'Months' },
] as const;

function transformRuleFromApi(data: any): AutomationRule {
  const attrs = data.attributes || data;
  return {
    id: data.id,
    drupalId: attrs.drupal_internal__id || attrs.drupalId,
    name: attrs.name,
    boardId: data.relationships?.board_id?.data?.id || attrs.boardId,
    triggerType: attrs.trigger_type || attrs.triggerType,
    triggerConfig: attrs.trigger_config ?
      (typeof attrs.trigger_config === 'string' ? JSON.parse(attrs.trigger_config) : attrs.trigger_config) : {},
    conditions: attrs.conditions ?
      (typeof attrs.conditions === 'string' ? JSON.parse(attrs.conditions) : attrs.conditions) : [],
    actions: attrs.actions ?
      (typeof attrs.actions === 'string' ? JSON.parse(attrs.actions) : attrs.actions) : [],
    enabled: attrs.enabled ?? true,
    applyRetroactively: attrs.apply_retroactively ?? attrs.applyRetroactively ?? true,
    executionCount: attrs.execution_count || attrs.executionCount || 0,
    lastExecuted: attrs.last_executed || attrs.lastExecuted,
    createdAt: attrs.created,
    updatedAt: attrs.changed,
  };
}

function transformLogFromApi(data: any): AutomationLog {
  const attrs = data.attributes || data;
  return {
    id: data.id,
    ruleId: data.relationships?.rule_id?.data?.id || attrs.ruleId,
    boardId: data.relationships?.board_id?.data?.id || attrs.boardId,
    cardId: data.relationships?.card_id?.data?.id || attrs.cardId,
    triggerType: attrs.trigger_type || attrs.triggerType,
    triggerData: attrs.trigger_data ?
      (typeof attrs.trigger_data === 'string' ? JSON.parse(attrs.trigger_data) : attrs.trigger_data) : {},
    actionsExecuted: attrs.actions_executed ?
      (typeof attrs.actions_executed === 'string' ? JSON.parse(attrs.actions_executed) : attrs.actions_executed) : [],
    status: attrs.status,
    errorMessage: attrs.error_message || attrs.errorMessage,
    executionTime: attrs.execution_time || attrs.executionTime || 0,
    createdAt: attrs.created,
  };
}

export async function getAutomationRules(boardId: string): Promise<AutomationRule[]> {
  const response = await apiRequest<{ data: any[] }>(
    `/jsonapi/automation_rule/automation_rule?filter[board_id.id]=${boardId}&sort=-created`
  );
  return response.data.map(transformRuleFromApi);
}

export async function getAutomationRule(ruleId: string): Promise<AutomationRule> {
  const response = await apiRequest<{ data: any }>(
    `/jsonapi/automation_rule/automation_rule/${ruleId}`
  );
  return transformRuleFromApi(response.data);
}

export async function createAutomationRule(
  boardId: string,
  rule: {
    name: string;
    triggerType: string;
    triggerConfig?: Record<string, unknown>;
    conditions?: AutomationCondition[];
    actions: AutomationAction[];
    enabled?: boolean;
    applyRetroactively?: boolean;
  }
): Promise<AutomationRule> {
  const response = await apiRequest<{ data: any }>(
    '/jsonapi/automation_rule/automation_rule',
    {
      method: 'POST',
      body: JSON.stringify({
        data: {
          type: 'automation_rule--automation_rule',
          attributes: {
            name: rule.name,
            trigger_type: rule.triggerType,
            trigger_config: JSON.stringify(rule.triggerConfig || {}),
            conditions: JSON.stringify(rule.conditions || []),
            actions: JSON.stringify(rule.actions),
            enabled: rule.enabled ?? true,
            apply_retroactively: rule.applyRetroactively ?? true,
          },
          relationships: {
            board_id: {
              data: {
                type: 'node--board',
                id: boardId,
              },
            },
          },
        },
      }),
    }
  );
  return transformRuleFromApi(response.data);
}

export async function updateAutomationRule(
  ruleId: string,
  updates: Partial<{
    name: string;
    triggerType: string;
    triggerConfig: Record<string, unknown>;
    conditions: AutomationCondition[];
    actions: AutomationAction[];
    enabled: boolean;
    applyRetroactively: boolean;
  }>
): Promise<AutomationRule> {
  const attributes: Record<string, unknown> = {};

  if (updates.name !== undefined) attributes.name = updates.name;
  if (updates.triggerType !== undefined) attributes.trigger_type = updates.triggerType;
  if (updates.triggerConfig !== undefined) attributes.trigger_config = JSON.stringify(updates.triggerConfig);
  if (updates.conditions !== undefined) attributes.conditions = JSON.stringify(updates.conditions);
  if (updates.actions !== undefined) attributes.actions = JSON.stringify(updates.actions);
  if (updates.enabled !== undefined) attributes.enabled = updates.enabled;
  if (updates.applyRetroactively !== undefined) attributes.apply_retroactively = updates.applyRetroactively;

  const response = await apiRequest<{ data: any }>(
    `/jsonapi/automation_rule/automation_rule/${ruleId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          type: 'automation_rule--automation_rule',
          id: ruleId,
          attributes,
        },
      }),
    }
  );
  return transformRuleFromApi(response.data);
}

export async function deleteAutomationRule(ruleId: string): Promise<void> {
  await apiRequest(`/jsonapi/automation_rule/automation_rule/${ruleId}`, {
    method: 'DELETE',
  });
}

export async function toggleAutomationRule(ruleId: string, enabled: boolean): Promise<AutomationRule> {
  return updateAutomationRule(ruleId, { enabled });
}

export async function getAutomationLogs(
  boardId: string,
  options?: { ruleId?: string; limit?: number }
): Promise<AutomationLog[]> {
  let url = `/jsonapi/automation_log/automation_log?filter[board_id.id]=${boardId}&sort=-created`;

  if (options?.ruleId) {
    url += `&filter[rule_id.id]=${options.ruleId}`;
  }

  if (options?.limit) {
    url += `&page[limit]=${options.limit}`;
  }

  const response = await apiRequest<{ data: any[] }>(url);
  return response.data.map(transformLogFromApi);
}

export async function getRuleExecutionStats(ruleId: string): Promise<{
  totalExecutions: number;
  successCount: number;
  errorCount: number;
  lastExecution: string | null;
  avgExecutionTime: number;
}> {
  const logs = await getAutomationLogs('', { ruleId, limit: 100 });

  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount = logs.filter(l => l.status === 'error').length;
  const totalTime = logs.reduce((sum, l) => sum + l.executionTime, 0);

  return {
    totalExecutions: logs.length,
    successCount,
    errorCount,
    lastExecution: logs.length > 0 ? logs[0].createdAt : null,
    avgExecutionTime: logs.length > 0 ? Math.round(totalTime / logs.length) : 0,
  };
}
