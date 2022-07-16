use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_tracing_macros::trace;
use chat_events::RegisterPollVoteResult;
use ic_cdk_macros::update;
use user_canister::register_poll_vote::{Response::*, *};

#[update]
#[trace]
async fn register_poll_vote(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| register_poll_vote_impl(args, state))
}

fn register_poll_vote_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if let Some(chat) = runtime_state.data.direct_chats.get_mut(&args.user_id.into()) {
        let my_user_id = runtime_state.env.canister_id().into();
        let now = runtime_state.env.now();

        let result =
            chat.events
                .register_poll_vote(my_user_id, None, args.message_index, args.poll_option, args.operation, now);

        match result {
            RegisterPollVoteResult::Success(votes) | RegisterPollVoteResult::SuccessNoChange(votes) => Success(votes),
            RegisterPollVoteResult::PollEnded => PollEnded,
            RegisterPollVoteResult::PollNotFound => PollNotFound,
            RegisterPollVoteResult::OptionIndexOutOfRange => OptionIndexOutOfRange,
        }
    } else {
        ChatNotFound
    }
}
