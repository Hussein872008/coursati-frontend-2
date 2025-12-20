import { useState, useEffect, useRef, useCallback } from 'react';
import { searchAPI } from '../utils/api';

export default function useGlobalSearch(initial = '') {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const debRef = useRef(null);

  const search = useCallback(async (q) => {
    if (!q || q.trim() === '') {
      setResults({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await searchAPI.globalSearch(q);
      setResults(res.data.results || {});
    } catch (e) {
      setResults({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debRef.current);
  }, [query, search]);

  return { query, setQuery, results, loading, clear: () => setQuery('') };
}
