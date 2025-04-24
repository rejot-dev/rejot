---
title: Documentation
---

Welcome to the ReJot documentation!

Check out our [Quickstart guide](/docs/start/quickstart) to setup sync.

## What is ReJot?

ReJot is a database to database synchronization engine and data catalog for enterprises with
distributed architectures and teams. Our aim is to replace event sourcing and gRPC/REST as a means
of sharing data between (micro)services.

Services use their existing database as an interface for remote datasets. Data owners can publish
datasets in a shared catalog, allowing other teams to consume them. Our sync engine tracks changes
to these datasets and propagates updates to consumer database in real time.

## How does it work?

- Data dependencies in ReJot are modeled through contracts known as
  **[Public Schemas](/docs/spec/public-schema)** and
  **[Consumer Schemas](/docs/spec/consumer-schema)**.
- Public Schemas define how internal datasets are exposed, allowing teams to independently evolve
  their internal data models while maintaining the contract with consumers.
- ReJot automatically tracks dependencies on these Public Schemas and manages version deprecation.
- Consumers may require different data structures, such as for optimizing specific lookups, which is
  why they establish their own schemas to explicitly define these mappings.
