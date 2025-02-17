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
      <div className="mx-auto flex max-w-sm items-center space-x-4 rounded-xl bg-white p-6 shadow-lg">
        <Button>Click me!</Button>
      </div>
    </div>
  );
}
