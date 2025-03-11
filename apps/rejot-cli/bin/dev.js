#!/usr/bin/env bun --disable-warning=ExperimentalWarning

import { execute } from "@oclif/core";

await execute({ development: true, dir: import.meta.url });
