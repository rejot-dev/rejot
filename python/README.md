# ReJot Python Contracts

This directory contains the Python variant for defining and working with ReJot public and consumer
schemas. It is intended for use in projects that need to define data contracts and transformations
for use with the ReJot platform.

## Features

- Define public schemas for data publication (e.g., from a Postgres table)
- Define consumer schemas for data consumption and transformation
- Pydantic-based schema definitions for type safety
- Simple API for schema creation and validation

## Installation

Requires Python 3.9 or higher.

```bash
pip install rejot-contract
```

## Usage

```python
from pydantic import BaseModel
from rejot_contract.public_schema import (
    create_public_schema, PublicSchemaConfig, PostgresPublicSchemaConfigTransformation, Source, Version
)
from rejot_contract.consumer_schema import (
    create_consumer_schema, ConsumerSchemaConfig, SourceManifest, PublicSchema
)

class Account(BaseModel):
    id: int
    email: str
    name: str

# Define a public schema
public = create_public_schema(
    public_schema_name="public-account",
    source=Source(dataStoreSlug="default-postgres"),
    output_schema=Account,
    version=Version(major=1, minor=0),
    config=PublicSchemaConfig(
        publicSchemaType="postgres",
        transformations=[
            PostgresPublicSchemaConfigTransformation(
                operation="insert",
                table="account",
                sql="INSERT INTO account (id, email, name) VALUES (:id, :email, :name)",
            )
        ],
    ),
)

# Define a consumer schema
consumer = create_consumer_schema(
    "consume-public-account",
    source=SourceManifest(
        manifestSlug="@rejot/",
        publicSchema=PublicSchema(
            name="public-account",
            majorVersion=1,
        ),
    ),
    config=ConsumerSchemaConfig(
        consumerSchemaType="postgres",
        destinationDataStoreSlug="default-postgres",
        sql="INSERT INTO users_destination (id, full_name) VALUES (:id, :email || ' ' || :name) ON CONFLICT (id) DO UPDATE SET full_name = :email || ' ' || :name",
        deleteSql="DELETE FROM users_destination WHERE id = :id",
    ),
)
```

## API Reference

### Public Schema

- `create_public_schema(...)` — Create a public schema definition
- `PublicSchemaConfig` — Configuration for public schema (type, transformations)
- `PostgresPublicSchemaConfigTransformation` — Transformation step for Postgres
- `Source` — Source data store slug
- `Version` — Schema version

### Consumer Schema

- `create_consumer_schema(...)` — Create a consumer schema definition
- `ConsumerSchemaConfig` — Configuration for consumer schema (type, destination, SQL)
- `SourceManifest` — Reference to a public schema in a manifest
- `PublicSchema` — Reference to a public schema

## Project Structure

- `src/rejot_contract/public_schema.py` — Public schema definitions and helpers
- `src/rejot_contract/consumer_schema.py` — Consumer schema definitions and helpers

## License

Apache 2.0 — see [LICENSE](LICENSE)
