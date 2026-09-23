#!/bin/bash
cd "$(dirname "$0")"
export NODE_PATH=/opt/node22/lib/node_modules
node capture.js "$@"
