use crate::model::user::{UnconfirmedUser, UnconfirmedUserState, User};
use crate::{mutate_state, RuntimeState, CONFIRMATION_CODE_EXPIRY_MILLIS};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use ic_ledger_types::{AccountIdentifier, Tokens};
use ledger_utils::convert_to_subaccount;
use types::{Cryptocurrency, Cycles, CyclesRegistrationFee, ICPRegistrationFee, RegistrationFee};
use user_index_canister::generate_registration_fee::{Response::*, *};

const ICP_REGISTRATION_FEE: Tokens = Tokens::from_e8s(5_000_000); // 0.05 ICP
const BASELINE_CYCLES_REGISTRATION_FEE: Cycles = 1_000_000_000_000; // 1T cycles

#[update]
#[trace]
fn generate_registration_fee(args: Args) -> Response {
    mutate_state(|state| generate_registration_fee_impl(args, state))
}

fn generate_registration_fee_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();
    let now = runtime_state.env.now();
    let valid_until = now + CONFIRMATION_CODE_EXPIRY_MILLIS;

    let fee = match args.currency {
        Cryptocurrency::ICP => {
            let mut amount = ICP_REGISTRATION_FEE;
            if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
                match &user {
                    User::Unconfirmed(u) => {
                        if let UnconfirmedUserState::RegistrationFee(RegistrationFee::ICP(f)) = &u.state {
                            amount = f.amount;
                        }
                    }
                    _ => return AlreadyRegistered,
                }
            }

            let subaccount = convert_to_subaccount(&caller);
            let recipient = AccountIdentifier::new(&runtime_state.env.canister_id(), &subaccount);

            RegistrationFee::ICP(ICPRegistrationFee {
                amount,
                recipient,
                valid_until,
            })
        }
        Cryptocurrency::Cycles => {
            let mut cycles_amount: Option<Cycles> = None;
            if let Some(user) = runtime_state.data.users.get_by_principal(&caller) {
                match &user {
                    User::Unconfirmed(u) => {
                        if let UnconfirmedUserState::RegistrationFee(RegistrationFee::Cycles(f)) = &u.state {
                            cycles_amount = Some(f.amount);
                        }
                    }
                    _ => return AlreadyRegistered,
                }
            }

            let amount = cycles_amount.unwrap_or_else(|| generate_new_cycles_fee_amount(runtime_state));
            let recipient = runtime_state.env.canister_id();

            RegistrationFee::Cycles(CyclesRegistrationFee {
                amount,
                recipient,
                valid_until,
            })
        }
    };

    runtime_state.data.users.remove_by_principal(&caller);
    runtime_state.data.users.add(UnconfirmedUser {
        principal: caller,
        state: UnconfirmedUserState::RegistrationFee(fee.clone()),
    });

    Success(SuccessResult { fee })
}

fn generate_new_cycles_fee_amount(runtime_state: &mut RuntimeState) -> Cycles {
    loop {
        let amount = BASELINE_CYCLES_REGISTRATION_FEE + ((runtime_state.env.random_u32() % 1_000_000) as u128);
        if runtime_state.data.users.get_by_registration_fee_cycles(&amount).is_none() {
            return amount;
        }
    }
}
