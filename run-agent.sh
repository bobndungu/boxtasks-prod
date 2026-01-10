#!/bin/bash
# run-agent.sh - BoxTasks2 Agentic Loop Auto-Continue Runner
#
# This script automatically continues the Claude agentic loop until
# all features are complete or a blocking error occurs.
#
# Usage:
#   ./run-agent.sh           # Run with default 100 iterations
#   ./run-agent.sh 50        # Run with 50 iterations max
#   ./run-agent.sh --resume  # Resume from last session

set -e

MAX_ITERATIONS="${1:-100}"
ITERATION=0
DELAY=5
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  BOXTASKS2 AGENTIC LOOP STARTING${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""
echo -e "Project: ${GREEN}BoxTasks2${NC}"
echo -e "Directory: ${PROJECT_DIR}"
echo -e "Max iterations: ${MAX_ITERATIONS}"
echo ""

# Check if feature_list.json exists to determine mode
if [ -f "${PROJECT_DIR}/feature_list.json" ]; then
    echo -e "${YELLOW}Mode: CODING AGENT (feature_list.json exists)${NC}"

    # Show current progress
    TOTAL=$(grep -c '"id":' "${PROJECT_DIR}/feature_list.json" 2>/dev/null || echo "0")
    COMPLETED=$(grep -c '"status": "completed"' "${PROJECT_DIR}/feature_list.json" 2>/dev/null || echo "0")
    BLOCKED=$(grep -c '"status": "blocked"' "${PROJECT_DIR}/feature_list.json" 2>/dev/null || echo "0")

    echo -e "Progress: ${GREEN}${COMPLETED}${NC}/${TOTAL} completed, ${RED}${BLOCKED}${NC} blocked"
else
    echo -e "${YELLOW}Mode: INITIALIZER (first run)${NC}"
fi
echo ""

# Function to check if all features are complete
check_complete() {
    if [ -f "${PROJECT_DIR}/feature_list.json" ]; then
        # Check if there are any pending or in_progress features
        if grep -q '"status": "pending"' "${PROJECT_DIR}/feature_list.json" || \
           grep -q '"status": "in_progress"' "${PROJECT_DIR}/feature_list.json"; then
            return 1
        fi
        return 0
    fi
    return 1
}

# Function to check if any feature is blocked
check_blocked() {
    if [ -f "${PROJECT_DIR}/feature_list.json" ]; then
        if grep -q '"status": "blocked"' "${PROJECT_DIR}/feature_list.json"; then
            return 0
        fi
    fi
    return 1
}

# Function to show progress
show_progress() {
    if [ -f "${PROJECT_DIR}/feature_list.json" ]; then
        TOTAL=$(grep -c '"id":' "${PROJECT_DIR}/feature_list.json" 2>/dev/null || echo "0")
        COMPLETED=$(grep -c '"status": "completed"' "${PROJECT_DIR}/feature_list.json" 2>/dev/null || echo "0")
        IN_PROGRESS=$(grep -c '"status": "in_progress"' "${PROJECT_DIR}/feature_list.json" 2>/dev/null || echo "0")
        BLOCKED=$(grep -c '"status": "blocked"' "${PROJECT_DIR}/feature_list.json" 2>/dev/null || echo "0")

        PERCENT=0
        if [ "$TOTAL" -gt 0 ]; then
            PERCENT=$((COMPLETED * 100 / TOTAL))
        fi

        echo -e "Progress: [${GREEN}${COMPLETED}${NC} completed | ${YELLOW}${IN_PROGRESS}${NC} in progress | ${RED}${BLOCKED}${NC} blocked] ${PERCENT}%"
    fi
}

# Main loop
while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))

    echo ""
    echo -e "${BLUE}==========================================${NC}"
    echo -e "${BLUE}  ITERATION ${ITERATION} / ${MAX_ITERATIONS}${NC}"
    echo -e "${BLUE}  $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${BLUE}==========================================${NC}"

    show_progress
    echo ""

    # Run Claude with appropriate prompt
    if [ $ITERATION -eq 1 ]; then
        echo -e "${YELLOW}Starting agentic loop...${NC}"
        claude --dangerously-skip-permissions \
            "Read CLAUDE.md and execute the agentic loop. Start with INITIALIZER MODE if feature_list.json doesn't exist, otherwise CODING AGENT MODE. Reference ~/Sites/DrupalDev/BoxTasks/ for the original implementation patterns."
    else
        echo -e "${YELLOW}Continuing agentic loop...${NC}"
        claude --dangerously-skip-permissions --continue \
            "Continue the agentic loop. Read feature_list.json, implement the next pending feature, test with Playwright browser tools, commit, and continue. Reference the original BoxTasks at ~/Sites/DrupalDev/BoxTasks/ for implementation patterns."
    fi

    # Check completion status
    if check_complete; then
        echo ""
        echo -e "${GREEN}==========================================${NC}"
        echo -e "${GREEN}  ALL FEATURES COMPLETE!${NC}"
        echo -e "${GREEN}==========================================${NC}"
        show_progress
        echo ""
        echo "BoxTasks2 build completed successfully."
        exit 0
    fi

    # Check for blocked features
    if check_blocked; then
        echo ""
        echo -e "${RED}==========================================${NC}"
        echo -e "${RED}  STOPPED: Feature blocked${NC}"
        echo -e "${RED}==========================================${NC}"
        show_progress
        echo ""
        echo "Check feature_list.json for blocked feature details."
        echo ""
        echo "To resume after fixing:"
        echo "  1. Fix the issue manually"
        echo "  2. Update feature_list.json status to 'pending'"
        echo "  3. Run: ./run-agent.sh"
        exit 1
    fi

    # Short delay between iterations
    echo ""
    echo -e "${YELLOW}Waiting ${DELAY} seconds before next iteration...${NC}"
    sleep $DELAY
done

echo ""
echo -e "${YELLOW}==========================================${NC}"
echo -e "${YELLOW}  MAX ITERATIONS REACHED${NC}"
echo -e "${YELLOW}==========================================${NC}"
show_progress
echo ""
echo "Run ./run-agent.sh again to continue."
exit 0
