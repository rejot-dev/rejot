![ReJot Icon](resources/rejot-icon.png)

# ReJot - Synchronization Engine

ReJot is a database to database synchronization engine and data catalog for enterprises with distributed architectures and teams.
Our aim is to replace event sourcing and gRPC/REST as a means of sharing data between (micro)services.

Services use their existing database as an interface for remote datasets.
Data owners can publish datasets in a shared catalog, allowing other teams to consume them. Our sync engine tracks changes to these datasets and propagates updates to consumer database in real time.

**Find our hosted solution here:** [app.rejot.dev](https://app.rejot.dev/)

## Open Source Release

We are open-sourcing all components of our platform in this repository. Currently, we have released our control plane application, with plans to open-source the synchronization engine in the near future.

## Architecture Overview

- **Control plane**: Services publish their public schema to the data catalog for other services in the organization to consume. Keeps track of clients subscribed to these schemas and orchestrates the sync engine(s) to move data where needed.
- **Sync Engine**: Consumes the write-ahead-log of a data store and pushes updates to published schemas to clients subscribed to those schemas. This data is made available to services in their local data store.

![ReJot Architecture Overview](resources/rejot-diagram.svg)

## Project Structure

This monorepo will contain all components needed to operate ReJot.

```
rejot/
├── apps/
│   ├── controller/      # Control plane API Server
│   └── controller-spa/  # Control plane UI
└── packages/            # Shared libraries
```

## Design Partner

We're looking for design partners in need of a better distributed architecture. You can [contact us here!](https://rejot.dev/contact)

## Contributing

We welcome contributions! Since the project is evolving rapidly, please **create an [issue](https://github.com/rejot-dev/rejot/issues/new) before submitting a pull request** to discuss your changes.
