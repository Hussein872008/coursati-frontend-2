import { useQuery } from "@tanstack/react-query";
import { chapterAPI } from "../utils/api";

export const useChaptersQuery = (courseId, options = {}) => {
  return useQuery({
    queryKey: ["chapters", courseId],
    queryFn: async () => {
      const res = await chapterAPI.getChaptersByCourse(courseId);
      return res.data || [];
    },
    enabled: !!courseId,
    staleTime: 60_000,
    cacheTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    ...options,
  });
};
