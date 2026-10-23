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
exec /usr/local/bin/notification_pusher_aws
