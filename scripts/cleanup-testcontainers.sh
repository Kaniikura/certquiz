#!/bin/bash

# Cleanup script for Testcontainers using native Docker label filtering
# This removes reusable containers that persist between test runs

echo "🧹 Cleaning up reusable Testcontainers..."

# Remove reusable containers (those created with .withReuse())
echo "Removing reusable containers..."
docker container prune -f --filter label=testcontainers.reuse.enabled=true

# Remove associated volumes
echo "Removing reusable volumes..."
docker volume prune -f --filter label=testcontainers.reuse.enabled=true

# Optional: Remove ALL testcontainers (including non-reusable) if requested
if [ "$1" = "--all" ]; then
    echo ""
    echo "🔥 Removing ALL testcontainers (including non-reusable)..."
    docker container prune -f --filter label=testcontainers=true
    docker volume prune -f --filter label=testcontainers=true
fi

echo ""
echo "✅ Cleanup complete! Your next test run will start fresh."
echo ""
echo "💡 Tips:"
echo "  - Use 'bun run test:cleanup' for reusable containers only"
echo "  - Use 'bun run test:cleanup -- --all' to remove ALL testcontainers"
echo "  - Ryuk handles non-reusable containers automatically"