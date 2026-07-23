import { getFirebaseToken } from "../users/Request";

const EXPO_API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";
const API_BASE_URL = `${EXPO_API_URL}/api/career-journeys`;

const getHeaders = async (companyId?: string | null) => {
  const token = await getFirebaseToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (companyId) {
    headers["X-Company-ID"] = companyId;
  }
  return headers;
};

export const getCareerJourneys = async (companyId?: string | null): Promise<any> => {
  const headers = await getHeaders(companyId);
  const response = await fetch(`${API_BASE_URL}?status=published`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch career journeys: ${response.status} ${errorBody}`);
  }

  return response.json();
};
