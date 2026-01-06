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

// wf: state mapping
const WF_STATES = {
  'Research': { label: 'Research', color: '#9ca3af', open: true },
  'Someday': { label: 'Someday', color: '#9ca3af', open: true },
  'ToBeDone': { label: 'To Do', color: '#10b981', open: true },
  'NextSession': { label: 'Next', color: '#22c55e', open: true },
  'InProgress': { label: 'In Progress', color: '#f59e0b', open: true },
  'Open': { label: 'Open', color: '#3b82f6', open: true },
  'Works': { label: 'Works', color: '#8b5cf6', open: false },
  'Released': { label: 'Released', color: '#ec4899', open: false },
  'Done': { label: 'Done', color: '#10b981', open: false }
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
   * Render data to the DOM
   * @param {Array} data - Data with view layer
   * @param {HTMLElement|string} [container] - Container element or selector (defaults to body)
   */
  render(data, container = document.body) {
    const target = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!target) {
      throw new Error(`Container not found: ${container}`);
    }

    // Detect format and pick renderer
    const format = data[0]?._format || this.detectFormat(data);
    const items = data.filter(d => d._view?.title && !d._view?.isTracker);

    // Find tracker for title
    const tracker = data.find(d => d._view?.isTracker || d['@type'] === 'Tracker');
    const title = tracker?._view?.title || tracker?.title || 'Items';

    // Build HTML
    const html = `
      <div class="jsonos-container" data-format="${format}">
        <h2 class="jsonos-title">${this._escapeHtml(title)}</h2>
        <ul class="jsonos-list">
          ${items.map(item => this._renderItem(item)).join('')}
        </ul>
        ${items.length === 0 ? '<p class="jsonos-empty">No items</p>' : ''}
      </div>
    `;

    target.innerHTML = html;
    this._injectStyles();
  }

  _renderItem(item) {
    const view = item._view;
    const completedClass = view.completed ? 'jsonos-completed' : '';
    const stateHtml = view.state
      ? `<span class="jsonos-state" style="background:${view.state.color}20;color:${view.state.color};border-color:${view.state.color}40">${this._escapeHtml(view.state.label)}</span>`
      : '';

    return `
      <li class="jsonos-item ${completedClass}" data-id="${item['@id'] || ''}">
        <span class="jsonos-checkbox">${view.completed ? '✓' : ''}</span>
        <span class="jsonos-item-title">${this._escapeHtml(view.title)}</span>
        ${stateHtml}
      </li>
    `;
  }

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _injectStyles() {
    if (document.getElementById('jsonos-styles')) return;

    const style = document.createElement('style');
    style.id = 'jsonos-styles';
    style.textContent = `
      .jsonos-container { font-family: system-ui, sans-serif; max-width: 600px; margin: 2rem auto; }
      .jsonos-title { font-size: 1.5rem; margin-bottom: 1rem; color: #1e293b; }
      .jsonos-list { list-style: none; padding: 0; margin: 0; }
      .jsonos-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border-bottom: 1px solid #e2e8f0; }
      .jsonos-item.jsonos-completed { opacity: 0.6; }
      .jsonos-item.jsonos-completed .jsonos-item-title { text-decoration: line-through; }
      .jsonos-checkbox { width: 20px; height: 20px; border: 2px solid #e2e8f0; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #10b981; }
      .jsonos-item.jsonos-completed .jsonos-checkbox { background: #10b981; border-color: #10b981; color: white; }
      .jsonos-item-title { flex: 1; }
      .jsonos-state { font-size: 0.7rem; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid; font-weight: 600; }
      .jsonos-empty { color: #64748b; text-align: center; padding: 2rem; }
    `;
    document.head.appendChild(style);
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

      // Find state from types
      let state = null;
      for (const t of types) {
        if (!t) continue;
        for (const [key, value] of Object.entries(WF_STATES)) {
          if (t.includes(key)) {
            state = { key, ...value };
            break;
          }
        }
        if (state) break;
      }

      return {
        title: this.extractValue(item, 'dc:title', 'dct:title', 'rdfs:label') || 'Untitled',
        completed: state ? !state.open : false,
        created: this.extractValue(item, 'dct:created', 'dc:created'),
        description: this.extractValue(item, 'wf:description', 'dct:description'),
        state: state
      };
    }

    // Unknown format - best effort
    return {
      title: item.title || item.name || item['@id'] || 'Unknown',
      completed: false
    };
  }
}

// Default instance for quick usage: import os from 'jsonos'
const os = new JsonOS();

// Default export is the instance
export default os;
