use ic_cdk::management_canister::{HttpRequestResult, TransformArgs};
use ic_cdk::query;

#[query]
fn transform_http_response(args: TransformArgs) -> HttpRequestResult {
    let mut response = args.response;
    response.headers.clear();
    response
}
