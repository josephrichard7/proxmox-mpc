# Import Order Style Guide

## Standardized TypeScript Import Order

This project follows a standardized import order pattern enforced by ESLint rules.

### Import Groups (in order):

1. **Node.js Built-ins** - Standard library modules
   ```typescript
   import * as fs from 'fs';
   import * as path from 'path';
   import * as readline from 'readline';
   ```

2. **External Dependencies** - Third-party packages
   ```typescript
   import axios from 'axios';
   import { Command } from 'commander';
   import { PrismaClient } from '@prisma/client';
   ```

3. **Internal Project Modules** - Relative imports (ordered by distance)
   ```typescript
   import { ProxmoxClient } from '../api';
   import { Logger } from '../../observability/logger';
   import { VMRepository } from './base-repository';
   ```

4. **Type-only Imports** - Grouped by same distance pattern
   ```typescript
   import type { ProxmoxConfig } from '../types';
   ```

### Key Rules:

- **Blank lines** separate import groups
- **Alphabetical order** within each group (case-insensitive)
- **Type-only imports** can be mixed with regular imports or grouped separately
- **Consistent spacing** and formatting

### ESLint Configuration:

```javascript
'import/order': ['warn', {
  'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
  'newlines-between': 'always',
  'alphabetize': { order: 'asc', caseInsensitive: true }
}]
```

### Auto-formatting:

Run `npm run lint -- --fix` to automatically fix import ordering issues.

## Examples:

### ✅ Good:
```typescript
import * as fs from 'fs';
import * as path from 'path';

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

import { Logger } from '../observability/logger';
import { ProxmoxConfig } from '../types';
```

### ❌ Bad:
```typescript
import axios from 'axios';
import { Logger } from '../observability/logger';  
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
```