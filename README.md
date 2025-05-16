![ReJot Icon](resources/rejot-icon.png)

# ReJot - Synchronization Engine

ReJot is a developer defined database-to-database replication engine designed for teams operating in
distributed architectures. ReJot's asynchronous model improves reliability and reduces latency
compared to synchronous inter-service communication.

With data contracts defined in code, developers retain full control over what data is shared and how
it is shared. Define what to publish and consume using your database's query language, just like
defining tables or writing migrations. ReJot fits naturally into your development workflow.

![Screenshot of ReJot's data catalog system overview](resources/rejot-system-overview.webp)

## Why ReJot?

- **Asynchronous**: Stop chaining fragile service calls. ReJot decouples communication by allowing
  data to flow asynchronously between services, using your database's changelog as the queue. It's
  reliable, resilient, and naturally tolerant to failure, unlike synchronous APIs.
- **Lightweight by Design**: No brokers, no partitions, no outboxes. ReJot avoids the operational
  overhead of event streaming platforms by reusing your existing infrastructure. You get the
  benefits of asynchronous communication without the extra complexity.
- **Developer-Defined**: With ReJot, you define what to publish and consume using your database's
  query language, similar to defining your tables or writing a migration. It lives in your codebase
  and fits naturally into your development workflow.

## Quickstart

Get started with ReJot through `rejot-cli`. You'll need to have [Node.js](https://nodejs.org/) or
[Bun](https://bun.sh) installed to run it.

```bash
npm install -g @rejot-dev/cli
```

Run with:

```bash
rejot-cli --help
```

Then head over to our [Quickstart Guide!](https://rejot.dev/docs/start/quickstart/)

## How it works

- Data dependencies in ReJot are modeled through Data Contracts known as **Public Schemas** and
  **Consumer Schemas**. These contracts are defined by developers in code.
- Public Schemas define how internal datasets are exposed, allowing teams to independently evolve
  their internal data models while maintaining the contract with consumers.
- Consumers at the same time can ingest these data sources by setting up a Consumer Schema.
- ReJot connects to the publishing data store's write-ahead-log and pushes changes to Public schemas
  to the data stores on the consuming side.
- An intermediate event store is used as durable storage to store these updates.

## Example

Here is an example of how ReJot uses SQL to define Public and Consumer schemas. In this example, the
data publisher decides to expose the first and last names of their users table:

```sql
SELECT
  "id",
  "first_name",
  "last_name"
FROM
  users
WHERE
  id = $1
```

(note that `$1` is a placeholder for the primary key)

A consumer might need a view of this data but only cares about the full name. They could set up
their Consumer Schema as follows:

```sql
INSERT INTO
  replicated_users (id, full_name)
VALUES
  (:id, CONCAT(:first_name, ' ',:last_name))
ON CONFLICT (id) DO UPDATE
SET
  full_name = CONCAT(:first_name, ' ',:last_name)
```

ReJot monitors the WAL (Write-Ahead Log) of the producing database, and any changes to tables
included in the Public Schema are distributed to consumers.

## Architecture Overview

The overview below shows how ReJot operates in a microservice architecture where each service has
its own data store.

- **Sync Engine**: Consumes the write-ahead log of a data store and applies the public schema
  transformations to the rows changed in that data store. It stores these public schema
  events/messages in the event store and handles writing the mutations to the destination data
  store.
- **Event Store**: A durable storage backend for public schema events.

![ReJot Architecture Overview](resources/rejot-architecture.svg)

## Contributing

We welcome contributions! Since the project is evolving rapidly, please **create an
[issue](https://github.com/rejot-dev/rejot/issues/new) before submitting a pull request** to discuss
your changes first.

For any general questions, feel free to [contact us here](https://rejot.dev/contact).
