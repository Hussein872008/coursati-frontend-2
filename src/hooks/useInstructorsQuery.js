import { useQuery } from "@tanstack/react-query";
import { instructorAPI } from "../utils/api";

export const useInstructorsQuery = (materialId, options = {}) => {
  return useQuery({
    queryKey: ["instructors", materialId],
    queryFn: async () => {
      const res = await instructorAPI.getInstructorsByMaterial(materialId);
      return Array.isArray(res.data)
        ? res.data
        : (res.data && res.data.items) || [];
    },
    enabled: !!materialId,
    staleTime: 60_000,
    cacheTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    ...options,
  });
};
