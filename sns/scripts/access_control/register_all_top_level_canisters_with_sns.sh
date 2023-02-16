#!/bin/sh

SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/register_top_level_canisters_with_sns

echo "Start registering top level canisters with SNS"

./register_cycles_dispenser.sh
./register_group_index.sh
./register_notifications_index.sh
./register_online_users.sh
./register_open_storage_index.sh
./register_proposals_bot.sh
./register_user_index.sh

cd ..

echo "Finish registering top level canisters with SNS"

