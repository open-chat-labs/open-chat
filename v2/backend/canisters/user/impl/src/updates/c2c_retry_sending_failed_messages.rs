use crate::guards::caller_is_user_index;
use crate::updates::send_message::{send_to_recipients_canister, CyclesTransferDetails};
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::UserId;
use user_canister::c2c_retry_sending_failed_messages::{Response::*, *};

#[update(guard = "caller_is_user_index")]
#[trace]
fn c2c_retry_sending_failed_messages(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_retry_sending_failed_messages_impl(args, state))
}

fn c2c_retry_sending_failed_messages_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let messages_to_retry = runtime_state.data.failed_messages_pending_retry.take(&args.recipient);
    if !messages_to_retry.is_empty() {
        ic_cdk::block_on(retry_sending_messages(args.recipient, messages_to_retry));
    }
    Success
}

async fn retry_sending_messages(
    recipient: UserId,
    messages_to_retry: Vec<(user_canister::c2c_send_message::Args, Option<CyclesTransferDetails>)>,
) {
    let futures: Vec<_> = messages_to_retry
        .into_iter()
        .map(|(args, cycles_transfer)| send_to_recipients_canister(recipient, args, cycles_transfer, true))
        .collect();

    futures::future::join_all(futures).await;
}
