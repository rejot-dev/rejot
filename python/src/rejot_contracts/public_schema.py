from typing import List, Literal, Union, Optional, Type, TypeVar
from pydantic import BaseModel, Field, ValidationError

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
    outputSchema: dict
    version: Version
    config: PublicSchemaConfig

T = TypeVar('T', bound=BaseModel)

def create_public_schema(
    public_schema_name: str,
    source: Source,
    output_schema: Type[T],
    version: Version,
    config: PublicSchemaConfig
) -> PublicSchemaData:
    if not config.transformations:
        raise InvalidPublicSchemaError("Public schema must have at least one transformation")

    json_schema = output_schema.schema()

    return PublicSchemaData(
        name=public_schema_name,
        source=source,
        outputSchema=json_schema,
        version=version,
        config=config
    ).model_dump(exclude_none=True)
