import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocalFirst } from "@/first/LocalFirstContext";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { useEffect, useState } from "react";

import { useWebSocket } from "@/first/use-web-socket";

type SomeJson = {
  "some json"?: boolean;
  "extra data"?: number[];
};

function Nested() {
  const [val] = useLocalStorage("test", "Default Value");

  return <>{val}</>;
}

function Nested2() {
  const thing = useLocalFirst("result");

  return <>{thing.asd}</>;
}

export default function TestComponent() {
  const { message } = useWebSocket();

  const [someJson, setSomeJson] = useState<SomeJson>({
    "some json": true,
  });

  const handleClick = () => {
    console.info("clicked");

    setSomeJson({ ...someJson, "extra data": [1, 2, 3, 4, 5] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Nested /> - <Nested2 /> - <p>{message}</p>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <code>
          <pre>{JSON.stringify(someJson, null, 2)}</pre>
        </code>
      </CardContent>
      <CardFooter className="border-t px-6 py-4">
        <Button onClick={handleClick}>Save</Button>
      </CardFooter>
    </Card>
  );
}
