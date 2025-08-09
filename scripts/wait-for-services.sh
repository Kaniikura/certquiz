#!/bin/bash
# Wait for services to be ready script
# Usage: ./scripts/wait-for-services.sh [service1,service2,...]
# Default: Wait for both API and Web services

set -e

# Default services to wait for
SERVICES="${1:-api,web}"

# Service endpoints
declare -A ENDPOINTS=(
    ["api"]="http://localhost:4001/health/ready"
    ["web"]="http://localhost:5173"
)

# Service descriptions
declare -A DESCRIPTIONS=(
    ["api"]="CertQuiz API (with database check)"
    ["web"]="SvelteKit Web App"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Waiting for services to be ready...${NC}"
echo

# Parse services list
IFS=',' read -ra SERVICE_ARRAY <<< "$SERVICES"

# Wait for each service
for service in "${SERVICE_ARRAY[@]}"; do
    service=$(echo "$service" | tr -d ' ') # Remove whitespace
    
    if [[ -z "${ENDPOINTS[$service]}" ]]; then
        echo -e "${RED}❌ Unknown service: $service${NC}"
        echo "Available services: ${!ENDPOINTS[*]}"
        exit 1
    fi
    
    endpoint="${ENDPOINTS[$service]}"
    description="${DESCRIPTIONS[$service]}"
    
    echo -e "${YELLOW}⏳ Waiting for $service service...${NC}"
    echo "   Endpoint: $endpoint"
    echo "   Description: $description"
    
    if npx wait-on "$endpoint" -t 30000; then
        echo -e "${GREEN}✅ $service service is ready!${NC}"
    else
        echo -e "${RED}❌ $service service failed to start within 30 seconds${NC}"
        exit 1
    fi
    echo
done

echo -e "${GREEN}🎉 All requested services are ready!${NC}"
echo "Services checked: $SERVICES"