"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { say } from "@/lib/messages";

export default function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loader = useRef(load);
  loader.current = load;

  const reload = useCallback(async () => {
    setError(null);
    try {
      const loaded = await loader.current();
      setData(loaded);
    } catch (failure) {
      setError(say(failure, "불러오지 못했어요"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}
