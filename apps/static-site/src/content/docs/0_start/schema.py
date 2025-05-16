# schema.py
from pydantic import BaseModel
from rejot_contract.public_schema import (
    create_public_schema, PublicSchemaConfig, Source, Version, create_postgres_public_schema_transformation
)
from rejot_contract.consumer_schema import (
    create_consumer_schema, ConsumerSchemaConfig, SourceManifest, PublicSchema
)

class ApiKey(BaseModel):
    id: int
    api_key: str


public = create_public_schema(
    public_schema_name="my-public-schema",
    source=Source(dataStoreSlug="my-db"),
    output_schema=ApiKey,
    version=Version(major=1, minor=0),
    config=PublicSchemaConfig(
        publicSchemaType="postgres",
        transformations=[
            create_postgres_public_schema_transformation(
                operation="insertOrUpdate",
                table="api_key",
                sql="SELECT id, key AS 'api_key' FROM api_key WHERE id = :id",
            ),
        ],
    ),
)

# Define a consumer schema
consumer = create_consumer_schema(
    "my-consumer-schema",
    source=SourceManifest(
        manifestSlug="my-sync-project",
        publicSchema=PublicSchema(
            name="my-public-schema",
            majorVersion=1,
        ),
    ),
    config=ConsumerSchemaConfig(
        consumerSchemaType="postgres",
        destinationDataStoreSlug="my-db",
        sql="INSERT INTO target_table (id, api_key) VALUES (:id, :api_key) ON CONFLICT (id) DO UPDATE SET api_key = :api_key",
    ),
)
