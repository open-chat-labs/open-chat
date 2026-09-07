use crate::guards::caller_is_platform_operator;
use crate::read_state;
use canister_api_macros::query;
use serde::Serialize;
use user_index_canister::authority_reports::{Response::*, *};

#[query(guard = "caller_is_platform_operator", candid = true, msgpack = true)]
fn authority_reports(_args: Args) -> Response {
    read_state(|state| {
        #[derive(Serialize)]
        struct Register<'a> {
            due: &'a [crate::model::authority_reports::AuthorityReportDue],
            attempts: &'a [crate::model::authority_reports::AuthorityReportAttempt],
            filed: &'a [crate::model::authority_reports::AuthorityReportFiled],
        }
        let register = Register {
            due: state.data.authority_reports.due(),
            attempts: state.data.authority_reports.attempts(),
            filed: state.data.authority_reports.filed(),
        };
        Success(SuccessResult {
            json: serde_json::to_string(&register).unwrap(),
        })
    })
}
