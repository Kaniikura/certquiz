#!/usr/bin/env bash

# Fail fast on any error, unset var or pipe failure
set -euo pipefail
IFS=$'\n\t'

# Cleanup script for Testcontainers using native Docker label filtering
# This removes reusable containers that persist between test runs

echo "🧹 Cleaning up reusable Testcontainers..."

# Stop and remove running reusable containers first
echo "Stopping & removing running reusable containers..."
running_reusable=$(docker ps -q --filter label=testcontainers.reuse.enabled=true || true)
if [ -n "$running_reusable" ]; then
  docker rm -f $running_reusable
fi

# Prune any remaining stopped reusable containers
echo "Removing stopped reusable containers..."
docker container prune -f --filter label=testcontainers.reuse.enabled=true

# Remove associated volumes
echo "Removing reusable volumes..."
docker volume prune -f --filter label=testcontainers.reuse.enabled=true

# Optional: Remove ALL testcontainers (including non-reusable) if requested
if [ "$1" = "--all" ]; then
    echo ""
    echo "🔥 Removing ALL testcontainers (including non-reusable)..."
    
    # Stop & remove ALL running Testcontainers (reusable + non-reusable)
    all_running=$(docker ps -q --filter label=testcontainers=true || true)
    if [ -n "$all_running" ]; then
        echo "Stopping running testcontainers..."
        docker rm -f $all_running
    fi
    
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