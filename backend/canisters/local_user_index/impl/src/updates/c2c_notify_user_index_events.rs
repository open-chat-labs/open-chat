use crate::guards::caller_is_user_index_canister;
use crate::{mutate_state, RuntimeState};
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister::c2c_notify_user_index_events::{Args, Response, UserIndexEvent};
use tracing::info;
use types::{PhoneNumberConfirmed, ReferredUserRegistered, StorageUpgraded, UserEvent, UserSuspended, UsernameChanged};

#[update_msgpack(guard = "caller_is_user_index_canister")]
#[trace]
fn c2c_notify_user_index_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_user_index_events_impl(args, state))
}

fn c2c_notify_user_index_events_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    for event in args.events {
        handle_event(event, runtime_state);
    }

    Response::Success
}

fn handle_event(event: UserIndexEvent, runtime_state: &mut RuntimeState) {
    match event {
        UserIndexEvent::UsernameChanged(ev) => {
            runtime_state.data.user_event_sync_queue.push(
                ev.user_id.into(),
                UserEvent::UsernameChanged(Box::new(UsernameChanged { username: ev.username })),
            );
        }
        UserIndexEvent::UserSuspended(ev) => {
            runtime_state.data.user_event_sync_queue.push(
                ev.user_id.into(),
                UserEvent::UserSuspended(Box::new(UserSuspended {
                    timestamp: ev.timestamp,
                    duration: ev.duration,
                    reason: ev.reason,
                    suspended_by: ev.suspended_by,
                })),
            );
        }
        UserIndexEvent::PhoneNumberConfirmed(ev) => {
            runtime_state.data.user_event_sync_queue.push(
                ev.user_id.into(),
                UserEvent::PhoneNumberConfirmed(Box::new(PhoneNumberConfirmed {
                    phone_number: ev.phone_number,
                    storage_added: ev.storage_added,
                    new_storage_limit: ev.new_storage_limit,
                })),
            );
        }
        UserIndexEvent::StorageUpgraded(ev) => {
            runtime_state.data.user_event_sync_queue.push(
                ev.user_id.into(),
                UserEvent::StorageUpgraded(Box::new(StorageUpgraded {
                    cost: ev.cost,
                    storage_added: ev.storage_added,
                    new_storage_limit: ev.new_storage_limit,
                })),
            );
        }
        UserIndexEvent::UserRegistered(ev) => {
            runtime_state.data.global_users.add(ev.user_principal, ev.user_id, ev.is_bot);

            if let Some(referred_by) = ev.referred_by {
                if runtime_state.data.local_users.get(&referred_by).is_some() {
                    runtime_state.data.user_event_sync_queue.push(
                        referred_by.into(),
                        UserEvent::ReferredUserRegistered(Box::new(ReferredUserRegistered {
                            user_id: ev.user_id,
                            username: ev.username,
                        })),
                    );
                }
            }
        }
        UserIndexEvent::SuperAdminStatusChanged(ev) => {
            runtime_state.data.global_users.set_super_admin(ev.user_id, ev.is_super_admin);
        }
        UserIndexEvent::MaxConcurrentCanisterUpgradesChanged(ev) => {
            runtime_state.data.max_concurrent_canister_upgrades = ev.value;
            info!("Max concurrent canister upgrades set to {}", ev.value);
        }
        UserIndexEvent::LocalUserAdded(ev) => {
            runtime_state.data.global_users.add(ev.user_principal, ev.user_id, false);
            runtime_state.data.local_users.add(ev.user_id, ev.wasm_version, ev.created);
        }
    }
    crate::jobs::sync_events_to_user_canisters::start_job_if_required(runtime_state);
}
