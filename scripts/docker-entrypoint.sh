#!/bin/sh
set -eux

# Start replica
dfx start --background --log file --logfile ~/dfx.log

# Wait for replica to be ready
for i in {1..60}; do
    if dfx ping; then break; fi
    sleep 1
done

# Start nginx to serve the UI and proxy requests to dfx replica
nginx -g "daemon off;"
