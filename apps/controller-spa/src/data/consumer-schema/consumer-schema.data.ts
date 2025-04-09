import { useMutation, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";
import { fetchRouteThrowing } from "../fetch";
import {
  consumerSchemaGetApi,
  consumerSchemaListApi,
  consumerSchemaPostApi,
  ConsumerSchemaPostRequest,
  type ConsumerSchema,
  type ConsumerSchemaListItem,
} from "@rejot-dev/api-interface-controller/consumer-schema";

export function getConsumerSchemas(systemSlug: string): Promise<ConsumerSchemaListItem[]> {
  return fetchRouteThrowing(consumerSchemaListApi, { params: { systemSlug } });
}

export function useConsumerSchemas(
  systemSlug: string | null,
): UseQueryResult<ConsumerSchemaListItem[]> {
  return useQuery({
    queryKey: ["consumer-schemas", systemSlug],
    queryFn: () => getConsumerSchemas(systemSlug!),
    enabled: !!systemSlug,
  });
}

export function getConsumerSchema(
  systemSlug: string,
  consumerSchemaId: string,
): Promise<ConsumerSchema> {
  return fetchRouteThrowing(consumerSchemaGetApi, { params: { systemSlug, consumerSchemaId } });
}

export function useConsumerSchema(
  systemSlug: string | null,
  consumerSchemaId: string | null,
): UseQueryResult<ConsumerSchema> {
  return useQuery({
    queryKey: ["consumer-schema", systemSlug, consumerSchemaId],
    queryFn: () => getConsumerSchema(systemSlug!, consumerSchemaId!),
    enabled: !!systemSlug && !!consumerSchemaId,
  });
}

export type CreateConsumerSchemaMutationVariables = {
  systemSlug: string;
  dataStoreSlug: string;
  data: z.infer<typeof ConsumerSchemaPostRequest>;
};

export function createConsumerSchema({
  systemSlug,
  dataStoreSlug,
  data,
}: CreateConsumerSchemaMutationVariables): Promise<ConsumerSchema> {
  return fetchRouteThrowing(consumerSchemaPostApi, {
    params: { systemSlug, dataStoreSlug },
    body: data,
  });
}

export function useCreateConsumerSchemaMutation() {
  return useMutation({
    mutationFn: createConsumerSchema,
  });
}
