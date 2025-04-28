---
title: Architecture
---

- **Control plane**: Services publish their public schema to the data catalog for other services in
  the organization to consume. Keeps track of clients subscribed to these schemas and orchestrates
  the sync engine(s) to move data where needed.
- **Sync Engine**: Consumes the write-ahead log of a data store and pushes updates to published
  schemas to clients subscribed to those schemas. This data is made available to services in their
  local data store.

![ReJot Architecture Overview](/content/docs/rejot-diagram.svg)
