import ReactDOMServer from "react-dom/server";

export function simpleUI(serviceName: string, data: Record<string, string>) {
  const html = (
    <html>
      <head>
        <title>{serviceName}</title>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css"
        />
      </head>
      <body>
        <h1>{serviceName}: Operational</h1>
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data).map(([key, value]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </body>
    </html>
  );

  return new Response(`<!DOCTYPE html>${ReactDOMServer.renderToString(html)}`, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
