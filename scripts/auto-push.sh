#!/bin/bash

# Auto-answer drizzle push prompts
echo "Starting drizzle-kit push with auto-answer..."

# Use printf to send newline (select first option) when prompted
printf '\n' | npx drizzle-kit push

echo "Migration complete!"