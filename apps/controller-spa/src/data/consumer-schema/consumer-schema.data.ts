import { useMutation, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { z } from "zod";
import { fetchRouteThrowing } from "../fetch";
import {
  consumerSchemaGetApi,
  consumerSchemaListApi,
  consumerSchemaPostApi,
  ConsumerSchemaPostRequest,
  ConsumerSchemaSchema,
  type ConsumerSchema,
  type ConsumerSchemaListItem,
} from "@rejot/api-interface-controller/consumer-schema";

export function getConsumerSchemas(systemSlug: string): Promise<ConsumerSchemaListItem[]> {
  return fetchRouteThrowing(consumerSchemaListApi, { params: { systemSlug } });
}

export function useConsumerSchemas(
  systemSlug: string | null,
): UseQueryResult<ConsumerSchemaListItem[]> {
  return useQuery({
    queryKey: ["consumerSchemas", systemSlug],
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
  systemSlug: string,
  consumerSchemaId: string,
): UseQueryResult<ConsumerSchema> {
  return useQuery({
    queryKey: ["consumerSchema", systemSlug, consumerSchemaId],
    queryFn: () => getConsumerSchema(systemSlug, consumerSchemaId),
    enabled: !!systemSlug && !!consumerSchemaId,
  });
}

export type CreateConsumerSchemaMutationVariables = {
  systemSlug: string;
  dataStoreSlug: string;
  data: z.infer<typeof ConsumerSchemaPostRequest>;
};

export function createConsumerSchema(
  variables: CreateConsumerSchemaMutationVariables,
): Promise<z.infer<typeof ConsumerSchemaSchema>> {
  return fetchRouteThrowing(consumerSchemaPostApi, {
    params: { systemSlug: variables.systemSlug, dataStoreSlug: variables.dataStoreSlug },
    body: variables.data,
  });
}

export function useCreateConsumerSchemaMutation() {
  return useMutation({
    mutationFn: createConsumerSchema,
  });
}
