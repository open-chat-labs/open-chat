use dfn_core::api::PrincipalId;
use dfn_protobuf::{protobuf, ToProto};
use ic_nns_constants::LEDGER_CANISTER_ID;
use ledger_canister::{AccountIdentifier, BlockHeight, ICPTs, Memo, SendArgs};
use types::UserId;
use utils::consts::ICP_TRANSACTION_FEE_E8S;

const OPEN_CHAT_MEMO: u64 = 5715144129571733504; // OPENCHAT (0x4f50454e43484154)

pub fn calculate_address(user_id: UserId) -> AccountIdentifier {
    let principal_id = PrincipalId(user_id.into());

    AccountIdentifier::new(principal_id, None)
}

pub struct SendResult {
    pub block_height: BlockHeight,
    pub fee_e8s: u64,
}

pub async fn send(recipient: AccountIdentifier, amount_e8s: u64) -> Result<SendResult, String> {
    send_internal(SendArgs {
        memo: Memo(OPEN_CHAT_MEMO),
        amount: ICPTs::from_e8s(amount_e8s),
        fee: ICPTs::from_e8s(ICP_TRANSACTION_FEE_E8S),
        from_subaccount: None,
        to: recipient,
        created_at_time: None,
    })
    .await
    .map(|block_height| SendResult {
        block_height,
        fee_e8s: ICP_TRANSACTION_FEE_E8S,
    })
}

async fn send_internal(args: SendArgs) -> Result<BlockHeight, String> {
    dfn_core::call(LEDGER_CANISTER_ID, "send_pb", protobuf, args.into_proto())
        .await
        .map_err(|e| e.1)
}
