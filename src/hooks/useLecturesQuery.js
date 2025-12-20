import { useQuery } from "@tanstack/react-query";
import { lectureAPI } from "../utils/api";

export const useLecturesQuery = (chapterId, options = {}) => {
  return useQuery({
    queryKey: ["lectures", chapterId],
    queryFn: async () => {
      const res = await lectureAPI.getLecturesByChapter(chapterId);
      return res.data || [];
    },
    enabled: !!chapterId,
    staleTime: 60_000,
    cacheTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    ...options,
  });
};
