# Database Setup Guide

## Prerequisites

1. Install Turso CLI: https://docs.turso.tech/cli/installation
2. Sign up for Turso: https://turso.tech

## Setup Steps

### 1. Create Turso Database

```bash
# Sign up/login to Turso
turso auth signup
# or
turso auth login

# Create database
turso db create makerbench-db

# Get database URL
turso db show --url makerbench-db

# Create auth token
turso db tokens create makerbench-db

# Start an interactive SQL shell with:
turso db shell makerbench-db
```

### 2. Environment Variables

Create a `.env` file in the project root with:

```env
# Turso Database Configuration
VITE_TURSO_DATABASE_URL=libsql://your-database-name.turso.io
VITE_TURSO_AUTH_TOKEN=your-auth-token-here

# Algolia Configuration (for search)
VITE_ALGOLIA_APP_ID=your-algolia-app-id
VITE_ALGOLIA_SEARCH_API_KEY=your-algolia-search-api-key
VITE_ALGOLIA_ADMIN_API_KEY=your-algolia-admin-api-key

# AWS S3 Configuration (for screenshot storage)
VITE_AWS_ACCESS_KEY_ID=your-aws-access-key
VITE_AWS_SECRET_ACCESS_KEY=your-aws-secret-key
VITE_AWS_REGION=us-east-1
VITE_AWS_S3_BUCKET=your-screenshot-bucket-name

# Browserless Configuration (for screenshots)
VITE_BROWSERLESS_API_KEY=your-browserless-api-key
```

**Note:** Vite requires environment variables to be prefixed with `VITE_` to be exposed to the client-side code.

### 3. Generate and Run Migrations

```bash
# Generate migrations from schema
npm run db:generate

# Apply migrations to database
npm run db:migrate

# (Optional) Open Drizzle Studio to view data
npm run db:studio
```

## Database Schema

The application uses three main tables:

- **bookmarks**: Stores URL bookmarks with metadata
- **tags**: Stores tag definitions
- **bookmark_tags**: Many-to-many relationship between bookmarks and tags

## Features

- **Approval Workflow**: Bookmarks start as 'pending' and require admin approval
- **Tag-based Search**: Search bookmarks by associated tags
- **Metadata Storage**: JSON metadata for screenshots and additional info
- **Indexed Queries**: Optimized for fast tag-based and text-based searches
