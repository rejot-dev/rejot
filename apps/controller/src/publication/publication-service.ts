import type { Counter } from "@opentelemetry/api";
import { metrics } from "@opentelemetry/api";
import type { CreatePublication } from "./publication-repository.ts";
import type { PublicationEntity } from "./publication-repository.ts";
import type { IPublicationRepository } from "./publication-repository.ts";

export interface IPublicationService {
  createPublication(
    organizationId: string,
    publication: CreatePublication,
  ): Promise<PublicationEntity>;
  getPublicationBySlug(organizationId: string, publicationSlug: string): Promise<PublicationEntity>;
  getPublicationsByOrganizationId(organizationId: string): Promise<PublicationEntity[]>;
}

export class PublicationService implements IPublicationService {
  static inject = ["publicationRepository"] as const;

  #publicationRepository: IPublicationRepository;
  #createdCounter: Counter;

  constructor(publicationRepository: IPublicationRepository) {
    this.#publicationRepository = publicationRepository;

    // Metric Initialization
    const meter = metrics.getMeter("publication.service");
    this.#createdCounter = meter.createCounter("publications_created");
  }

  async createPublication(
    organizationId: string,
    publication: CreatePublication,
  ): Promise<PublicationEntity> {
    const created = await this.#publicationRepository.create(organizationId, publication);
    this.#createdCounter.add(1);
    return created;
  }

  async getPublicationBySlug(
    organizationId: string,
    publicationSlug: string,
  ): Promise<PublicationEntity> {
    return this.#publicationRepository.get(organizationId, publicationSlug);
  }

  async getPublicationsByOrganizationId(organizationId: string): Promise<PublicationEntity[]> {
    return this.#publicationRepository.getPublicationsByOrganizationId(organizationId);
  }
}
