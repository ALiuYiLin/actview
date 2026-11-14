#!/usr/bin/env node
import { runCli } from '../dist/node/cli.js'

runCli().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
