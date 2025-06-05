use crate::activity_notifications::handle_activity_notification;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use group_canister::register_poll_vote::{Response::*, *};
use types::{Achievement, Chat, EventIndex, OCResult, PollVotes, TotalVotes};
use user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(msgpack = true)]
#[trace]
fn register_poll_vote(args: Args) -> Response {
    match execute_update(|state| register_poll_vote_impl(args, state)) {
        Ok(votes) => Success(votes),
        Err(error) => Error(error),
    }
}

fn register_poll_vote_impl(args: Args, state: &mut RuntimeState) -> OCResult<PollVotes> {
    state.data.verify_not_frozen()?;

    let user_id = state.get_caller_user_id()?;
    let now = state.env.now();

    let result = state.data.chat.register_poll_vote(
        user_id,
        args.thread_root_message_index,
        args.message_index,
        args.poll_option,
        args.operation,
        now,
    )?;

    if result.value.updated {
        if result.value.poll_creator != user_id {
            if args.new_achievement {
                state.notify_user_of_achievement(user_id, Achievement::VotedOnPoll, now);
            }

            if let Some((message, event_index)) = state.data.chat.events.message_internal(
                EventIndex::default(),
                args.thread_root_message_index,
                args.message_index.into(),
            ) {
                if state
                    .data
                    .chat
                    .members
                    .get(&result.value.poll_creator)
                    .is_some_and(|m| !m.user_type().is_bot())
                {
                    state.push_event_to_user(
                        result.value.poll_creator,
                        GroupCanisterEvent::MessageActivity(MessageActivityEvent {
                            chat: Chat::Group(state.env.canister_id().into()),
                            thread_root_message_index: args.thread_root_message_index,
                            message_index: message.message_index,
                            message_id: message.message_id,
                            event_index,
                            activity: MessageActivity::PollVote,
                            timestamp: now,
                            user_id: matches!(result.value.votes.total, TotalVotes::Visible(_)).then_some(user_id),
                        }),
                        now,
                    );
                }
            }
        }

        handle_activity_notification(state);
    }

    state.push_bot_notification(result.bot_notification);
    Ok(result.value.votes)
}
