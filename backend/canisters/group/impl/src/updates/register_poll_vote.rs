use crate::activity_notifications::handle_activity_notification;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use chat_events::{RegisterPollVoteArgs, RegisterPollVoteResult};
use group_canister::register_poll_vote::{Response::*, *};
use types::{Achievement, Chat, EventIndex, TotalVotes};
use user_canister::{GroupCanisterEvent, MessageActivity, MessageActivityEvent};

#[update(candid = true, msgpack = true)]
#[trace]
async fn register_poll_vote(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| register_poll_vote_impl(args, state))
}

fn register_poll_vote_impl(args: Args, state: &mut RuntimeState) -> Response {
    if state.data.is_frozen() {
        return ChatFrozen;
    }

    let caller = state.env.caller();
    if let Some(member) = state.data.get_member(caller) {
        if member.suspended.value {
            return UserSuspended;
        } else if member.lapsed.value {
            return UserLapsed;
        }

        let now = state.env.now();
        let user_id = member.user_id;
        let min_visible_event_index = member.min_visible_event_index();

        let result = state.data.chat.events.register_poll_vote(RegisterPollVoteArgs {
            user_id,
            min_visible_event_index,
            thread_root_message_index: args.thread_root_message_index,
            message_index: args.message_index,
            option_index: args.poll_option,
            operation: args.operation,
            correlation_id: args.correlation_id,
            now,
        });

        match result {
            RegisterPollVoteResult::Success(votes, creator) => {
                if creator != user_id {
                    if args.new_achievement {
                        state.data.notify_user_of_achievement(user_id, Achievement::VotedOnPoll);
                    }

                    if let Some((message, event_index)) = state.data.chat.events.message_internal(
                        EventIndex::default(),
                        args.thread_root_message_index,
                        args.message_index.into(),
                    ) {
                        if state.data.chat.members.contains(&creator) {
                            state.data.user_event_sync_queue.push(
                                creator,
                                GroupCanisterEvent::MessageActivity(MessageActivityEvent {
                                    chat: Chat::Group(state.env.canister_id().into()),
                                    thread_root_message_index: args.thread_root_message_index,
                                    message_index: message.message_index,
                                    message_id: message.message_id,
                                    event_index,
                                    activity: MessageActivity::PollVote,
                                    timestamp: now,
                                    user_id: matches!(votes.total, TotalVotes::Visible(_)).then_some(user_id),
                                }),
                            );
                        }
                    }
                }

                handle_activity_notification(state);
                Success(votes)
            }
            RegisterPollVoteResult::SuccessNoChange(votes) => Success(votes),
            RegisterPollVoteResult::PollEnded => PollEnded,
            RegisterPollVoteResult::PollNotFound => PollNotFound,
            RegisterPollVoteResult::OptionIndexOutOfRange => OptionIndexOutOfRange,
            RegisterPollVoteResult::UserCannotChangeVote => UserCannotChangeVote,
        }
    } else {
        CallerNotInGroup
    }
}
