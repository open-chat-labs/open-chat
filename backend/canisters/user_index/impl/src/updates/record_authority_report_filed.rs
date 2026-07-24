use crate::guards::caller_is_platform_operator;
use crate::{RuntimeState, mutate_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use user_index_canister::record_authority_report_filed::*;

#[update(guard = "caller_is_platform_operator", msgpack = true)]
#[trace]
fn record_authority_report_filed(args: Args) -> Response {
    mutate_state(|state| record_authority_report_filed_impl(args, state)).into()
}

fn record_authority_report_filed_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    let now = state.env.now();

    if state.data.reported_messages.get(args.report_index).is_none() {
        return Err(OCErrorCode::MessageNotFound.into());
    }

    state
        .data
        .authority_reports
        .record_filed(args.report_index, args.portal_reference, args.urgent, args.unverified, now);

    if args.unverified {
        // The urgency valve: an honest-unverified report was filed before any verdict; the
        // report's verdict remains open and is resolved by a reviewer
        state
            .data
            .reported_messages
            .mark_unverified_report_filed(args.report_index, now);
    }

    Ok(())
}
