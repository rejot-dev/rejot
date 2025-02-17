import type { Counter } from "@opentelemetry/api";
import type { PublicationStore } from "./publication-store.ts";
import type { NewPublication } from "./publication.ts";
import { metrics } from "@opentelemetry/api";

export class PublicationService {
  static inject = ["publicationStore"] as const;

  #publicationStore: PublicationStore;

  // Metrics
  #createdCounter: Counter;

  constructor(publicationStore: PublicationStore) {
    this.#publicationStore = publicationStore;

    // Metric Initialization
    const meter = metrics.getMeter("publication.service");
    this.#createdCounter = meter.createCounter("publications_created");
  }

  getPublicationById(id: string) {
    return this.#publicationStore.getPublicationById(id);
  }

  getPublicationByName(name: string) {
    return this.#publicationStore.getPublicationByName(name);
  }

  createPublication(publication: NewPublication) {
    const created = this.#publicationStore.createPublication(publication);
    return created.then((publication) => {
      if (publication.success) {
        this.#createdCounter.add(1);
      }
      return publication;
    });
  }
}
