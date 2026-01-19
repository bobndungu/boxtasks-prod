import { customApiClient } from './client';

export interface RegistrationSettings {
  requireApproval: boolean;
  registrationEnabled: boolean;
}

export interface PendingUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  created: number;
}

export interface PendingUsersResponse {
  users: PendingUser[];
  count: number;
}

/**
 * Get current registration settings.
 */
export async function getRegistrationSettings(): Promise<RegistrationSettings> {
  const response = await customApiClient.get<RegistrationSettings>('/api/registration/settings');
  return response.data;
}

/**
 * Update registration settings.
 */
export async function updateRegistrationSettings(
  settings: { requireApproval: boolean }
): Promise<{ success: boolean; requireApproval: boolean }> {
  const response = await customApiClient.post('/api/registration/settings', settings);
  return response.data;
}

/**
 * Get list of users pending approval.
 */
export async function getPendingUsers(): Promise<PendingUsersResponse> {
  const response = await customApiClient.get<PendingUsersResponse>('/api/users/pending');
  return response.data;
}

/**
 * Approve a pending user.
 */
export async function approveUser(userId: string): Promise<{ success: boolean; message: string }> {
  const response = await customApiClient.post(`/api/users/${userId}/approve`);
  return response.data;
}

/**
 * Reject and delete a pending user.
 */
export async function rejectUser(userId: string): Promise<{ success: boolean; message: string }> {
  const response = await customApiClient.post(`/api/users/${userId}/reject`);
  return response.data;
}
