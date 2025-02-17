import { useEffect, useState } from "react";

export function useWebSocket() {
  const [message, setMessage] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket("_ws");
    ws.onopen = () => {
      console.info("WebSocket opened :)");
    };
    ws.onmessage = (event) => {
      console.info("WebSocket message", event);
      setMessage(event.data);
    };
    ws.onerror = (event) => {
      console.error("error", event);
    };
    setWs(ws);
    return () => {
      ws.close();
    };
  }, []);

  return { message, ws };
}
