import { useState, useEffect } from "react";
import { getContentCategories, getContentItems } from "./Request";
import { ContentCategory, ContentItem } from "./Dto";

export const useContentCategories = (companyId?: string | null) => {
  const [data, setData] = useState<ContentCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const response = await getContentCategories(companyId);
        if (isMounted) {
          setData(response.data || []);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    fetchCategories();
    return () => {
      isMounted = false;
    };
  }, [companyId]);

  return { data, isLoading, error };
};

export const useContentItems = (categoryId?: string, companyId?: string | null) => {
  const [data, setData] = useState<ContentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchItems = async () => {
    try {
      setIsLoading(true);
      const response = await getContentItems(categoryId, companyId);
      setData(response.data || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [categoryId, companyId]);

  return { data, isLoading, error, refetch: fetchItems };
};
