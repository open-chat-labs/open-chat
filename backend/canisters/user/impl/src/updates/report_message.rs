use crate::guards::caller_is_owner;
use crate::{RuntimeState, execute_update_async, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult};
use user_canister::report_message::*;
use user_core::updates::report_message::{build_report, delete_reported_message};
use user_index_canister::c2c_report_message;

#[update(guard = "caller_is_owner", msgpack = true)]
#[trace]
async fn report_message(args: Args) -> Response {
    execute_update_async(|| report_message_impl(args)).await
}

async fn report_message_impl(args: Args) -> Response {
    let (c2c_args, user_index_canister) = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    match user_index_canister_c2c_client::c2c_report_message(user_index_canister, &c2c_args).await {
        Ok(result) => {
            if args.delete {
                mutate_state(|state| {
                    let now = state.env.now();
                    delete_reported_message(
                        &mut state.data.user,
                        &args,
                        c2c_args.reporter,
                        now,
                        &state.data.migrated_user_ids,
                    )
                });
            }

            match result {
                c2c_report_message::Response::Success => Response::Success,
                c2c_report_message::Response::AlreadyReported => Response::Error(OCErrorCode::AlreadyReported.into()),
            }
        }
        Err(error) => Response::Error(error.into()),
    }
}

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<(c2c_report_message::Args, CanisterId)> {
    let report = build_report(&state.data.user, args, state.env.canister_id().into())?;
    Ok((report, state.data.user_index_canister_id))
}
