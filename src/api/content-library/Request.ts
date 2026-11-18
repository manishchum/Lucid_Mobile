import { apiFetch, API_BASE_URL } from "../client";
import { ContentCategoriesResponse, ContentItemsResponse } from "./Dto";

const CONTENT_LIBRARY_URL = `${API_BASE_URL}/content-library`;

export const getContentCategories = async (
  companyId?: string | null,
): Promise<ContentCategoriesResponse> => {
  return apiFetch<ContentCategoriesResponse>(`${CONTENT_LIBRARY_URL}/categories`, {
    method: "GET",
    companyId: companyId ?? undefined,
  });
};

export const getContentItems = async (
  categoryId?: string,
  companyId?: string | null,
): Promise<ContentItemsResponse> => {
  const url = new URL(`${CONTENT_LIBRARY_URL}/items`);
  if (categoryId) {
    url.searchParams.append("category_id", categoryId);
  }

  return apiFetch<ContentItemsResponse>(url.toString(), {
    method: "GET",
    companyId: companyId ?? undefined,
  });
};
