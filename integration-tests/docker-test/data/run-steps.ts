import { execSync, spawn } from "node:child_process";
import process from "node:process";

function printStep(msg: string) {
  console.log("\n=== " + msg + " ===\n");
}

function step(cmd: string, desc: string) {
  printStep(desc);
  try {
    const result = execSync(cmd, { stdio: "inherit", env: process.env });
    return result;
  } catch (err) {
    console.error(`\n[ERROR] ${desc}`);
    if (err.stdout) process.stdout.write(err.stdout);
    if (err.stderr) process.stderr.write(err.stderr);
    console.error(err);
    process.exit(1);
  }
}

const { REJOT_DB_1, REJOT_DB_2 } = process.env;
if (!REJOT_DB_1 || !REJOT_DB_2) {
  console.error("REJOT_DB_1 and REJOT_DB_2 environment variables must be set.");
  process.exit(1);
}

step(`rejot-cli manifest init --slug "rejot-test-"`, "Initialize manifest");
step(
  `rejot-cli manifest connection add --slug source --connection-string ${REJOT_DB_1}`,
  "Add source connection",
);
step(
  `rejot-cli manifest connection add --slug sink --connection-string ${REJOT_DB_2}`,
  "Add sink connection",
);
step(
  `rejot-cli manifest datastore add --connection source --publication my_rejot_publication --slot my_rejot_slot`,
  "Add source as a datastore",
);
// step(`rejot-cli manifest datastore add --connection source`, "Add source as a datastore");
step(`rejot-cli manifest datastore add --connection sink`, "Add sink as a datastore");
step(
  `rejot-cli collect --write data/example-public-schema.ts data/example-consumer-schema.ts`,
  "Collect schemas",
);
step(`apt update && apt install -y postgresql-client`, "Install PostgreSQL client");
step(`psql "${REJOT_DB_1}" -f data/source-init.sql`, "Initialize source database");
step(`psql "${REJOT_DB_2}" -f data/sink-init.sql`, "Initialize sink database");

// Start sync in the background
printStep("Start sync in background");
const syncProcess = spawn(
  "rejot-cli",
  ["manifest", "sync", "--log-level=trace", "./rejot-manifest.json"],
  {
    stdio: "inherit",
    env: process.env,
    detached: true,
  },
);

process.on("SIGINT", () => {
  console.log("\nCaught SIGINT, killing background sync process...");
  if (syncProcess && !syncProcess.killed && syncProcess.pid !== undefined) {
    try {
      process.kill(-syncProcess.pid, "SIGTERM"); // negative PID kills the process group
    } catch (_e) {
      // ignore if already dead
    }
  }
  process.exit(1);
});

// Insert data into source tables: one account, two emails
step(
  `psql "${REJOT_DB_1}" -c "INSERT INTO account (first_name, last_name) VALUES ('Alice', 'Smith') RETURNING id;"`,
  "Insert account into source",
);
// Get the inserted account id
const accountIdOut = execSync(
  `psql "${REJOT_DB_1}" -t -c "SELECT id FROM account WHERE first_name = 'Alice' AND last_name = 'Smith' ORDER BY id DESC LIMIT 1;"`,
  { encoding: "utf-8", env: process.env },
);
const accountId = accountIdOut.trim();
if (!accountId) {
  console.error("Failed to get inserted account id");
  process.exit(1);
}
step(
  `psql "${REJOT_DB_1}" -c "INSERT INTO account_emails (account_id, email) VALUES (${accountId}, 'alice1@example.com'), (${accountId}, 'alice2@example.com');"`,
  "Insert emails into source",
);

await new Promise((resolve) => setTimeout(resolve, 1000));

// Query the sink table
step(`psql "${REJOT_DB_2}" -c "SELECT * FROM account_destination;"`, "Query sink table");
