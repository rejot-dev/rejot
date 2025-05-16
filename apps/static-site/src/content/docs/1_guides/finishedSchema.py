# schema.py
from pydantic import BaseModel
from rejot_contract.public_schema import (
    create_public_schema, PublicSchemaConfig, Source, Version, create_postgres_public_schema_transformation
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
        # part: publicSchemaTransformations
        # ... in myPublicSchema
        transformations=[
            create_postgres_public_schema_transformation(
                operation="insertOrUpdate",
                table="account",
                sql="SELECT id, name FROM my_table WHERE id = :id",
            ),
        ],
        # end: publicSchemaTransformations
    ),
)

public = create_public_schema(
    public_schema_name="my-public-schema",
    source=Source(dataStoreSlug="my-source-datastore"),
    output_schema=Account,
    version=Version(major=1, minor=0),
    config=PublicSchemaConfig(
        publicSchemaType="postgres",
        # part: publicSchemaTransformationsMultiTable
        # ... in myPublicSchema
        transformations=[
            create_postgres_public_schema_transformation(
                operation="insertOrUpdate",
                table="accounts",
                sql="""SELECT
                      accounts.id AS "id",
                      accounts.name AS "name",
                      addresses.country AS "country"
                    FROM
                      accounts
                      JOIN addresses ON accounts.id = addresses.account_id
                    WHERE
                      accounts.id = :id""",
            ),
            create_postgres_public_schema_transformation(
                operation="insertOrUpdate",
                table="addresses",
                sql="""SELECT
                      accounts.id AS "id",
                      accounts.name AS "name",
                      addresses.country AS "country"
                    FROM
                      accounts
                      JOIN addresses ON accounts.id = addresses.account_id
                    WHERE
                      addresses.id = :id""",
            ),
        ],
        # end: publicSchemaTransformationsMultiTable
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
        # part: consumerSchemaSql
        # ... in myConsumerSchema
        sql="INSERT INTO destination_table (id, name) VALUES (:id, :name) ON CONFLICT (id) DO UPDATE SET name = :name",
        # end: consumerSchemaSql
    ),
)
