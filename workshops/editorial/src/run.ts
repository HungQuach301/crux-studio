#!/usr/bin/env node
import { runWorkshopCli } from '@crux/kernel';
import { definition } from './index.ts';

await runWorkshopCli(definition);
