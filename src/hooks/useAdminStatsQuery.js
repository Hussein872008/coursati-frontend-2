import { useQuery } from "@tanstack/react-query";
import { adminAPI } from "../utils/api";

export const useAdminStatsQuery = (options = {}) => {
  return useQuery({
    queryKey: ["adminStats"],
    queryFn: async () => {
      const res = await adminAPI.getStats();
      return res.data?.totals || {};
    },
    staleTime: 60_000,
    cacheTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
    ...options,
  });
};
