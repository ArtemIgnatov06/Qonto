import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5050/api/me', {
        credentials: 'include'
      });
      const data = await res.json();
      setUser(data.user || null);
    } catch (e) {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  return { user, refresh: fetchMe };
}
