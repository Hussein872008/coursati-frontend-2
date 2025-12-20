import { useQuery } from "@tanstack/react-query";
import { videoAPI, pdfAPI } from "../utils/api";

export const useVideosQuery = (lectureId, options = {}) => {
  return useQuery({
    queryKey: ["videos", lectureId],
    queryFn: async () => {
      const res = await videoAPI.getVideosByLecture(lectureId);
      return res.data || [];
    },
    enabled: !!lectureId,
    staleTime: 60_000,
    cacheTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    ...options,
  });
};

export const usePdfsQuery = (lectureId, options = {}) => {
  return useQuery({
    queryKey: ["pdfs", lectureId],
    queryFn: async () => {
      const res = await pdfAPI.getPdfsByLecture(lectureId);
      return res.data || [];
    },
    enabled: !!lectureId,
    staleTime: 60_000,
    cacheTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    ...options,
  });
};
