use crate::{model::user::SuspensionDuration, read_state, RuntimeState, TIME_UNTIL_SUSPENDED_ACCOUNT_IS_DELETED_MILLIS};
use ic_cdk_macros::query;
use ledger_utils::default_ledger_account;
use types::CanisterUpgradeStatus;
use user_index_canister::current_user::{Response::*, *};

#[query]
fn current_user(_args: Args) -> Response {
    read_state(current_user_impl)
}

fn current_user_impl(runtime_state: &RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(u) = runtime_state.data.users.get_by_principal(&caller) {
        let canister_upgrade_status = if u.upgrade_in_progress {
            CanisterUpgradeStatus::InProgress
        } else {
            CanisterUpgradeStatus::NotRequired
        };

        let suspension_details = u.suspension_details.as_ref().map(|d| SuspensionDetails {
            reason: d.reason.to_owned(),
            action: match d.duration {
                SuspensionDuration::Duration(ms) => SuspensionAction::Unsuspend(d.timestamp + ms),
                SuspensionDuration::Indefinitely => {
                    SuspensionAction::Delete(d.timestamp + TIME_UNTIL_SUSPENDED_ACCOUNT_IS_DELETED_MILLIS)
                }
            },
            suspended_by: d.suspended_by,
        });

        let now = runtime_state.env.now();

        Success(SuccessResult {
            user_id: u.user_id,
            username: u.username.clone(),
            canister_upgrade_status,
            avatar_id: u.avatar_id,
            wasm_version: u.wasm_version,
            icp_account: default_ledger_account(u.user_id.into()),
            referrals: runtime_state.data.users.referrals(&u.user_id),
            is_super_admin: runtime_state.data.platform_moderators.contains(&u.user_id),
            suspension_details,
            is_suspected_bot: runtime_state.data.users.is_suspected_bot(&u.user_id),
            diamond_membership_details: u.diamond_membership_details.hydrate(now),
        })
    } else {
        UserNotFound
    }
}
