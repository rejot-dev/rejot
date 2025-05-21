from pydantic import BaseModel
from typing import List
from rejot_contract.public_schema import (
    create_public_schema, Source, Version, PublicSchemaConfig, create_postgres_public_schema_transformation
)
from rejot_contract.consumer_schema import (
    create_consumer_schema, SourceManifest, PublicSchema, ConsumerSchemaConfig
)

# Output schema for the public schema
class OnePerson(BaseModel):
    id: int
    firstName: str
    lastName: str
    emails: List[str]

one_person_schema_json = {
  "type": "object",
  "properties": {
    "id": {
      "type": "integer"
    },
    "firstName": {
      "type": "string"
    },
    "lastName": {
      "type": "string"
    },
    "emails": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  },
  "required": ["id", "firstName", "lastName", "emails"]
}

postgres_config = PublicSchemaConfig(
        publicSchemaType="postgres",
        transformations=[
            *create_postgres_public_schema_transformation(
                operation="insertOrUpdate",
                table="person",
                sql=(
                    'SELECT p.id, p.first_name as "firstName", p.last_name as "lastName", ' +
                    'COALESCE(array_agg(e.email) FILTER (WHERE e.email IS NOT NULL), \'{}\') as emails ' +
                    'FROM rejot_integration_tests_python_bun.person p ' +
                    'LEFT JOIN rejot_integration_tests_python_bun.person_email e ON p.id = e.person_id ' +
                    'WHERE p.id = :id ' +
                    'GROUP BY p.id, p.first_name, p.last_name'
                )
            ),
            *create_postgres_public_schema_transformation(
                operation="insertOrUpdate",
                table="person_email",
                sql=(
                    'SELECT p.id, p.first_name as "firstName", p.last_name as "lastName", ' +
                    'COALESCE(array_agg(e.email) FILTER (WHERE e.email IS NOT NULL), \'{}\') as emails ' +
                    'FROM rejot_integration_tests_python_bun.person p ' +
                    'LEFT JOIN rejot_integration_tests_python_bun.person_email e ON p.id = e.person_id ' +
                    'WHERE p.id = (SELECT person_id FROM rejot_integration_tests_python_bun.person_email WHERE id = :id) ' +
                    'GROUP BY p.id, p.first_name, p.last_name'
                )
            ),
        ]
    )


one_person_schema_from_json = create_public_schema(
  public_schema_name="one-person-json",
  source=Source(dataStoreSlug="main-connection"),
  output_schema=one_person_schema_json,
  version=Version(major=1, minor=0),
  config=postgres_config
)

# Public schema definition
one_person_schema = create_public_schema(
    public_schema_name="one-person",
    source=Source(dataStoreSlug="main-connection"),
    output_schema=OnePerson,
    version=Version(major=1, minor=0),
    config=postgres_config
)

# Consumer schema definition
consume_python_bun_person_schema = create_consumer_schema(
    name="consume-one-person",
    source=SourceManifest(
        manifestSlug="python-bun",
        publicSchema=PublicSchema(name="one-person", majorVersion=1)
    ),
    config=ConsumerSchemaConfig(
        consumerSchemaType="postgres",
        destinationDataStoreSlug="main-connection",
        sql='''
              INSERT INTO rejot_integration_tests_python_bun.destination_person_email
        (id, name, emails)
      VALUES
        (:id, :firstName || ' ' || :lastName, array_to_string(:emails::text[], ','))
            ON CONFLICT (id) DO UPDATE
                SET name = :firstName || ' ' || :lastName,
                    emails = array_to_string(:emails::text[], ',');
        ''',
        deleteSql="DELETE FROM rejot_integration_tests_python_bun.destination_person_email WHERE id = :id"
    )
)
