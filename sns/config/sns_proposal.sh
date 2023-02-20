#!/bin/bash

IC_ADMIN=ic-admin
TARGET_SWAP_CANISTER_ID=4kt4l-laaaa-aaaaa-qaaeq-cai

if [ -z "${IC_ADMIN}" ]; then
  echo "No IC_ADMIN set"
  exit 1
fi

if [ -z "${NEURON_ID}" ]; then
    echo "NEURON_ID not set"
    exit 1
fi

check_or_set_dfx_hsm_pin() {
    VALUE=${DFX_HSM_PIN:-}
    if [ -z "$VALUE" ]; then
        echo -n "Enter your HSM_PIN":
        read -s DFX_HSM_PIN
        export DFX_HSM_PIN
        echo
    fi
}

PROPOSAL_TITLE="Proposal to create an SNS-DAO for OpenChat"
PATH_TO_SUMMARY_FILE=$PWD/sns_proposal_summary.md

SUMMARY=`cat $PATH_TO_SUMMARY_FILE`

check_or_set_dfx_hsm_pin

$IC_ADMIN --use-hsm --slot=0 --key-id=01 --pin=$DFX_HSM_PIN \
              --nns-url https://nns.ic0.app \
              propose-to-open-sns-token-swap \
              --proposer $NEURON_ID \
              --min-participants 100 \
              --min-icp-e8s 50000000000000 \
              --max-icp-e8s 100000000000000 \
              --community-fund-investment-e8s 33333300000000 \
              --min-participant-icp-e8s 100000000 \
              --max-participant-icp-e8s 15000000000000 \
              --swap-due-timestamp-seconds 1678104000 \
              --sns-token-e8s 2500000000000000 \
              --target-swap-canister-id $TARGET_SWAP_CANISTER_ID \
              --neuron-basket-count 5 \
              --neuron-basket-dissolve-delay-interval-seconds 7889400 \
              --sale-delay-seconds 172800 \
              --proposal-title "$PROPOSAL_TITLE" \
              --summary "$SUMMARY"