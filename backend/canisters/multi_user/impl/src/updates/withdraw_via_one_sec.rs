use crate::guards::caller_is_hosted_user;
use crate::mutate_state;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_types::EventBuilder;
use local_user_index_canister::UserEvent as LocalUserIndexEvent;
use types::{OCResult, UserId};
use user_canister::withdraw_via_one_sec::*;
use user_core::updates::withdraw_via_one_sec::{WithdrawalViaOneSecEventPayload, approval_args, token, withdraw};

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn withdraw_via_one_sec(args: Args) -> Response {
    withdraw_via_one_sec_impl(args).await.into()
}

async fn withdraw_via_one_sec_impl(mut args: Args) -> OCResult {
    let token = token(&args.token_symbol)?;

    // Approving the OneSec minter is what the user's PIN authorises
    let mut approval = approval_args(&args);
    approval.pin = args.pin.take();
    let (my_index, my_user_id, now_nanos) = mutate_state(|state| {
        let now = state.env.now();
        let canister_id = state.env.canister_id();
        state.with_caller_user_mut(|my_index, user| {
            user_core::updates::approve_transfer::prepare(user, &mut approval, now)
                .map(|now_nanos| (my_index, UserId::new_indexed(canister_id, my_index), now_nanos))
        })
    })?;

    withdraw(&args, token, approval, my_user_id, now_nanos).await?;

    // Recorded even if the user was deleted meanwhile: the withdrawal happened
    mutate_state(|state| {
        let user_id_string = my_user_id.to_string();
        let now = state.env.now();
        state.push_local_user_index_canister_event(
            my_index,
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
