#!/usr/bin/env bun

import { execute } from "@oclif/core";

await execute({ dir: import.meta.url });
