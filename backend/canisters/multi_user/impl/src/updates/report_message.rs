use crate::guards::caller_is_hosted_user;
use crate::{RuntimeState, mutate_state, read_state};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{CanisterId, OCResult};
use user_canister::report_message::*;
use user_core::updates::report_message::{build_report, delete_reported_message};
use user_index_canister::c2c_report_message;

#[update(guard = "caller_is_hosted_user", msgpack = true)]
#[trace]
async fn report_message(args: Args) -> Response {
    let (my_index, c2c_args, user_index_canister) = match read_state(|state| prepare(&args, state)) {
        Ok(ok) => ok,
        Err(error) => return Response::Error(error),
    };

    match user_index_canister_c2c_client::c2c_report_message(user_index_canister, &c2c_args).await {
        Ok(result) => {
            if args.delete {
                mutate_state(|state| {
                    let now = state.env.now();
                    // Does nothing if the user was deleted while the report was being made
                    state.data.users.with_user_mut(my_index, |user| {
                        delete_reported_message(user, &args, c2c_args.reporter, now, &state.data.migrated_user_ids)
                    });
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

fn prepare(args: &Args, state: &RuntimeState) -> OCResult<(u16, c2c_report_message::Args, CanisterId)> {
    state.with_caller_user(|my_index, user| {
        let report = build_report(user, args, state.user_id(my_index))?;
        Ok((my_index, report, state.data.user_index_canister_id))
    })
}
