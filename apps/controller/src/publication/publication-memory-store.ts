import type { PSResult, PublicationStore } from "./publication-store.ts";
import type { NewPublication, Publication } from "./publication.ts";

export class PublicationMemoryStore implements PublicationStore {
  private publications = new Map<string, Publication>();

  getPublicationById(id: string): Promise<PSResult<Publication>> {
    const publication = this.publications.get(id);
    if (!publication) {
      return Promise.resolve({ success: false, error: "publication_not_found" });
    }
    return Promise.resolve({ success: true, data: publication });
  }

  getPublicationByName(publicationName: string): Promise<PSResult<Publication>> {
    const publication = [...this.publications.values()]
      .find((pub) => pub.publicationName === publicationName);
    if (!publication) {
      return Promise.resolve({ success: false, error: "publication_not_found" });
    }
    return Promise.resolve({ success: true, data: publication });
  }

  createPublication(newPub: NewPublication): Promise<PSResult<string>> {
    const id = crypto.randomUUID();
    const publication: Publication = {
      ...newPub,
      id,
      metadata: {
        createdAt: Date.now(),
        version: "1.0.0",
      },
    };

    this.publications.set(id, publication);
    return Promise.resolve({ success: true, data: id });
  }
}
