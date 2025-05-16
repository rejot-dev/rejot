from typing import Optional, TypeVar, Literal, Any
from pydantic import BaseModel

class InvalidConsumerSchemaError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.name = "InvalidConsumerSchemaError"

class Version(BaseModel):
    major: int
    minor: int

class ConsumerSchemaConfig(BaseModel):
    consumerSchemaType: Literal["postgres"]
    destinationDataStoreSlug: str
    sql: str
    deleteSql: Optional[str] = None

class PublicSchema(BaseModel):
    name: str
    majorVersion: int

class SourceManifest(BaseModel):
    manifestSlug: str
    publicSchema: PublicSchema

class CreateConsumerSchemaOptions(BaseModel):
    source: SourceManifest
    config: ConsumerSchemaConfig
    definitionFile: Optional[str] = None

class ConsumerSchemaData(BaseModel):
    name: str
    sourceManifestSlug: str
    publicSchema: PublicSchema
    definitionFile: Optional[str] = None
    config: ConsumerSchemaConfig

T = TypeVar('T', bound=BaseModel)

def validate_consumer_schema(source: SourceManifest, config: ConsumerSchemaConfig, definitionFile: Optional[str] = None) -> None:
    """
    Validate the consumer schema configuration.

    Args:
        source: The source manifest for the public schema.
        config: The configuration for the consumer schema.
        definitionFile: The file path to the definition file for the consumer schema.

    Raises:
        InvalidConsumerSchemaError: If the consumer schema configuration is invalid.
    """

    if not source.manifestSlug or len(source.manifestSlug) == 0:
        raise InvalidConsumerSchemaError("Source manifest slug cannot be empty")
    if not source.publicSchema.name or len(source.publicSchema.name) == 0:
        raise InvalidConsumerSchemaError("Public schema name cannot be empty")
    if not config.destinationDataStoreSlug or len(config.destinationDataStoreSlug) == 0:
        raise InvalidConsumerSchemaError("Destination data store slug cannot be empty")
    if not config.sql or len(config.sql) == 0:
        raise InvalidConsumerSchemaError("Consumer schema must have a SQL transformation")

def create_consumer_schema(
    name: str,
    source: SourceManifest,
    config: ConsumerSchemaConfig,
    definitionFile: Optional[str] = None
) -> dict[str, Any]:
    """
    Create a consumer schema definition for consuming and transforming data.

    Args:
        name: The name of the consumer schema.
        source: The source manifest for the public schema.
        config: The configuration for the consumer schema.
        definitionFile: The file path to the definition file for the consumer schema.

    Returns:
        A json schema dictionary representing the consumer schema.
    """
  
    validate_consumer_schema(source, config, definitionFile)
    return ConsumerSchemaData(
        name=name,
        sourceManifestSlug=source.manifestSlug,
        publicSchema=source.publicSchema,
        definitionFile=definitionFile,
        config=config
    ).model_dump(exclude_none=True)
