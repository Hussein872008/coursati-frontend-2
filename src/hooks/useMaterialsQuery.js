import { useQuery } from "@tanstack/react-query";
import { materialAPI } from "../utils/api";

export const useMaterialsQuery = (options = {}) => {
  return useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const res = await materialAPI.getAllMaterials();
      return res.data || [];
    },
    staleTime: 60_000,
    cacheTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    ...options,
  });
};
