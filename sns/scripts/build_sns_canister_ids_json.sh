GOVERNANCE_CANISTER_ID=$(dfx -qq canister --network $NETWORK id sns_governance)
INDEX_CANISTER_ID=$(dfx -qq canister --network $NETWORK id sns_index)
LEDGER_CANISTER_ID=$(dfx -qq canister --network $NETWORK id sns_ledger)
ROOT_CANISTER_ID=$(dfx -qq canister --network $NETWORK id sns_root)
SWAP_CANISTER_ID=$(dfx -qq canister --network $NETWORK id sns_swap)

echo "{"
echo "  \"dapp_canister_id_list\": [],"
echo "  \"governance_canister_id\": \"$GOVERNANCE_CANISTER_ID\","
echo "  \"index_canister_id\": \"$INDEX_CANISTER_ID\","
echo "  \"ledger_canister_id\": \"$LEDGER_CANISTER_ID\","
echo "  \"root_canister_id\": \"$ROOT_CANISTER_ID\","
echo "  \"swap_canister_id\": \"$SWAP_CANISTER_ID\""
echo "}"
