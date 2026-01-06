# jsonos

> JSON Operating System - A lightweight framework for building decentralized applications with JSON-LD

[![npm version](https://img.shields.io/npm/v/jsonos.svg)](https://www.npmjs.com/package/jsonos)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

## Features

- **Linked Data Native** - Built for JSON-LD from the ground up
- **Zero Dependencies** - Under 5KB gzipped
- **Format Agnostic** - Preserve + Layer pattern keeps original data intact
- **Solid Ready** - Works with Solid pods and any HTTP endpoint
- **TypeScript Support** - Full type definitions included

## Installation

```bash
npm install jsonos
```

Or use directly in the browser:

```html
<script type="module">
  import { JsonOS } from 'https://esm.sh/jsonos';
</script>
```

## Getting Started

```javascript
import { JsonOS } from 'jsonos';

// Initialize with your storage endpoint
const os = new JsonOS({
  storage: 'https://pod.example/data/'
});

// Read JSON-LD data
const todos = await os.read('/todos.json');
console.log(todos);

// Each item has a computed _view layer
todos.forEach(todo => {
  console.log(todo._view.title);      // Normalized title
  console.log(todo._view.completed);  // Boolean completion status
});

// Write data back
await os.write('/todos.json', todos);
```

## API Reference

### `new JsonOS(options)`

Create a new JsonOS instance.

**Options:**
- `storage` - Base URL for storage operations
- `fetch` - Custom fetch function (for authentication)
- `prefixes` - Additional prefix mappings for predicate expansion

### `os.read(path)`

Read JSON-LD data from a path. Returns an array with view layer attached.

```javascript
const data = await os.read('/tasks.json');
// Returns: [{ ...originalData, _view: { title, completed, ... }, _format: 'schema' }]
```

### `os.write(path, data)`

Write JSON-LD data. Automatically strips view layer before saving.

```javascript
await os.write('/tasks.json', tasks);
```

### `os.delete(path)`

Delete a resource.

```javascript
await os.delete('/tasks.json');
```

### `os.extractValue(item, ...predicates)`

Extract a value from an item using multiple predicate attempts. Handles JSON-LD value objects and prefix expansion.

```javascript
const title = os.extractValue(item, 'dc:title', 'dct:title', 'rdfs:label');
```

### `os.detectFormat(data)`

Detect the format of JSON-LD data. Returns `'schema'`, `'wf'`, or `'unknown'`.

### `os.clearCache()`

Clear the internal read cache.

## The Preserve + Layer Pattern

jsonos uses the "Preserve + Layer" pattern to handle different RDF formats:

```javascript
// Original data is preserved
{
  "@id": "#task1",
  "@type": ["wf:Open", "wf:Task"],
  "dc:title": "Fix bug",
  "dct:created": "2024-01-15",

  // Computed view layer added
  _view: {
    title: "Fix bug",
    completed: false,
    created: "2024-01-15"
  },
  _format: "wf"
}
```

This allows you to:
1. Display any format consistently in your UI
2. Preserve all original properties
3. Write back without losing data

## Format Support

| Format | Detection | Read | Write |
|--------|-----------|------|-------|
| Schema.org (Task/Tracker) | ✅ | ✅ | ✅ |
| wf: Workflow Ontology | ✅ | ✅ | ❌* |
| Unknown JSON-LD | ✅ | ✅ | ✅ |

*wf: format is read-only to preserve original semantics

## Using with Solid

```javascript
import { JsonOS } from 'jsonos';
import { getDefaultSession } from '@inrupt/solid-client-authn-browser';

// After authentication
const session = getDefaultSession();

const os = new JsonOS({
  storage: session.info.webId.replace('/profile/card#me', '/'),
  fetch: session.fetch
});

// Now reads/writes are authenticated
const todos = await os.read('/public/todos.json');
```

## Built-in Prefixes

jsonos expands these prefixes automatically:

| Prefix | URI |
|--------|-----|
| `dc:` | http://purl.org/dc/elements/1.1/ |
| `dct:` | http://purl.org/dc/terms/ |
| `rdfs:` | http://www.w3.org/2000/01/rdf-schema# |
| `schema:` | http://schema.org/ |
| `wf:` | http://www.w3.org/2005/01/wf/flow# |
| `solid:` | http://www.w3.org/ns/solid/terms# |

Add custom prefixes:

```javascript
const os = new JsonOS({
  prefixes: {
    'my:': 'https://example.org/vocab#'
  }
});
```

## Examples

See the [examples](./examples) directory for complete working examples:

- [Todo App](./examples/todo) - Basic CRUD operations
- [Solid Integration](./examples/solid) - Authentication with Solid pods
- [Format Detection](./examples/formats) - Reading different RDF formats

## License

AGPL-3.0-or-later
