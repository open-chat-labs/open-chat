#!/bin/sh

# Set current directory to the directory this script is in
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR

# Set env variables based on .env file
set -o allexport; source .env; set +o allexport

if [ -z "${TARGET_SWAP_CANISTER_ID}" ]
then
  echo "Missing environment variable TARGET_SWAP_CANISTER_ID"
  exit 1
fi
if [ -z "${PROPOSER_NNS_NEURON_ID}" ]
then
  echo "Missing environment variable NEURON_ID"
  exit 1
fi
if [ -z "${PEM_FILE_FOR_NEURON_CONTROLLER}" ]
then
  echo "Missing environment variable PEM_FILE"
  exit 1
fi
if [ -z "${PROPOSAL_URL}" ]
then
  echo "Missing environment variable PROPOSAL_URL"
  exit 1
fi

PROPOSAL_TITLE="Proposal to create an SNS-DAO for OpenChat"
SWAP_DUE_TIMESTAMP_SECONDS=1678795200 # noon on 14th March
PATH_TO_SUMMARY_FILE=./sns_proposal_summary.md
SUMMARY=`cat $PATH_TO_SUMMARY_FILE`

ic-admin --nns-url https://nns.ic0.app \
              --secret-key-pem $PEM_FILE_FOR_NEURON_CONTROLLER
              propose-to-open-sns-token-swap \
              --proposer $PROPOSER_NNS_NEURON_ID \
              --min-participants 500 \
              --min-icp-e8s 50000000000000 \
              --max-icp-e8s 100000000000000 \
              --community-fund-investment-e8s 33333300000000 \
              --min-participant-icp-e8s 100000000 \
              --max-participant-icp-e8s 10000000000000 \
              --swap-due-timestamp-seconds $SWAP_DUE_TIMESTAMP_SECONDS \
              --sns-token-e8s 2500000000000000 \
              --target-swap-canister-id $TARGET_SWAP_CANISTER_ID \
              --neuron-basket-count 5 \
              --neuron-basket-dissolve-delay-interval-seconds 7889400 \
              --sale-delay-seconds 86400 \
              --proposal-title "$PROPOSAL_TITLE" \
              --proposal-url "$PROPOSAL_URL" \
              --summary "$SUMMARY"