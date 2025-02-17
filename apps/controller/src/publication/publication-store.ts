import type { NewPublication, Publication } from "./publication.ts";

export type PublicationStoreError = "publication_not_found" | "publication_already_exists";

export type PSSuccess<T> = {
  success: true;
  data: T;
  error?: never;
};

export type PSError = {
  success: false;
  error: PublicationStoreError;
  data?: never;
};

export type PSResult<T> = PSSuccess<T> | PSError;

export interface PublicationStore {
  getPublicationById(id: string): Promise<PSResult<Publication>>;
  getPublicationByName(publicationName: string): Promise<PSResult<Publication>>;
  createPublication(publication: NewPublication): Promise<PSResult<string>>;
}
