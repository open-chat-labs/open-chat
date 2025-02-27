use crate::guards::caller_is_openchat_user;
use crate::read_state;
use candid::Principal;
use canister_api_macros::query;
use ic_cdk::api::call::CallResult;
use local_user_index_canister::chat_events::{Response::*, *};
use types::UserId;

#[query(composite = true, guard = "caller_is_openchat_user", candid = true, msgpack = true)]
async fn chat_events(args: Args) -> Response {
    let (user, now) = read_state(|state| (state.calling_user(), state.env.now()));

    let futures: Vec<_> = args
        .requests
        .into_iter()
        .map(|r| make_c2c_call_to_get_events(r, user.principal, user.user_id, None))
        .collect();

    let responses = futures::future::join_all(futures).await;

    Success(SuccessResult {
        responses,
        timestamp: now,
    })
}

pub(crate) async fn make_c2c_call_to_get_events(
    events_args: EventsArgs,
    principal: Principal,
    user_id: UserId,
    bot_api_key_secret: Option<String>,
) -> EventsResponse {
    // If this call is being made by a bot, set the caller as
    // the bot's userId, rather than its principal
    let caller = if bot_api_key_secret.is_some() { user_id.into() } else { principal };

    match events_args.context {
        EventsContext::Direct(them) => {
            let canister_id = if bot_api_key_secret.is_some() { them.into() } else { user_id.into() };

            match events_args.args {
                EventsSelectionCriteria::Page(args) => map_response(
                    user_canister_c2c_client::events(
                        canister_id,
                        &user_canister::events::Args {
                            user_id: them,
                            thread_root_message_index: None,
                            bot_api_key_secret,
                            start_index: args.start_index,
                            ascending: args.ascending,
                            max_messages: args.max_messages,
                            max_events: args.max_events,
                            latest_known_update: events_args.latest_known_update,
                        },
                    )
                    .await,
                ),
                EventsSelectionCriteria::ByIndex(args) => map_response(
                    user_canister_c2c_client::events_by_index(
                        canister_id,
                        &user_canister::events_by_index::Args {
                            user_id: them,
                            thread_root_message_index: None,
                            bot_api_key_secret,
                            events: args.events,
                            latest_known_update: events_args.latest_known_update,
                        },
                    )
                    .await,
                ),
                EventsSelectionCriteria::Window(args) => map_response(
                    user_canister_c2c_client::events_window(
                        canister_id,
                        &user_canister::events_window::Args {
                            user_id: them,
                            thread_root_message_index: None,
                            bot_api_key_secret,
                            mid_point: args.mid_point,
                            max_messages: args.max_messages,
                            max_events: args.max_events,
                            latest_known_update: events_args.latest_known_update,
                        },
                    )
                    .await,
                ),
            }
        }
        EventsContext::Group(chat_id, thread_root_message_index) => match events_args.args {
            EventsSelectionCriteria::Page(args) => map_response(
                group_canister_c2c_client::c2c_events(
                    chat_id.into(),
                    &group_canister::c2c_events::Args {
                        caller,
                        bot_api_key_secret,
                        args: group_canister::events::Args {
                            thread_root_message_index,
                            start_index: args.start_index,
                            ascending: args.ascending,
                            max_messages: args.max_messages,
                            max_events: args.max_events,
                            latest_known_update: events_args.latest_known_update,
                        },
                    },
                )
                .await,
            ),
            EventsSelectionCriteria::ByIndex(args) => map_response(
                group_canister_c2c_client::c2c_events_by_index(
                    chat_id.into(),
                    &group_canister::c2c_events_by_index::Args {
                        caller,
                        bot_api_key_secret,
                        args: group_canister::events_by_index::Args {
                            thread_root_message_index,
                            events: args.events,
                            latest_known_update: events_args.latest_known_update,
                        },
                    },
                )
                .await,
            ),
            EventsSelectionCriteria::Window(args) => map_response(
                group_canister_c2c_client::c2c_events_window(
                    chat_id.into(),
                    &group_canister::c2c_events_window::Args {
                        caller,
                        bot_api_key_secret,
                        args: group_canister::events_window::Args {
                            thread_root_message_index,
                            mid_point: args.mid_point,
                            max_messages: args.max_messages,
                            max_events: args.max_events,
                            latest_known_update: events_args.latest_known_update,
                        },
                    },
                )
                .await,
            ),
        },
        EventsContext::Channel(community_id, channel_id, thread_root_message_index) => match events_args.args {
            EventsSelectionCriteria::Page(args) => map_response(
                community_canister_c2c_client::c2c_events(
                    community_id.into(),
                    &community_canister::c2c_events::Args {
                        caller,
                        bot_api_key_secret,
                        args: community_canister::events::Args {
                            channel_id,
                            thread_root_message_index,
                            start_index: args.start_index,
                            ascending: args.ascending,
                            max_messages: args.max_messages,
                            max_events: args.max_events,
                            latest_known_update: events_args.latest_known_update,
                        },
                    },
                )
                .await,
            ),
            EventsSelectionCriteria::ByIndex(args) => map_response(
                community_canister_c2c_client::c2c_events_by_index(
                    community_id.into(),
                    &community_canister::c2c_events_by_index::Args {
                        caller,
                        bot_api_key_secret,
                        args: community_canister::events_by_index::Args {
                            channel_id,
                            thread_root_message_index,
                            events: args.events,
                            latest_known_update: events_args.latest_known_update,
                        },
                    },
                )
                .await,
            ),
            EventsSelectionCriteria::Window(args) => map_response(
                community_canister_c2c_client::c2c_events_window(
                    community_id.into(),
                    &community_canister::c2c_events_window::Args {
                        caller,
                        bot_api_key_secret,
                        args: community_canister::events_window::Args {
                            channel_id,
                            thread_root_message_index,
                            mid_point: args.mid_point,
                            max_messages: args.max_messages,
                            max_events: args.max_events,
                            latest_known_update: events_args.latest_known_update,
                        },
                    },
                )
                .await,
            ),
        },
    }
}

fn map_response<R: Into<EventsResponse>>(response: CallResult<R>) -> EventsResponse {
    match response {
        Ok(result) => result.into(),
        Err(error) => EventsResponse::InternalError(format!("{error:?}")),
    }
}
