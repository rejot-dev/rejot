#!/bin/bash

# 1. List all packages
# 2. Filter packages defined in the workspace
# 3. Strip all information but the path
# 4. Sort the packages
# 5. Format as JSON array
NO_COLOR=1 bun pm ls | grep "@workspace:" | cut -d ':' -f 2 | sort | jq -cR '[inputs]'
