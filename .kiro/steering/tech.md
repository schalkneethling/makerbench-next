# Technology Stack

## Frontend

- **React 19.1.0** - UI framework with TypeScript
- **Vite 6.3.5** - Build tool and dev server
- **TypeScript 5.8.3** - Type safety and modern JavaScript features

## Backend & Database

- **Turso (libSQL)** - Serverless SQLite database
- **Drizzle ORM 0.44.2** - Type-safe database operations
- **Netlify Functions** - Serverless backend processing

## External Services

- **Browserless** - Screenshot generation service
- **AWS S3** - Image storage
- **Cheerio** - Server-side HTML parsing

## Development Tools

- **ESLint** - Code linting with React-specific rules
- **Prettier** - Code formatting
- **Stylelint** - CSS linting
- **Drizzle Kit** - Database migrations and studio

## Common Commands

### Development

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Database Operations

```bash
npm run db:generate  # Generate database migrations
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Drizzle Studio (database GUI)
```

### Code Quality

```bash
npm run lint         # Run ESLint
npm run lint:css     # Run Stylelint for CSS files
```

## Environment Variables

- `VITE_TURSO_DATABASE_URL` - Turso database connection URL
- `VITE_TURSO_AUTH_TOKEN` - Turso authentication token
