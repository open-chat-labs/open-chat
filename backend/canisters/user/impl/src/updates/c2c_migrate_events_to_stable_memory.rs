use crate::guards::caller_is_local_user_index;
use crate::{mutate_state, Data};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use types::{CanisterId, Empty};
use user_canister::c2c_migrate_events_to_stable_memory::*;

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_migrate_events_to_stable_memory(_args: Args) -> Response {
    mutate_state(|state| migrate_events_to_stable_memory_impl(&mut state.data, false))
}

pub(crate) fn migrate_events_to_stable_memory_impl(data: &mut Data, notify: bool) -> bool {
    if data.stable_memory_event_migration_complete {
        return true;
    }
    for chat in data.direct_chats.iter_mut() {
        let finished = chat.events.migrate_next_batch_of_events_to_stable_storage();
        if !finished {
            return false;
        }
    }
    if notify {
        ic_cdk::spawn(notify_migration_to_stable_memory_complete(data.local_user_index_canister_id));
    } else {
        data.stable_memory_event_migration_complete = true;
    }
    true
}

async fn notify_migration_to_stable_memory_complete(local_group_index: CanisterId) {
    if local_user_index_canister_c2c_client::c2c_mark_events_migrated_to_stable_memory(local_group_index, &Empty {})
        .await
        .is_ok()
    {
        mutate_state(|state| state.data.stable_memory_event_migration_complete = true);
    }
}
