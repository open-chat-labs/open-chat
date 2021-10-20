use dfn_core::api::PrincipalId;
use dfn_protobuf::{protobuf, ToProto};
use ic_nns_constants::LEDGER_CANISTER_ID;
use ledger_canister::{AccountIdentifier, BlockHeight, ICPTs, Memo, SendArgs};
use types::UserId;

pub fn calculate_address(user_id: UserId) -> AccountIdentifier {
    let principal_id = PrincipalId(user_id.into());

    AccountIdentifier::new(principal_id, None)
}

pub async fn send(recipient: AccountIdentifier, amount_e8s: u64, fee_e8s: u64, memo: u64) -> Result<BlockHeight, String> {
    send_internal(SendArgs {
        memo: Memo(memo),
        amount: ICPTs::from_e8s(amount_e8s),
        fee: ICPTs::from_e8s(fee_e8s),
        from_subaccount: None,
        to: recipient,
        created_at_time: None,
    })
    .await
}

async fn send_internal(args: SendArgs) -> Result<BlockHeight, String> {
    dfn_core::call(LEDGER_CANISTER_ID, "send_pb", protobuf, args.into_proto())
        .await
        .map_err(|e| e.1)
}
