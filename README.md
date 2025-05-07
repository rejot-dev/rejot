![ReJot Icon](resources/rejot-icon.png)

# ReJot - Synchronization Engine

ReJot is a database‑to‑database synchronization engine designed for teams operating in distributed
architectures. When you want to move away from synchronous microservice communication, ReJot
orchestrates logical replication so services can share data without the cost and complexity of
event‑streaming platforms like Apache Kafka.

With data contracts expressed in code, developers retain full control over what and how data is
shared.

![Screenshot of ReJot's data catalog system overview](resources/rejot-system-overview.webp)

## How it works

- Data dependencies in ReJot are modeled through contracts known as **"Public Schemas"** and
  **"Consumer Schemas."**
- Public Schemas define how internal datasets are exposed, allowing teams to independently evolve
  their internal data models while maintaining the contract with consumers.
- ReJot automatically tracks dependencies on these Public Schemas and manages version deprecation.
- Consumers may require different data structures, such as for optimizing specific lookups, which is
  why they establish their own schemas to explicitly define these mappings.

### Example

This is an example of a Public Schema that exposes the first and last names of the users table. Our
Public Schemas are defined in SQL, where "$1" is the first primary key of new/updated/removed table
entries.

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

A hypothetical consumer might need a view of this data, but only cares about the full name. They
might set up their Consumer Schema as follows:

```sql
INSERT INTO
  replicated_users (id, full_name)
VALUES
  (:id, CONCAT(:first_name, ' ',:last_name))
ON CONFLICT (id) DO UPDATE
SET
  full_name = CONCAT(:first_name, ' ',:last_name)
```

ReJot's synchronization engine monitors the write-ahead log (WAL) of producer databases. Once
updates happen, it applies any transformations and upserts the changes into the consumer's
datastore. Because ReJot uses an internal, database-agnostic representation of table updates, it can
synchronize across various datastore technologies.

## Architecture Overview

The overview below shows how ReJot would operate in a microservice architecture where each service
has its own data store.

- **Sync Engine**: Consumes the write-ahead log of a data store and applies the public schema
  transformations to the rows mutated in that data store. Stores these public schema events/messages
  into the event store and handles writing the mutation to the destination data store.

- **Event Store**: Durable storage backend for public schema events.

![ReJot Architecture Overview](resources/rejot-architecture.svg)

## Contributing

We welcome contributions! Since the project is evolving rapidly, please **create an
[issue](https://github.com/rejot-dev/rejot/issues/new) before submitting a pull request** to discuss
your changes.

For any general questions, feel free to [contact us here!](https://rejot.dev/contact)
