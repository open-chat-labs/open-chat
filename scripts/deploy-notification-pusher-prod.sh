#!/bin/bash
set -euo pipefail

NEW_VERSION="$1"
EC2_USER="$2"
EC2_HOST="$3"
EC2_SSH_KEY_PATH="$4"

remote_cmd() {
    ssh -i "$EC2_SSH_KEY_PATH" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "$@"
}

# Name of the package/service being deployed
PACKAGE_NAME="notification_pusher_aws"
SERVICE_NAME="notification-pusher"
# A static binary for the host, an arm64 (t4g) instance
TARGET="aarch64-unknown-linux-musl"

# Remote paths
REMOTE_SERVICE_DIR_NAME="notification_pusher"
REMOTE_SERVICE_PATH="/home/$EC2_USER/$REMOTE_SERVICE_DIR_NAME"
LATEST_VERSION_PATH="$REMOTE_SERVICE_PATH/latest"
NEW_VERSION_PATH="$REMOTE_SERVICE_PATH/$NEW_VERSION"
CURRENT_VERSION_PATH=$(remote_cmd readlink -f "$LATEST_VERSION_PATH" 2>/dev/null || echo "")

# A service which crashes soon after starting still looks active at first, so this checks it's
# still running a while later, with the same process
service_stays_up() {
    sleep 2
    local pid
    pid=$(remote_cmd systemctl show -p MainPID --value $SERVICE_NAME) || return 1
    sleep 15
    [[ "$pid" != "0" ]] \
        && remote_cmd sudo systemctl is-active --quiet $SERVICE_NAME \
        && [[ "$(remote_cmd systemctl show -p MainPID --value $SERVICE_NAME)" == "$pid" ]]
}

# If the deploy fails, the new version's directory is removed so the version can be deployed
# again, unless the service was left running it
NEW_VERSION_PATH_CREATED=false
remove_new_version_on_failure() {
    local status=$?
    if [[ $status -ne 0 && "$NEW_VERSION_PATH_CREATED" == true ]] \
        && [[ "$(remote_cmd readlink "$LATEST_VERSION_PATH" || true)" != "$NEW_VERSION_PATH" ]]; then
        echo "Removing $NEW_VERSION_PATH..."
        remote_cmd rm -rf "$NEW_VERSION_PATH" || true
    fi
}
trap remove_new_version_on_failure EXIT

# --- Pre-flight checks ---
# Make sure version directory doesn't already exist
echo "Checking if version directory already exists..."
if remote_cmd "[ -d \"$NEW_VERSION_PATH\" ]"; then
    echo "❌ Version directory $NEW_VERSION_PATH already exists!"
    exit 1
fi

# The new version takes the .env of the version running now
if [[ -z "$CURRENT_VERSION_PATH" ]] || ! remote_cmd "[ -e \"$CURRENT_VERSION_PATH/.env\" ]"; then
    echo "❌ No .env file found in previous version ($CURRENT_VERSION_PATH)!"
    exit 1
fi

# --- Build the service ---
# Assume Rust is all set up, just build!
echo "Building new notification-pusher version $NEW_VERSION..."
cargo build --package $PACKAGE_NAME --release --target=$TARGET

# --- Create remote directory for the binary ---
echo "Creating release folder $NEW_VERSION_PATH..."
remote_cmd mkdir -p "$NEW_VERSION_PATH"
NEW_VERSION_PATH_CREATED=true

# --- Upload the binary ---
echo "Uploading binary..."
scp -i "$EC2_SSH_KEY_PATH" \
    "target/$TARGET/release/$PACKAGE_NAME" \
    "$EC2_USER@$EC2_HOST:$NEW_VERSION_PATH/$PACKAGE_NAME"

# --- Make sure we have adequate permissions ---
echo "Setting executable permission..."
remote_cmd chmod +x "$NEW_VERSION_PATH/$PACKAGE_NAME"

# --- Handle .env ---
echo "Copying .env from previous release..."
remote_cmd cp "$CURRENT_VERSION_PATH/.env" "$NEW_VERSION_PATH/.env"

# --- Update symlink ---
echo "Updating latest symlink..."
remote_cmd ln -sfn "$NEW_VERSION_PATH" "$LATEST_VERSION_PATH"

# --- Restart the service ---
echo "Restarting $SERVICE_NAME service..."
remote_cmd sudo systemctl restart $SERVICE_NAME

# --- Verify the service is running ---
echo "Checking service status..."
if service_stays_up; then
    echo "✅ Service deployed successfully and running."
else
    echo "❌ Service failed to start, fetching logs..."
    remote_cmd sudo systemctl status $SERVICE_NAME --no-pager || true
    remote_cmd sudo journalctl -u $SERVICE_NAME --no-pager -n 20 || true
    echo "Rolling back..."

    if [[ -n "$CURRENT_VERSION_PATH" ]] && remote_cmd "[ -f \"$CURRENT_VERSION_PATH/$PACKAGE_NAME\" ]"; then
        remote_cmd ln -sfn "$CURRENT_VERSION_PATH" "$LATEST_VERSION_PATH"
        remote_cmd sudo systemctl restart $SERVICE_NAME

        if service_stays_up; then
            echo "⚠️ Rolled back to previous version."
        else
            echo "❌ Rollback failed, service is not running!"
        fi
    else
        echo "⁉️ No old version to roll back to!"
    fi

    exit 1
fi
