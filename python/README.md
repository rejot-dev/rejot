# ReJot Python Contracts

This directory contains the Python variant for defining and working with ReJot public and consumer
schemas. It is intended for use in projects that need to define data contracts and transformations
for use with the ReJot platform. For the latest documentation, see the
[ReJot Python Contracts](https://rejot.dev/docs/reference/python).

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
    create_public_schema, PublicSchemaConfig, PostgresPublicSchemaConfigTransformation, Source, Version, create_postgres_public_schema_transformation
)
from rejot_contract.consumer_schema import (
    create_consumer_schema, ConsumerSchemaConfig, SourceManifest, PublicSchema
)

class Account(BaseModel):
    id: int
    email: str
    name: str

# Use the helper to create transformations for insertOrUpdate
transformations = create_postgres_public_schema_transformation(
    operation="insertOrUpdate",
    table="account",
    sql="INSERT INTO account (id, email, name) VALUES (:id, :email, :name)",
)

# Define a public schema
public = create_public_schema(
    public_schema_name="public-account",
    source=Source(dataStoreSlug="default-postgres"),
    output_schema=Account, # Or a JSON schema dict
    version=Version(major=1, minor=0),
    config=PublicSchemaConfig(
        publicSchemaType="postgres",
        transformations=transformations,
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
- `create_postgres_public_schema_transformation(...)` — Helper to generate transformation steps for
  common Postgres operations
- `PublicSchemaConfig` — Configuration for public schema (type, transformations)
- `PostgresPublicSchemaConfigTransformation` — Transformation step for Postgres
- `Source` — Source data store slug
- `Version` — Schema version

### Consumer Schema

- `create_consumer_schema(...)` — Create a consumer schema definition
- `ConsumerSchemaConfig` — Configuration for consumer schema (type, destination, SQL)
- `SourceManifest` — Reference to a public schema in a manifest
- `PublicSchema` — Reference to a public schema

### create_postgres_public_schema_transformation

Helper to generate transformation steps for common Postgres operations.

**Signature:**

```python
def create_postgres_public_schema_transformation(
    operation: Literal["insertOrUpdate", "delete"],
    table: str,
    sql: str
) -> List[PostgresPublicSchemaConfigTransformation]
```

- For `insertOrUpdate`, returns both insert and update transformations.
- For `delete`, returns a delete transformation.
- Raises `ValueError` for invalid operations.

**Example:**

```python
transformations = create_postgres_public_schema_transformation(
    operation="insertOrUpdate",
    table="account",
    sql="INSERT INTO account (id, email, name) VALUES (:id, :email, :name)",
)
```

## Project Structure

- `src/rejot_contract/public_schema.py` — Public schema definitions and helpers
- `src/rejot_contract/consumer_schema.py` — Consumer schema definitions and helpers

## License

Apache 2.0 — see [LICENSE](LICENSE)
