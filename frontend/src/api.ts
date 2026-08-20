const API_URL = "http://localhost:5000";

export interface User {
  id: string;
  googleId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

export interface Campaign {
  id: string;
  userId: string;
  subject: string;
  body: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledEmail {
  id: string;
  campaignId: string;
  recipient: string;
  senderEmail: string;
  scheduledAt: string;
  sentAt: string | null;
  status: "SCHEDULED" | "PROCESSING" | "SENT" | "FAILED";
  errorMessage: string | null;
  jobId: string | null;
  createdAt: string;
  updatedAt: string;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!response.ok) {
    let message = "Something went wrong";

    try {
      const data = await response.json();
      message = data.error || message;
    } catch {
      // Ignore JSON parsing errors
    }

    throw new Error(message);
  }

  return response.json();
}

export async function getCurrentUser() {
  return request<{
    authenticated: boolean;
    user: User;
  }>("/auth/me");
}

export async function getCampaigns() {
  return request<{
    campaigns: Campaign[];
  }>("/api/campaigns");
}

export async function createCampaign(data: {
  subject: string;
  body: string;
  startTime: string;
  delaySeconds: number;
  hourlyLimit: number;
}) {
  return request<{
    campaign: Campaign;
  }>("/api/campaigns", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function createScheduledEmail(data: {
  campaignId: string;
  recipient: string;
  senderEmail: string;
  scheduledAt: string;
}) {
  return request<{
    email: ScheduledEmail;
  }>("/api/emails", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getScheduledEmails(
  campaignId: string,
) {
  return request<{
    emails: ScheduledEmail[];
  }>(`/api/emails/${campaignId}`);
}

export function getGoogleLoginUrl() {
  return `${API_URL}/auth/google`;
}