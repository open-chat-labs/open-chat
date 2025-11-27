#!/bin/sh
set -eux

# Start replica
dfx start --background --log file --logfile ~/dfx.log
echo "🚀 DFX replica running!"

# Start nginx to serve the UI and proxy requests to dfx replica
nginx -g "daemon off;"
echo "🚀 Nginx running!"
