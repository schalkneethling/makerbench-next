# Project Structure

## Root Directory

```
├── src/                    # Source code
├── public/                 # Static assets
├── migrations/             # Database migrations
├── netlify/               # Netlify functions (when created)
├── .kiro/                 # Kiro configuration and specs
└── dist/                  # Build output (generated)
```

## Source Code Organization (`src/`)

```
src/
├── db/                    # Database layer
│   ├── schema.ts         # Drizzle schema definitions
│   ├── index.ts          # Database connection setup
│   ├── utils.ts          # Database utilities
│   ├── errors.ts         # Database error handling
│   └── queries/          # Query functions
│       ├── bookmarks.ts  # Bookmark-related queries
│       └── tags.ts       # Tag-related queries
├── assets/               # Static assets (images, icons)
├── App.tsx              # Main application component
├── main.tsx             # Application entry point
└── index.css            # Global styles
```

## Database Schema

- **bookmarks** - Main bookmark entries with approval status
- **tags** - Tag definitions for categorization
- **bookmark_tags** - Many-to-many relationship table

## Configuration Files

- `drizzle.config.ts` - Database configuration
- `vite.config.ts` - Build tool configuration
- `netlify.toml` - Deployment configuration
- `tsconfig.*.json` - TypeScript configuration
- `.env` - Environment variables (not committed)

## Naming Conventions

- **Files**: kebab-case for directories, camelCase for TypeScript files
- **Components**: PascalCase for React components
- **Database**: snake_case for table and column names
- **Types**: PascalCase with descriptive prefixes (Insert*, Select*)

## Key Patterns

- Database operations centralized in `src/db/queries/`
- Type-safe database operations using Drizzle ORM
- Serverless functions for backend processing
- Environment-based configuration for database connections
