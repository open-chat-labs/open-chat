use crate::guards::caller_is_owner;
use crate::{execute_update_async, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_types::EventBuilder;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use types::OCResult;
use user_canister::withdraw_via_one_sec::*;
use user_core::updates::withdraw_via_one_sec::{WithdrawalViaOneSecEventPayload, approval_args, token, withdraw};

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn withdraw_via_one_sec(args: Args) -> Response {
    execute_update_async(|| withdraw_via_one_sec_impl(args)).await.into()
}

async fn withdraw_via_one_sec_impl(mut args: Args) -> OCResult {
    let token = token(&args.token_symbol)?;

    // Approving the OneSec minter is what the user's PIN authorises
    let mut approval = approval_args(&args);
    approval.pin = args.pin.take();
    let (my_user_id, now_nanos) = mutate_state(|state| {
        let now = state.env.now();
        user_core::updates::approve_transfer::prepare(&mut state.data.user, &mut approval, now)
            .map(|now_nanos| (state.env.canister_id().into(), now_nanos))
    })?;

    withdraw(&args, token, approval, my_user_id, now_nanos).await?;

    mutate_state(|state| {
        let user_id_string = my_user_id.to_string();
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
