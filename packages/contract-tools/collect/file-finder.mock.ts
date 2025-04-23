import type { IFileFinder, SearchOptions, SearchResult } from "./file-finder";

export class MockFileFinder implements IFileFinder {
  private mockResults: SearchResult[] = [];

  constructor(mockResults: SearchResult[] = []) {
    this.mockResults = mockResults;
  }

  async searchInDirectory(
    _dir: string,
    _searchTerms: string[],
    _options?: SearchOptions,
  ): Promise<SearchResult[]> {
    return Promise.resolve(this.mockResults);
  }

  setMockResults(results: SearchResult[]) {
    this.mockResults = results;
  }
}
