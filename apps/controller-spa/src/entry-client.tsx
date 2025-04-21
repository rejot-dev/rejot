import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);

/*
// If we ever do SSR.
ReactDOM.hydrateRoot(
  document.getElementById("root") as HTMLElement,
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
*/
