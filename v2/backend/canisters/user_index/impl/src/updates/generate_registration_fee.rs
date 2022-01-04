use crate::model::user::{UnconfirmedCyclesRegistrationFee, UnconfirmedUser, UnconfirmedUserState, User};
use crate::{mutate_state, RuntimeState, CONFIRMATION_CODE_EXPIRY_MILLIS};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::Cycles;
use user_index_canister::generate_registration_fee::{Response::*, *};

const BASELINE_REGISTRATION_FEE: Cycles = 1_000_000_000_000; // 1T cycles

#[update]
#[trace]
fn generate_registration_fee(_args: Args) -> Response {
    mutate_state(generate_registration_fee_impl)
}

fn generate_registration_fee_impl(runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();

    let mut cycles_amount: Option<Cycles> = None;
    if let Some(user) = runtime_state.data.users.get_by_principal(&caller).cloned() {
        match &user {
            User::Unconfirmed(u) => {
                if let UnconfirmedUserState::CyclesFee(p) = &u.state {
                    cycles_amount = Some(p.amount);
                }
                runtime_state.data.users.remove_by_principal(&user.get_principal());
            }
            _ => return AlreadyRegistered,
        }
    }

    let amount = cycles_amount.unwrap_or_else(|| generate_new_fee_amount(runtime_state));
    let valid_until = now + CONFIRMATION_CODE_EXPIRY_MILLIS;

    let user = UnconfirmedUser {
        principal: caller,
        state: UnconfirmedUserState::CyclesFee(UnconfirmedCyclesRegistrationFee { amount, valid_until }),
    };
    runtime_state.data.users.add(user);
    Success(SuccessResult { amount, valid_until })
}

fn generate_new_fee_amount(runtime_state: &mut RuntimeState) -> Cycles {
    loop {
        let amount = BASELINE_REGISTRATION_FEE + ((runtime_state.env.random_u32() % 1_000_000) as u128);
        if runtime_state.data.users.get_by_registration_fee_cycles(&amount).is_none() {
            return amount;
        }
    }
}
