import { getFirebaseToken } from "../users/Request";
import { ContentCategoriesResponse, ContentItemsResponse } from "./Dto";

const EXPO_API_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.workfloww.ai";
const API_BASE_URL = `${EXPO_API_URL}/api/content-library`;

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

export const getContentCategories = async (companyId?: string | null): Promise<ContentCategoriesResponse> => {
  const headers = await getHeaders(companyId);
  const response = await fetch(`${API_BASE_URL}/categories`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch content categories: ${response.status} ${errorBody}`);
  }

  return response.json();
};

export const getContentItems = async (
  categoryId?: string,
  companyId?: string | null,
): Promise<ContentItemsResponse> => {
  const headers = await getHeaders(companyId);
  const url = new URL(`${API_BASE_URL}/items`);
  if (categoryId) {
    url.searchParams.append("category_id", categoryId);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to fetch content items: ${response.status} ${errorBody}`);
  }

  return response.json();
};
