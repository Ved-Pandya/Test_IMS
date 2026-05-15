import { useEffect, useState } from "react";
import { subscribeToAuth } from "../firebase/auth";

export function useAuth() {
  const [state, setState] = useState({ user: null, profile: null, loading: true });

  useEffect(() => {
    const unsubscribe = subscribeToAuth(({ user, profile }) => {
      setState({ user, profile, loading: false });
    });

    return () => unsubscribe();
  }, []);

  return state;
}
