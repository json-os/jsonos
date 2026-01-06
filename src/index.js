/**
 * jsonos - JSON Operating System
 * A lightweight framework for building decentralized applications with JSON-LD
 */

// Common prefixes for predicate expansion
const PREFIXES = {
  'dc:': 'http://purl.org/dc/elements/1.1/',
  'dct:': 'http://purl.org/dc/terms/',
  'rdfs:': 'http://www.w3.org/2000/01/rdf-schema#',
  'schema:': 'http://schema.org/',
  'wf:': 'http://www.w3.org/2005/01/wf/flow#',
  'solid:': 'http://www.w3.org/ns/solid/terms#'
};

/**
 * Main JsonOS class
 */
export class JsonOS {
  /**
   * Create a new JsonOS instance
   * @param {Object} options - Configuration options
   * @param {string} [options.storage] - Base storage URL
   * @param {Function} [options.fetch] - Custom fetch function (for auth)
   * @param {Object} [options.prefixes] - Additional prefix mappings
   */
  constructor(options = {}) {
    this.storage = options.storage || '';
    this.customFetch = options.fetch || globalThis.fetch.bind(globalThis);
    this.prefixes = { ...PREFIXES, ...options.prefixes };
    this._cache = new Map();
  }

  /**
   * Read JSON-LD data from a URL
   * @param {string} path - Path relative to storage root, or absolute URL
   * @returns {Promise<Array>} Parsed JSON-LD data with view layer
   */
  async read(path) {
    const url = this._buildURL(path);

    // Check cache
    if (this._cache.has(url)) {
      return this._cache.get(url);
    }

    const response = await this.customFetch(url, {
      headers: {
        'Accept': 'application/ld+json, application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to read ${url}: ${response.status}`);
    }

    const data = await response.json();
    const normalized = Array.isArray(data) ? data : [data];
    const enhanced = this._addViewLayer(normalized);

    this._cache.set(url, enhanced);
    return enhanced;
  }

  /**
   * Write JSON-LD data to a URL
   * @param {string} path - Path relative to storage root, or absolute URL
   * @param {Array|Object} data - Data to write
   * @returns {Promise<void>}
   */
  async write(path, data) {
    const url = this._buildURL(path);

    // Strip view layer before saving
    const cleaned = this._stripViewLayer(Array.isArray(data) ? data : [data]);

    const response = await this.customFetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/ld+json'
      },
      body: JSON.stringify(cleaned, null, 2)
    });

    if (!response.ok) {
      throw new Error(`Failed to write ${url}: ${response.status}`);
    }

    // Update cache
    this._cache.set(url, this._addViewLayer(cleaned));
  }

  /**
   * Delete a resource
   * @param {string} path - Path to delete
   * @returns {Promise<void>}
   */
  async delete(path) {
    const url = this._buildURL(path);

    const response = await this.customFetch(url, {
      method: 'DELETE'
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete ${url}: ${response.status}`);
    }

    this._cache.delete(url);
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this._cache.clear();
  }

  /**
   * Extract a value from an item using multiple predicate attempts
   * @param {Object} item - The item to extract from
   * @param {...string} predicates - Predicates to try in order
   * @returns {*} The extracted value or null
   */
  extractValue(item, ...predicates) {
    for (const pred of predicates) {
      // Try both prefixed and expanded forms
      const expanded = this._expandPrefix(pred);
      const val = item[expanded] || item[pred];

      if (val !== undefined && val !== null) {
        // Handle JSON-LD value objects
        if (Array.isArray(val)) {
          return val[0]?.['@value'] ?? val[0];
        }
        if (val['@value'] !== undefined) {
          return val['@value'];
        }
        return val;
      }
    }
    return null;
  }

  /**
   * Detect the format of JSON-LD data
   * @param {Array} data - The data to analyze
   * @returns {string} Format identifier ('schema', 'wf', 'unknown')
   */
  detectFormat(data) {
    const dataStr = JSON.stringify(data);

    if (dataStr.includes('wf/flow') || dataStr.includes('wf:')) {
      return 'wf';
    }
    if (data.some(d => d['@type'] === 'Task' || d['@type'] === 'Tracker')) {
      return 'schema';
    }
    return 'unknown';
  }

  // === Private Methods ===

  _buildURL(path) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    return `${this.storage.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
  }

  _expandPrefix(predicate) {
    for (const [prefix, uri] of Object.entries(this.prefixes)) {
      if (predicate.startsWith(prefix)) {
        return predicate.replace(prefix, uri);
      }
    }
    return predicate;
  }

  _addViewLayer(data) {
    const format = this.detectFormat(data);

    return data.map(item => ({
      ...item,
      _view: this._buildView(item, format),
      _format: format
    }));
  }

  _stripViewLayer(data) {
    return data.map(({ _view, _format, ...rest }) => rest);
  }

  _buildView(item, format) {
    // Schema.org format
    if (format === 'schema') {
      return {
        title: item.title || item.name,
        completed: item.completed ?? false,
        created: item.created,
        description: item.description
      };
    }

    // wf: workflow format
    if (format === 'wf') {
      const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];

      // Check if tracker
      if (types.some(t => t && t.includes('Tracker'))) {
        return {
          title: this.extractValue(item, 'dct:title', 'dc:title', 'rdfs:label') || 'Tasks',
          isTracker: true
        };
      }

      // Determine completion from wf: states
      const openStates = ['Research', 'Someday', 'ToBeDone', 'NextSession', 'InProgress', 'Open'];
      const isOpen = types.some(t => t && openStates.some(s => t.includes(s)));

      return {
        title: this.extractValue(item, 'dc:title', 'dct:title', 'rdfs:label') || 'Untitled',
        completed: !isOpen,
        created: this.extractValue(item, 'dct:created', 'dc:created'),
        description: this.extractValue(item, 'wf:description', 'dct:description')
      };
    }

    // Unknown format - best effort
    return {
      title: item.title || item.name || item['@id'] || 'Unknown',
      completed: false
    };
  }
}

// Default export
export default JsonOS;
