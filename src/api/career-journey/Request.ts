import { apiFetch, API_BASE_URL } from "../client";

const CAREER_JOURNEYS_URL = `${API_BASE_URL}/career-journeys`;

export const getCareerJourneys = async (companyId?: string | null): Promise<any> => {
  return apiFetch<any>(`${CAREER_JOURNEYS_URL}?status=published`, {
    method: "GET",
    companyId: companyId ?? undefined,
  });
};
