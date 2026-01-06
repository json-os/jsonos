/**
 * jsonos - JSON Operating System
 * TypeScript definitions
 */

export interface JsonOSOptions {
  /** Base URL for storage operations */
  storage?: string;
  /** Custom fetch function (for authentication) */
  fetch?: typeof fetch;
  /** Additional prefix mappings */
  prefixes?: Record<string, string>;
}

export interface ViewLayer {
  title: string;
  completed?: boolean;
  created?: string;
  description?: string;
  isTracker?: boolean;
}

export type DataFormat = 'schema' | 'wf' | 'unknown';

export interface EnhancedItem<T = Record<string, unknown>> {
  /** Original data properties */
  [key: string]: unknown;
  /** JSON-LD identifier */
  '@id'?: string;
  /** JSON-LD type(s) */
  '@type'?: string | string[];
  /** JSON-LD context */
  '@context'?: unknown;
  /** Computed view layer */
  _view: ViewLayer;
  /** Detected format */
  _format: DataFormat;
}

export class JsonOS {
  /** Base storage URL */
  storage: string;
  /** Prefix mappings */
  prefixes: Record<string, string>;

  /**
   * Create a new JsonOS instance
   */
  constructor(options?: JsonOSOptions);

  /**
   * Read JSON-LD data from a URL
   * @param path - Path relative to storage root, or absolute URL
   * @returns Parsed JSON-LD data with view layer
   */
  read<T = Record<string, unknown>>(path: string): Promise<EnhancedItem<T>[]>;

  /**
   * Write JSON-LD data to a URL
   * @param path - Path relative to storage root, or absolute URL
   * @param data - Data to write (view layer will be stripped)
   */
  write(path: string, data: unknown[] | unknown): Promise<void>;

  /**
   * Delete a resource
   * @param path - Path to delete
   */
  delete(path: string): Promise<void>;

  /**
   * Clear the internal read cache
   */
  clearCache(): void;

  /**
   * Extract a value from an item using multiple predicate attempts
   * @param item - The item to extract from
   * @param predicates - Predicates to try in order
   * @returns The extracted value or null
   */
  extractValue(item: Record<string, unknown>, ...predicates: string[]): unknown;

  /**
   * Detect the format of JSON-LD data
   * @param data - The data to analyze
   * @returns Format identifier
   */
  detectFormat(data: unknown[]): DataFormat;
}

export default JsonOS;
