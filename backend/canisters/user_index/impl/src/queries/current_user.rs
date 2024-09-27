use crate::{read_state, RuntimeState};
use canister_api_macros::query;
use ledger_utils::default_ledger_account;
use types::{BuildVersion, CanisterUpgradeStatus};
use user_index_canister::current_user::{Response::*, *};

#[query(candid = true, msgpack = true)]
fn current_user(_args: Args) -> Response {
    read_state(current_user_impl)
}

fn current_user_impl(state: &RuntimeState) -> Response {
    let caller = state.env.caller();

    if let Some(u) = state.data.users.get_by_principal(&caller) {
        let now = state.env.now();

        let suspension_details = u.suspension_details.as_ref().map(|d| d.into());

        Success(SuccessResult {
            user_id: u.user_id,
            username: u.username.clone(),
            date_created: u.date_created,
            display_name: u.display_name.clone(),
            canister_upgrade_status: CanisterUpgradeStatus::NotRequired,
            avatar_id: u.avatar_id,
            wasm_version: BuildVersion::default(),
            icp_account: default_ledger_account(u.user_id.into()),
            referrals: state.data.users.referrals(&u.user_id),
            is_platform_moderator: state.data.platform_moderators.contains(&u.user_id),
            is_platform_operator: state.data.platform_operators.contains(&u.user_id),
            suspension_details,
            is_suspected_bot: state.data.users.is_suspected_bot(&u.user_id),
            diamond_membership_details: u.diamond_membership_details.hydrate(now),
            diamond_membership_status: u.diamond_membership_details.status_full(now),
            moderation_flags_enabled: u.moderation_flags_enabled,
            is_unique_person: u.unique_person_proof.is_some(),
        })
    } else {
        UserNotFound
    }
}
