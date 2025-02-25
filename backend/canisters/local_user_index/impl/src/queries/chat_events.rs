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
        .map(|r| make_c2c_call_to_get_events(r, user.principal, user.user_id))
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
) -> EventsResponse {
    match events_args.context {
        EventsContext::Direct(them) => match events_args.args {
            EventsArgsInner::Page(args) => map_response(
                user_canister_c2c_client::events(
                    user_id.into(),
                    &user_canister::events::Args {
                        user_id: them,
                        thread_root_message_index: None,
                        start_index: args.start_index,
                        ascending: args.ascending,
                        max_messages: args.max_messages,
                        max_events: args.max_events,
                        latest_known_update: events_args.latest_known_update,
                    },
                )
                .await,
            ),
            EventsArgsInner::ByIndex(args) => map_response(
                user_canister_c2c_client::events_by_index(
                    user_id.into(),
                    &user_canister::events_by_index::Args {
                        user_id: them,
                        thread_root_message_index: None,
                        events: args.events,
                        latest_known_update: events_args.latest_known_update,
                    },
                )
                .await,
            ),
            EventsArgsInner::Window(args) => map_response(
                user_canister_c2c_client::events_window(
                    user_id.into(),
                    &user_canister::events_window::Args {
                        user_id: them,
                        thread_root_message_index: None,
                        mid_point: args.mid_point,
                        max_messages: args.max_messages,
                        max_events: args.max_events,
                        latest_known_update: events_args.latest_known_update,
                    },
                )
                .await,
            ),
        },
        EventsContext::Group(chat_id, thread_root_message_index) => match events_args.args {
            EventsArgsInner::Page(args) => map_response(
                group_canister_c2c_client::c2c_events(
                    chat_id.into(),
                    &group_canister::c2c_events::Args {
                        caller: principal,
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
            EventsArgsInner::ByIndex(args) => map_response(
                group_canister_c2c_client::c2c_events_by_index(
                    chat_id.into(),
                    &group_canister::c2c_events_by_index::Args {
                        caller: principal,
                        args: group_canister::events_by_index::Args {
                            thread_root_message_index,
                            events: args.events,
                            latest_known_update: events_args.latest_known_update,
                        },
                    },
                )
                .await,
            ),
            EventsArgsInner::Window(args) => map_response(
                group_canister_c2c_client::c2c_events_window(
                    chat_id.into(),
                    &group_canister::c2c_events_window::Args {
                        caller: principal,
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
            EventsArgsInner::Page(args) => map_response(
                community_canister_c2c_client::c2c_events(
                    community_id.into(),
                    &community_canister::c2c_events::Args {
                        caller: principal,
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
            EventsArgsInner::ByIndex(args) => map_response(
                community_canister_c2c_client::c2c_events_by_index(
                    community_id.into(),
                    &community_canister::c2c_events_by_index::Args {
                        caller: principal,
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
            EventsArgsInner::Window(args) => map_response(
                community_canister_c2c_client::c2c_events_window(
                    community_id.into(),
                    &community_canister::c2c_events_window::Args {
                        caller: principal,
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
