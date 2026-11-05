#!/bin/sh
# The pusher reads its settings from .env and Firebase's service account from a file, so this
# writes both from the secrets ECS passes in, ENV_FILE and GCLOUD_SA_JSON, then runs it
set -eu
umask 077
printf '%s' "$ENV_FILE" > .env
printf '%s' "$GCLOUD_SA_JSON" > gcloud-sa.json
unset ENV_FILE GCLOUD_SA_JSON
# Set here, as .env doesn't override variables which are already set
export GCLOUD_SA_JSON_PATH="$PWD/gcloud-sa.json"
# The APNs key, once the task is given one. Without it the pusher skips iOS devices.
if [ -n "${APNS_KEY_P8:-}" ]; then
  printf '%s' "$APNS_KEY_P8" > apns-key.p8
  unset APNS_KEY_P8
  export APNS_KEY_PATH="$PWD/apns-key.p8"
fi
exec /usr/local/bin/notification_pusher_aws
