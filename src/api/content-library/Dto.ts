export interface ContentCategory {
  id: string;
  name: string;
  company_id: string;
  created_at: string;
}

export interface ContentItem {
  id: string;
  category_id: string;
  company_id: string;
  title: string;
  description: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export interface ContentCategoriesResponse {
  success: boolean;
  data: ContentCategory[];
}

export interface ContentItemsResponse {
  success: boolean;
  data: ContentItem[];
}
