use crate::lifecycle::{init_env, init_state};
use crate::{mutate_state, openchat_bot, Data};
use canister_tracing_macros::trace;
use ic_cdk_macros::init;
use tracing::info;
use types::MessageContentInitial;
use user_canister::init::Args;
use utils::env::Environment;

#[init]
#[trace]
fn init(args: Args) {
    canister_logger::init(args.test_mode);

    let env = init_env([0; 32]);

    let data = Data::new(
        args.owner,
        args.user_index_canister_id,
        args.local_user_index_canister_id,
        args.group_index_canister_id,
        args.notifications_canister_id,
        args.proposals_bot_canister_id,
        args.escrow_canister_id,
        args.username,
        args.test_mode,
        env.now(),
    );

    init_state(env, data, args.wasm_version);

    mutate_state(|state| {
        for message in args.openchat_bot_messages {
            let initial_content: MessageContentInitial = message.into();
            openchat_bot::send_message(initial_content.try_into().unwrap(), true, state);
        }
    });

    info!(version = %args.wasm_version, "Initialization complete");
}
