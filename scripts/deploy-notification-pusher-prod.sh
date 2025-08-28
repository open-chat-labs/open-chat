#!/bin/bash
set -euo pipefail

NEW_VERSION="$1"
EC2_USER="$2"
EC2_HOST="$3"
EC2_SSH_KEY_PATH="$4"

ssh_ec2() {
    ssh -i "$EC2_SSH_KEY_PATH" -o StrictHostKeyChecking=no "$EC2_USER@$EC2_HOST" "$*"
}

# Name of the service being deployed
SERVICE_NAME="notification-pusher"

# Remote paths
SERVICE_DIR="/home/$EC2_USER/notification_pusher"
LATEST_DIR="$SERVICE_DIR/latest"
NEW_VERSION_DIR="$SERVICE_DIR/$NEW_VERSION"
OLD_VERSION_DIR=$(ssh_ec2 "readlink -f $LATEST_DIR || true")

# Make sure version directory doesn't already exist
if ssh_ec2 "[ -d '$NEW_VERSION_DIR' ]"; then
    echo "❌ Version directory $NEW_VERSION_DIR already exists!"
    exit 1
fi

# Assume Rust is all set up, just build!
echo "Building new notification-pusher version $NEW_VERSION..."
cargo build --package notification_pusher_aws --release --target=x86_64-unknown-linux-musl

echo "Creating release folder..."
ssh_ec2 "mkdir -p $NEW_VERSION_DIR"

echo "Uploading binary..."
scp -i "$EC2_SSH_KEY_PATH" \
    "target/x86_64-unknown-linux-musl/release/notification_pusher_aws" \
    "$EC2_USER@$EC2_HOST:$NEW_VERSION_DIR/notification_pusher_aws"

echo "Setting executable permission..."
ssh_ec2 "sudo chmod +x $NEW_VERSION_DIR/notification_pusher_aws"

# Checks if .env exists in the old version directory
if [[ -z "$OLD_VERSION_DIR" ]] || ! ssh_ec2 "[ -e '$OLD_VERSION_DIR/.env' ]"; then
    echo "❌ No .env file found in previous version ($OLD_VERSION_DIR)!"
    exit 1
fi

echo "Copying .env from previous release..."
ssh_ec2 "cp '$OLD_VERSION_DIR/.env' '$NEW_VERSION_DIR/.env'"

echo "Updating latest symlink..."
ssh_ec2 "ln -sfn $NEW_VERSION_DIR $LATEST_DIR"

# Sleep for a second to ensure the service has fully restarted before checking
# its status again.
echo "Restarting $SERVICE_NAME service..."
ssh_ec2 "sudo systemctl restart $SERVICE_NAME && sleep 1"

echo "Checking service status..."
if ssh_ec2 "sudo systemctl is-active --quiet $SERVICE_NAME"; then
    echo "✅ Service deployed successfully and running."
else
    echo "❌ Service failed to start, fetching logs..."
    ssh_ec2 "sudo systemctl status $SERVICE_NAME --no-pager"
    ssh_ec2 "sudo journalctl -u $SERVICE_NAME --no-pager -n 20"
    echo "Rolling back..."

    if [[ -n "$OLD_VERSION_DIR" ]]; then
        ssh_ec2 "ln -sfn $OLD_VERSION_DIR $LATEST_DIR && sudo systemctl restart $SERVICE_NAME && sleep 1"
        
        if ssh_ec2 "sudo systemctl is-active --quiet $SERVICE_NAME"; then
            echo "⚠️ Rolled back to previous version."
        else
            echo "❌ Rollback failed, service is not running!"
        fi
    else
        echo "⁉️ No old version to roll back to!"
    fi

    exit 1
fi
