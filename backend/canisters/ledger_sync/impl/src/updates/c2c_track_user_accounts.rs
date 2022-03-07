use crate::{mutate_state, RuntimeState};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{AccountIdentifier, DEFAULT_SUBACCOUNT};
use ledger_sync_canister::c2c_track_user_accounts::{Response::*, *};
use types::CanisterId;

#[update]
#[trace]
fn c2c_track_user_accounts(args: Args) -> Response {
    mutate_state(|state| c2c_track_user_accounts_impl(args, state))
}

fn c2c_track_user_accounts_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    for user_id in args.users {
        let canister_id: CanisterId = user_id.into();
        let account_identifier = AccountIdentifier::new(&canister_id, &DEFAULT_SUBACCOUNT);
        runtime_state.data.accounts.add(account_identifier, canister_id);
    }
    Success
}
