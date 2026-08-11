#!/usr/bin/env bash
# Day 2 end-of-day checkpoint. Thin wrapper — the logic lives in checkpoint.sh.
exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/checkpoint.sh" 2 "$@"
