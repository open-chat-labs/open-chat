use crate::model::user::{UnconfirmedUser, UnconfirmedUserState, User};
use crate::{mutate_state, RuntimeState, REGISTRATION_FEE_EXPIRY_MILLIS};
use canister_api_macros::trace;
use ic_cdk_macros::update;
use types::{Cryptocurrency, Cycles, CyclesRegistrationFee, ICPRegistrationFee, RegistrationFee, ICP};
use user_index_canister::generate_registration_fee::{Response::*, *};

const ICP_REGISTRATION_FEE: ICP = ICP::from_e8s(10_000_000); // 0.1 ICP
const BASELINE_CYCLES_REGISTRATION_FEE: Cycles = 2_000_000_000_000; // 2T cycles

#[update]
#[trace]
fn generate_registration_fee(args: Args) -> Response {
    mutate_state(|state| generate_registration_fee_impl(args, state))
}

fn generate_registration_fee_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    let caller = runtime_state.env.caller();

    if let Some(User::Confirmed(_) | User::Created(_)) = runtime_state.data.users.get_by_principal(&caller) {
        return AlreadyRegistered;
    }

    let now = runtime_state.env.now();
    let valid_until = now + REGISTRATION_FEE_EXPIRY_MILLIS;

    let fee = match args.currency {
        Cryptocurrency::ICP => {
            let recipient = runtime_state.user_storage_upgrade_icp_account(caller.into());

            RegistrationFee::ICP(ICPRegistrationFee {
                amount: ICP_REGISTRATION_FEE,
                recipient,
                valid_until,
            })
        }
        Cryptocurrency::Cycles => {
            let amount = generate_new_cycles_fee_amount(runtime_state);
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
