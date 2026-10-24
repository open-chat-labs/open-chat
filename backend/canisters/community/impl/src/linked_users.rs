use crate::{RuntimeState, mutate_state};
use types::{BridgedUserId, UserId};

// A message a bridge bot relayed from another platform is shown as from whoever linked the account
// it came from there, so activity on it, such as a reaction, is for them. Who that is isn't known
// here, so the LocalUserIndex is asked once the activity is done, and `on_found` called with them.
// If no one has linked the account, or the call fails, there's no one to tell.
pub(crate) fn on_linked_user_found<F: FnOnce(UserId, &mut RuntimeState) + 'static>(
    account: BridgedUserId,
    state: &RuntimeState,
    on_found: F,
) {
    let local_user_index_canister_id = state.data.local_user_index_canister_id;
    ic_cdk::futures::spawn_migratory(async move {
        if let Ok(Some(linked_user)) =
            local_user_index_canister_c2c_client::bridged_user_link(account, local_user_index_canister_id).await
        {
            mutate_state(|state| on_found(linked_user, state));
        }
    });
}
