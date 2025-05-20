use crate::guards::caller_is_registry_canister;
use crate::{NotificationsCanister, RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use notifications_index_canister::add_notifications_canister::{Response::*, *};
use notifications_index_canister::{NotificationsIndexEvent, SubscriptionAdded};
use rand::RngCore;
use types::{BuildVersion, CanisterId, CanisterWasm, IdempotentEnvelope};
use utils::canister::{install_basic, set_controllers};

#[update(guard = "caller_is_registry_canister", msgpack = true)]
#[trace]
async fn add_notifications_canister(args: Args) -> Response {
    match read_state(|state| prepare(&args, state)) {
        Ok(result) => {
            let wasm_version = result.canister_wasm.version;

            if let Err(error) = set_controllers(args.canister_id, vec![result.this_canister_id]).await {
                InternalError(format!("Failed to set controller: {error:?}"))
            } else if let Err(error) = install_basic(args.canister_id, result.canister_wasm, result.init_args).await {
                InternalError(format!("Failed to install canister: {error:?}"))
            } else {
                mutate_state(|state| commit(args.canister_id, args.local_user_index_canister_id, wasm_version, state))
            }
        }
        Err(response) => response,
    }
}

struct PrepareResult {
    this_canister_id: CanisterId,
    canister_wasm: CanisterWasm,
    init_args: notifications_canister::init::Args,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, Response> {
    if !state.data.notifications_canisters.contains_key(&args.canister_id) {
        Ok(PrepareResult {
            this_canister_id: state.env.canister_id(),
            canister_wasm: state.data.notifications_canister_wasm_for_new_canisters.clone(),
            init_args: notifications_canister::init::Args {
                notifications_index_canister_id: state.env.canister_id(),
                push_service_principals: state.data.push_service_principals.iter().copied().collect(),
                local_user_index_canister_id: args.local_user_index_canister_id,
                cycles_dispenser_canister_id: state.data.cycles_dispenser_canister_id,
                wasm_version: state.data.notifications_canister_wasm_for_new_canisters.version,
                test_mode: state.data.test_mode,
            },
        })
    } else {
        Err(AlreadyAdded)
    }
}

fn commit(
    canister_id: CanisterId,
    local_user_index_canister_id: CanisterId,
    wasm_version: BuildVersion,
    state: &mut RuntimeState,
) -> Response {
    let now = state.env.now();
    state.data.local_indexes.insert(local_user_index_canister_id);
    state
        .data
        .notifications_canisters
        .insert(canister_id, NotificationsCanister::new(wasm_version, now));

    let mut events = vec![NotificationsIndexEvent::SetNotificationPusherPrincipals(
        state.data.push_service_principals.clone(),
    )];

    for (user_id, subscription) in state
        .data
        .subscriptions
        .iter()
        .flat_map(|(user_id, subs)| subs.iter().map(|s| (*user_id, s.clone())))
    {
        events.push(NotificationsIndexEvent::SubscriptionAdded(SubscriptionAdded {
            user_id,
            subscription,
        }));
    }

    state.data.local_index_event_sync_queue.push_many(
        local_user_index_canister_id,
        events
            .iter()
            .map(|e| IdempotentEnvelope {
                created_at: now,
                idempotency_id: state.env.rng().next_u64(),
                value: e.clone(),
            })
            .collect(),
    );

    for (user_id, blocked_users) in state.data.blocked_users.collect_all() {
        for blocked_user in blocked_users {
            events.push(NotificationsIndexEvent::UserBlocked(user_id, blocked_user));
        }
    }

    for (user_id, endpoint) in state.data.bot_endpoints.iter() {
        events.push(NotificationsIndexEvent::BotEndpointUpdated(*user_id, endpoint.clone()));
    }

    state.data.notification_canisters_event_sync_queue.push_many(
        canister_id,
        events
            .into_iter()
            .map(|e| IdempotentEnvelope {
                created_at: now,
                idempotency_id: state.env.rng().next_u64(),
                value: e,
            })
            .collect(),
    );

    Success
}
