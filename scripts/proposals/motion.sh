#!/bin/sh

# cd into the scripts folder
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

# Extract the args
TITLE=$1
URL=$2
SUMMARY_PATH=$3

SUMMARY=`cat $SUMMARY_PATH`

# Build the proposal candid
PROPOSAL="(record { title=\"$TITLE\"; url=\"$URL\"; summary=\"$SUMMARY\"; action=opt variant {Motion = record {motion_text = \"\"}}})"

# Make the proposal
./make_proposal.sh "$PROPOSAL"
