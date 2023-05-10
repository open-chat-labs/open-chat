use crate::guards::caller_is_dev_team_dfx_principal;
use crate::mutate_state;
use canister_tracing_macros::trace;
use ic_cdk_macros::update;
use local_user_index_canister::{Event, ReferralCodeAdded};
use types::ReferralType;
use user_index_canister::add_referral_codes::{Response::*, *};

#[update(guard = "caller_is_dev_team_dfx_principal")]
#[trace]
fn add_referral_codes(args: Args) -> Response {
    if matches!(args.referral_type, ReferralType::User) {
        panic!("Cannot add referral code of type User");
    }

    mutate_state(|state| {
        let local_user_index = state.data.local_index_map.index_for_new_user().unwrap();

        for code in args.codes {
            state.data.user_index_event_sync_queue.push(
                local_user_index,
                Event::ReferralCodeAdded(ReferralCodeAdded {
                    referral_type: args.referral_type,
                    code,
                }),
            );
        }
        crate::jobs::sync_events_to_local_user_index_canisters::start_job_if_required(state);
    });

    Success
}
