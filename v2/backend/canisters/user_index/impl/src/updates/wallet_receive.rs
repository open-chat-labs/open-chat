use crate::model::user::{ConfirmedUser, User};
use crate::{RuntimeState, RUNTIME_STATE};
use canister_api_macros::trace;
use cycles_utils::accept_cycles;
use ic_cdk_macros::update;
use types::{CanisterCreationStatusInternal, Cycles};

const TWO_TRILLION: u128 = 2_000_000_000_000;

#[update]
#[trace]
fn wallet_receive() {
    let cycles_available = ic_cdk::api::call::msg_cycles_available() as Cycles;
    if cycles_available < TWO_TRILLION {
        // If the cycles amount is < 2T, we assume that the payment is being made to register a user
        // in which case we either successfully register a user or we refund the cycles.
        RUNTIME_STATE.with(|state| try_confirm_user(cycles_available as Cycles, state.borrow_mut().as_mut().unwrap()));
    } else {
        // If the cycles amount is >= 2T, we assume this is a donation / top-up and accept all of
        // the cycles
        accept_cycles();
    }
}

fn try_confirm_user(cycles: Cycles, runtime_state: &mut RuntimeState) {
    if let Some(principal) = runtime_state
        .data
        .users
        .get_by_registration_fee_cycles(&cycles)
        .map(|u| u.get_principal())
    {
        accept_cycles();

        let user = User::Confirmed(ConfirmedUser {
            principal,
            phone_number: None,
            username: None,
            date_confirmed: runtime_state.env.now(),
            canister_creation_status: CanisterCreationStatusInternal::Pending(None),
            upgrade_in_progress: false,
        });
        runtime_state.data.users.update(user);
    }
}
