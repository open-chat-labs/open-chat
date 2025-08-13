use crate::guards::caller_is_owner;
use crate::{execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::ONE_SEC_MINTER_CANISTER_ID;
use event_store_types::EventBuilder;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use oc_error_codes::OCErrorCode;
use one_sec_minter_canister::{EvmAccount, IcpAccount, Token};
use serde::Serialize;
use types::{EvmChain, OCResult};
use user_canister::withdraw_via_one_sec::*;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn withdraw_via_one_sec(args: Args) -> Response {
    execute_update_async(|| withdraw_via_one_sec_impl(args)).await.into()
}

async fn withdraw_via_one_sec_impl(args: Args) -> OCResult {
    mutate_state(|state| state.data.pin_number.verify(args.pin.as_deref(), state.env.now()))?;

    let token = match args.token_symbol.to_lowercase().as_str() {
        "usdc" => Token::USDC,
        "usdt" => Token::USDT,
        _ => return Err(OCErrorCode::CurrencyNotSupported.into()),
    };

    let canister_id = read_state(|state| state.env.canister_id());

    match one_sec_minter_canister_c2c_client::transfer_icp_to_evm(
        ONE_SEC_MINTER_CANISTER_ID,
        &one_sec_minter_canister::transfer_icp_to_evm::Args {
            token,
            evm_account: EvmAccount { address: args.address },
            icp_account: IcpAccount::ICRC(canister_id.into()),
            evm_chain: args.evm_chain,
            icp_amount: args.amount.into(),
            evm_amount: None,
        },
    )
    .await?
    {
        one_sec_minter_canister::transfer_icp_to_evm::Response::Failed(failed) => {
            return Err(OCErrorCode::TransferFailed.with_message(&failed.error));
        }
        _ => {}
    }

    mutate_state(|state| {
        let user_id_string = canister_id.to_string();
        let now = state.env.now();
        state.push_local_user_index_canister_event(
            LocalUserIndexEvent::EventStoreEvent(
                EventBuilder::new("withdrawal_via_one_sec", now)
                    .with_user(user_id_string.clone(), true)
                    .with_source(user_id_string, true)
                    .with_json_payload(&WithdrawalViaOneSecEventPayload {
                        token_symbol: args.token_symbol,
                        evm_chain: args.evm_chain,
                        amount: args.amount,
                    })
                    .build(),
            ),
            now,
        );
    });

    Ok(())
}

#[derive(Serialize)]
struct WithdrawalViaOneSecEventPayload {
    pub token_symbol: String,
    pub evm_chain: EvmChain,
    pub amount: u64,
}
