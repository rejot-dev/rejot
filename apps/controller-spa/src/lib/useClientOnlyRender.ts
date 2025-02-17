import { useEffect, useState } from "react";

export function useClientOnlyRender(): boolean {
  const [rendered, setRendered] = useState(false);
  useEffect(() => {
    setRendered(true);
  }, []);
  return rendered;
}
