#!/bin/bash

# Set current directory to the scripts root
SCRIPT=$(readlink -f "$0")
SCRIPT_DIR=$(dirname "$SCRIPT")
cd $SCRIPT_DIR/..

TITLE="Set canister log visibility to public"
URL=""
SUMMARY="This will open up the canister logs so that error details can be viewed.

This change will be applied to the following canisters -
- AirdropBot
- CyclesDispenser
- Escrow
- EventRelay
- EventStore
- Identity
- NeuronController
- OnlineUsers
- OpenChatInstaller
- ProposalsBot
- Registry
- SignInWithEmail
- SignInWithEthereum
- SignInWithSolana
- StorageIndex
- Translations"

PROPOSAL="(record { title=\"$TITLE\"; url=\"$URL\"; summary=\"$SUMMARY\"; action=opt variant {
ManageDappCanisterSettings = record {
    canister_ids = vec {
        principal \"62rh2-kiaaa-aaaaf-bmy5q-cai\";
        principal \"gonut-hqaaa-aaaaf-aby7a-cai\";
        principal \"s4yi7-yiaaa-aaaar-qacpq-cai\";
        principal \"6ofpc-2aaaa-aaaaf-biibq-cai\";
        principal \"64dy3-wqaaa-aaaaf-biicq-cai\";
        principal \"6klfq-niaaa-aaaar-qadbq-cai\";
        principal \"tktqu-nyaaa-aaaar-qackq-cai\";
        principal \"3vlw6-fiaaa-aaaaf-aaa3a-cai\";
        principal \"jodzs-iqaaa-aaaar-qamqa-cai\";
        principal \"iywa7-ayaaa-aaaaf-aemga-cai\";
        principal \"cpi5u-yiaaa-aaaar-aqw5a-cai\";
        principal \"zi2i7-nqaaa-aaaar-qaemq-cai\";
        principal \"2notu-qyaaa-aaaar-qaeha-cai\";
        principal \"2kpva-5aaaa-aaaar-qaehq-cai\";
        principal \"rturd-qaaaa-aaaaf-aabaq-cai\";
        principal \"lxq5i-mqaaa-aaaaf-bih7q-cai\";
    };
    log_visibility = opt 2:opt int32;
}}})"

pwd

# Submit the proposal
./make_proposal.sh "$PROPOSAL"
