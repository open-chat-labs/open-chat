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

# Remote paths
REMOTE_SERVICE_DIR_NAME="notification_pusher"
REMOTE_SERVICE_PATH="/home/$EC2_USER/$REMOTE_SERVICE_DIR_NAME"
LATEST_VERSION_PATH="$REMOTE_SERVICE_PATH/latest"
NEW_VERSION_PATH="$REMOTE_SERVICE_PATH/$NEW_VERSION"
CURRENT_VERSION_PATH=$(remote_cmd readlink -f "$LATEST_VERSION_PATH" 2>/dev/null || echo "")

# --- Pre-flight checks ---
# Make sure version directory doesn't already exist
echo "Checking if version directory already exists..."
if remote_cmd "[ -d \"$NEW_VERSION_PATH\" ]"; then
    echo "❌ Version directory $NEW_VERSION_PATH already exists!"
    exit 1
fi

# --- Build the service ---
# Assume Rust is all set up, just build!
echo "Building new notification-pusher version $NEW_VERSION..."
cargo build --package $PACKAGE_NAME --release --target=x86_64-unknown-linux-musl

# --- Create remote directory for the binary ---
echo "Creating release folder $NEW_VERSION_PATH..."
remote_cmd mkdir -p "$NEW_VERSION_PATH"

# --- Upload the binary ---
echo "Uploading binary..."
scp -i "$EC2_SSH_KEY_PATH" \
    "target/x86_64-unknown-linux-musl/release/$PACKAGE_NAME" \
    "$EC2_USER@$EC2_HOST:$NEW_VERSION_PATH/$PACKAGE_NAME"

# --- Make sure we have adequate permissions ---
echo "Setting executable permission..."
remote_cmd sudo chmod +x "$NEW_VERSION_PATH/$PACKAGE_NAME"

# --- Handle .env ---
# Checks if .env exists in the old version directory
if [[ -z "$CURRENT_VERSION_PATH" ]] || ! remote_cmd "[ -e \"$CURRENT_VERSION_PATH/.env\" ]"; then
    echo "❌ No .env file found in previous version ($CURRENT_VERSION_PATH)!"
    exit 1
fi

echo "Copying .env from previous release..."
remote_cmd cp "$CURRENT_VERSION_PATH/.env" "$NEW_VERSION_PATH/.env"

# --- Update symlink ---
echo "Updating latest symlink..."
remote_cmd ln -sfn "$NEW_VERSION_PATH" "$LATEST_VERSION_PATH"

# --- Restart the service ---
# Sleep for a second to ensure the service has fully restarted before checking
# its status again.
echo "Restarting $SERVICE_NAME service..."
remote_cmd sudo systemctl restart $SERVICE_NAME
sleep 1

# --- Verify the service is running ---
echo "Checking service status..."
if remote_cmd sudo systemctl is-active --quiet $SERVICE_NAME; then
    echo "✅ Service deployed successfully and running."
else
    echo "❌ Service failed to start, fetching logs..."
    remote_cmd sudo systemctl status $SERVICE_NAME --no-pager || true
    remote_cmd sudo journalctl -u $SERVICE_NAME --no-pager -n 20 || true
    echo "Rolling back..."

    if [[ -n "$CURRENT_VERSION_PATH" ]] && remote_cmd "[ -f \"$CURRENT_VERSION_PATH/$PACKAGE_NAME\" ]"; then
        remote_cmd ln -sfn "$CURRENT_VERSION_PATH" "$LATEST_VERSION_PATH"
        remote_cmd sudo systemctl restart $SERVICE_NAME
        sleep 1
        
        if remote_cmd sudo systemctl is-active --quiet $SERVICE_NAME; then
            echo "⚠️ Rolled back to previous version."
        else
            echo "❌ Rollback failed, service is not running!"
        fi
    else
        echo "⁉️ No old version to roll back to!"
    fi

    exit 1
fi
