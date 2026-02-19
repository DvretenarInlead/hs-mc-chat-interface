#!/bin/sh

echo "Running database migrations..."
echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo 'yes' || echo 'NO — migrations will fail')"

# Capture migration output so we can see the actual error
MIGRATE_OUTPUT=$(node node_modules/prisma/build/index.js migrate deploy 2>&1)
MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -eq 0 ]; then
  echo "Migrations completed successfully."
  echo "$MIGRATE_OUTPUT"
else
  echo ""
  echo "============================================"
  echo "WARNING: Database migration failed! (exit code: $MIGRATE_EXIT)"
  echo "============================================"
  echo "Migration output:"
  echo "$MIGRATE_OUTPUT"
  echo "============================================"
  echo ""
  echo "Trying prisma db push as fallback..."
  PUSH_OUTPUT=$(node node_modules/prisma/build/index.js db push --accept-data-loss 2>&1)
  PUSH_EXIT=$?
  if [ $PUSH_EXIT -eq 0 ]; then
    echo "db push succeeded — tables created."
    echo "$PUSH_OUTPUT"
  else
    echo "db push also failed:"
    echo "$PUSH_OUTPUT"
    echo ""
    echo "The app will start anyway. Fix the database and redeploy."
  fi
fi

echo "Starting server..."
exec node server.js
