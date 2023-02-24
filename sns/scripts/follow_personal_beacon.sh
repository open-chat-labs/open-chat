#!/bin/sh

NETWORK=$1
IDENTITY="oc-matt"

FOLLOWER="\ae.\b3Dk\b2\fc\22r\60\a0\b4\9a\0f6-m\0f.\b8\f2\e6\db\09S\0c\13\60l6\12\0f"
FOLLOWEE="f]-\05\c0\fb\a7\c0T\fb\d1\01\ca\17\d9\0f\88#\db\08].\03l\92DidG\dc\fd\b5"

dfx canister --identity $IDENTITY --network $NETWORK call sns_governance manage_neuron "(record { subaccount = blob \"$FOLLOWER\"; command = opt variant { Follow = record { function_id = 0; followees = vec { record { id = blob \"$FOLLOWEE\"} } } } })"

