import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

async function loader() {
  "use server";

  console.info("Access database");

  return "hello from server.";
}

export default function Counter() {
  const [, setLoaderData] = useState("");
  useEffect(() => {
    async function loadData() {
      const l = await loader();
      setLoaderData(l);
    }
    loadData();
  }, []);

  return (
    <div>
      <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-lg flex items-center space-x-4">
        <Button>Click me!</Button>
      </div>
    </div>
  );
}
