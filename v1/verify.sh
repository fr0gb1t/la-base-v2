#!/bin/bash

echo "🔍 La Base - Verification Script"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# Check Docker
echo "📦 Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not installed${NC}"
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✓ Docker installed${NC}"
fi

# Check Docker Compose
echo ""
echo "📦 Checking Docker Compose..."
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not installed${NC}"
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✓ Docker Compose available${NC}"
fi

# Check containers are running
echo ""
echo "🐳 Checking containers..."
if docker compose ps | grep -q "la-base-server"; then
    echo -e "${GREEN}✓ Server running${NC}"
else
    echo -e "${RED}✗ Server not running${NC}"
    FAILED=$((FAILED + 1))
fi

if docker compose ps | grep -q "la-base-client"; then
    echo -e "${GREEN}✓ Client running${NC}"
else
    echo -e "${RED}✗ Client not running${NC}"
    FAILED=$((FAILED + 1))
fi

if docker compose ps | grep -q "la-base-db"; then
    echo -e "${GREEN}✓ Database running${NC}"
else
    echo -e "${RED}✗ Database not running${NC}"
    FAILED=$((FAILED + 1))
fi

# Check server health
echo ""
echo "🏥 Checking server health..."
HEALTH=$(curl -s -w "%{http_code}" http://localhost:3000/health -o /dev/null)
if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✓ Server responding (HTTP $HEALTH)${NC}"
else
    echo -e "${RED}✗ Server not responding (HTTP $HEALTH)${NC}"
    FAILED=$((FAILED + 1))
fi

# Check database connectivity
echo ""
echo "💾 Checking database..."
DB_RESULT=$(docker compose logs postgres 2>/dev/null | grep -c "database system is ready")
if [ "$DB_RESULT" -gt 0 ]; then
    echo -e "${GREEN}✓ Database initialized${NC}"
else
    echo -e "${RED}✗ Database not ready${NC}"
    FAILED=$((FAILED + 1))
fi

# Check client is serving
echo ""
echo "🌐 Checking client..."
CLIENT=$(curl -s -w "%{http_code}" http://localhost:5173 -o /dev/null)
if [ "$CLIENT" = "200" ]; then
    echo -e "${GREEN}✓ Client serving (HTTP $CLIENT)${NC}"
else
    echo -e "${RED}✗ Client not responding (HTTP $CLIENT)${NC}"
    FAILED=$((FAILED + 1))
fi

# Test auth endpoint
echo ""
echo "🔐 Checking authentication..."
AUTH=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"verify@test.com","username":"verify","password":"password123"}' \
  -w "%{http_code}" -o /tmp/auth_response.json)

if grep -q '"token"' /tmp/auth_response.json; then
    echo -e "${GREEN}✓ Auth endpoint working${NC}"
else
    echo -e "${RED}✗ Auth endpoint failed${NC}"
    FAILED=$((FAILED + 1))
fi

# Test rankings endpoint
echo ""
echo "📊 Checking rankings..."
RANKINGS=$(curl -s -w "%{http_code}" http://localhost:3000/api/rankings -o /dev/null)
if [ "$RANKINGS" = "200" ]; then
    echo -e "${GREEN}✓ Rankings endpoint working (HTTP $RANKINGS)${NC}"
else
    echo -e "${RED}✗ Rankings endpoint failed (HTTP $RANKINGS)${NC}"
    FAILED=$((FAILED + 1))
fi

# Summary
echo ""
echo "================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Ready to test the application:"
    echo "  → Open http://localhost:5173 in your browser"
    echo "  → Register a user or play as guest"
    echo "  → Create a room and invite friends"
    exit 0
else
    echo -e "${RED}❌ $FAILED checks failed${NC}"
    echo ""
    echo "To fix issues:"
    echo "  1. Check if containers are running: docker compose ps"
    echo "  2. View logs: docker compose logs"
    echo "  3. Restart: docker compose restart"
    exit 1
fi
