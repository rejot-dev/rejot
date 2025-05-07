---
title: Architecture
---

The overview below shows how ReJot would operate in a microservice architecture where each service
has its own data store.

- **Sync Engine**: Consumes the write-ahead log of a data store and applies the public schema
  transformations to the rows mutated in that data store. Stores these public schema events/messages
  into the event store and handles writing the mutation to the destination data store.

- **Event Store**: Durable storage backend for public schema events.

![ReJot Architecture Overview](/content/docs/rejot-architecture.svg)
