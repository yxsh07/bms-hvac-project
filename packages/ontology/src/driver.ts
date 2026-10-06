/**
 * OntologyDriver — pluggable loader interface.
 *
 * Implementations may load from disk (JsonOntologyDriver), a database,
 * an API, or an in-memory fixture for testing.
 */

import type { Ontology } from './types.js';

export interface OntologyDriver {
  /**
   * Load the ontology graph for the given site.
   *
   * @param siteId  Site identifier; implementations may use this to select
   *                the correct data source or validate the loaded graph.
   * @returns       Resolved Ontology graph.
   * @throws        If the source cannot be read or the data is invalid.
   */
  load(siteId: string): Promise<Ontology>;
}
