/**
 * Lifted from hc-patient-dashboard
 *   src/main/webapp/app/core/request/request.model.ts @ 12e418c
 * Divergence: none
 * Re-sync: see PROVENANCE.md.
 */

export interface Pagination {
  page: number;
  size: number;
  sort: string[];
}

export interface Search {
  query: string;
}

export interface SearchWithPagination extends Search, Pagination {}
