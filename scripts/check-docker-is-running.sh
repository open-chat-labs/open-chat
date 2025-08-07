#!/bin/bash

if ! docker info > /dev/null 2>&1; then
  echo "This script requires docker, but it isn't running - please start docker and try again"
  exit 1
fi