#!/bin/sh

echo "Running database migrations..."

# Run migrations — don't exit on failure so the app can still start
# (allows health checks to pass while you fix DB permissions)
if node node_modules/prisma/build/index.js migrate deploy; then
  echo "Migrations completed successfully."
else
  echo ""
  echo "============================================"
  echo "WARNING: Database migration failed!"
  echo "============================================"
  echo "If this is a permissions error on PostgreSQL 15+, connect to"
  echo "your database as an admin and run:"
  echo ""
  echo "  GRANT ALL ON SCHEMA public TO your_db_user;"
  echo "  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO your_db_user;"
  echo "  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO your_db_user;"
  echo ""
  echo "Then redeploy. The app will attempt to start anyway."
  echo "============================================"
  echo ""
fi

echo "Starting server..."
exec node server.js
