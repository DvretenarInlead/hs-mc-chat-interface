#!/bin/sh

echo "Running database migrations..."
echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo 'yes' || echo 'NO — migrations will fail')"

# Attempt 1: Standard migration against public schema
MIGRATE_OUTPUT=$(node node_modules/prisma/build/index.js migrate deploy 2>&1)
if [ $? -eq 0 ]; then
  echo "Migrations completed successfully."
  echo "$MIGRATE_OUTPUT"
  echo "Starting server..."
  exec node server.js
fi

echo "Standard migration failed:"
echo "$MIGRATE_OUTPUT"

# Check if it's the PG 15+ "permission denied for schema public" issue
if echo "$MIGRATE_OUTPUT" | grep -q "permission denied for schema public"; then
  echo ""
  echo "Detected PostgreSQL 15+ schema permission issue."
  echo "Creating custom 'app' schema to work around this..."

  # Create the 'app' schema (doadmin has CREATE privilege on the database)
  node << 'CREATESCHEMA'
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    await p.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS app');
    console.log('Schema "app" created successfully.');
  } catch (e) {
    console.error('CREATE SCHEMA failed:', e.message);
  } finally {
    await p.$disconnect();
  }
})();
CREATESCHEMA

  # Switch DATABASE_URL to use the 'app' schema for migrations and the running server
  case "$DATABASE_URL" in
    *\?*) export DATABASE_URL="${DATABASE_URL}&schema=app" ;;
    *)    export DATABASE_URL="${DATABASE_URL}?schema=app" ;;
  esac
  echo "Switched to schema=app"

  # Retry migration with app schema
  MIGRATE_OUTPUT2=$(node node_modules/prisma/build/index.js migrate deploy 2>&1)
  if [ $? -eq 0 ]; then
    echo "Migrations succeeded with 'app' schema."
    echo "$MIGRATE_OUTPUT2"
    echo "Starting server..."
    exec node server.js
  fi

  echo "migrate deploy with app schema failed:"
  echo "$MIGRATE_OUTPUT2"

  # Last resort: prisma db push (syncs schema directly, no migration history)
  echo "Trying prisma db push as final fallback..."
  PUSH_OUTPUT=$(node node_modules/prisma/build/index.js db push --accept-data-loss 2>&1)
  if [ $? -eq 0 ]; then
    echo "db push succeeded with 'app' schema."
    echo "$PUSH_OUTPUT"
    echo "Starting server..."
    exec node server.js
  fi

  echo "All migration attempts failed:"
  echo "$PUSH_OUTPUT"
else
  # Not a schema permission issue — try db push as fallback
  echo "Trying prisma db push as fallback..."
  PUSH_OUTPUT=$(node node_modules/prisma/build/index.js db push --accept-data-loss 2>&1)
  if [ $? -eq 0 ]; then
    echo "db push succeeded."
    echo "$PUSH_OUTPUT"
    echo "Starting server..."
    exec node server.js
  fi

  echo "db push also failed:"
  echo "$PUSH_OUTPUT"
fi

echo ""
echo "Starting server anyway (database may not be fully configured)..."
exec node server.js
