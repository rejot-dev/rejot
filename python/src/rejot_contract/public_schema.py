from typing import List, Literal, Type, TypeVar, Any, Union
from pydantic import BaseModel

class InvalidPublicSchemaError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.name = "InvalidPublicSchemaError"

class PostgresPublicSchemaConfigTransformation(BaseModel):
    operation: Literal["insert", "update", "delete"]
    table: str
    sql: str

class Version(BaseModel):
    major: int
    minor: int

class PublicSchemaConfig(BaseModel):
    publicSchemaType: Literal["postgres"]
    transformations: List[PostgresPublicSchemaConfigTransformation]

class Source(BaseModel):
    dataStoreSlug: str

class PublicSchemaData(BaseModel):
    name: str
    source: Source
    outputSchema: dict[str, Any]
    version: Version
    config: PublicSchemaConfig

T = TypeVar('T', bound=BaseModel)

def create_postgres_public_schema_transformation(
    operation: Literal["insertOrUpdate", "delete"],
    table: str,
    sql: str
) -> List[PostgresPublicSchemaConfigTransformation]:
    """
    Create a list of PostgresPublicSchemaConfigTransformation objects for a given operation.

    Args:
        operation: The operation to create the transformation for.
        table: The table to create the transformation for.
        sql: The SQL statement to create the transformation for.

    Returns:
        A list of PostgresPublicSchemaConfigTransformation objects.
    """

    if operation == "insertOrUpdate":
        return [
            PostgresPublicSchemaConfigTransformation(operation="insert", table=table, sql=sql),
            PostgresPublicSchemaConfigTransformation(operation="update", table=table, sql=sql),
        ]
    elif operation == "delete":
        return [
            PostgresPublicSchemaConfigTransformation(operation="delete", table=table, sql=sql),
        ]
    else:
        raise ValueError(f"Invalid operation: {operation}")

def create_public_schema(
    public_schema_name: str,
    source: Source,
    output_schema: Union[Type[T], dict[str, Any]],
    version: Version,
    config: PublicSchemaConfig
) -> dict[str, Any]:
    """
    Create a public schema definition for a given output schema.

    Args:
        public_schema_name: The name of the public schema.
        source: The source of the public schema.
        output_schema: The output schema of the public schema (Pydantic model class or raw JSON schema dict).
        version: The version of the public schema.
        config: The configuration of the public schema.

    Returns:
        A json schema dictionary representing the public schema.
    """

    if not config.transformations:
        raise InvalidPublicSchemaError("Public schema must have at least one transformation")

    if isinstance(output_schema, dict):
        json_schema = output_schema
    else:
        json_schema = output_schema.schema()

    return PublicSchemaData(
        name=public_schema_name,
        source=source,
        outputSchema=json_schema,
        version=version,
        config=config
    ).model_dump(exclude_none=True)
