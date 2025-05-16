# schema.py
from pydantic import BaseModel
from rejot_contract.public_schema import (
    create_public_schema, PublicSchemaConfig, Source, Version
)
from rejot_contract.consumer_schema import (
    create_consumer_schema, ConsumerSchemaConfig, SourceManifest, PublicSchema
)

class Account(BaseModel):
    id: int
    name: str


public = create_public_schema(
    public_schema_name="my-public-schema",
    source=Source(dataStoreSlug="my-source-datastore"),
    output_schema=Account,
    version=Version(major=1, minor=0),
    config=PublicSchemaConfig(
        publicSchemaType="postgres",
        transformations=[], # See next step
    ),
)

# Define a consumer schema
consumer = create_consumer_schema(
    "my-consumer-schema",
    source=SourceManifest(
        manifestSlug="my-manifest",
        publicSchema=PublicSchema(
            name="my-public-schema",
            majorVersion=1,
        ),
    ),
    config=ConsumerSchemaConfig(
        consumerSchemaType="postgres",
        destinationDataStoreSlug="my-destination-datastore",
        sql="", # See next step
    ),
)
