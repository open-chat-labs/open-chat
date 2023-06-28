use crate::guards::caller_is_governance_principal;
use crate::{mutate_state, read_state};
use canister_api_macros::proposal;
use canister_tracing_macros::trace;
use registry_canister::add_token::{Response::*, *};

#[proposal(guard = "caller_is_governance_principal")]
#[trace]
async fn add_token(args: Args) -> Response {
    if read_state(|state| state.data.tokens.exists(args.ledger_canister_id)) {
        return AlreadyAdded;
    }

    let client = ic_icrc1_client::ICRC1Client {
        ledger_canister_id: args.ledger_canister_id,
        runtime: ic_icrc1_client_cdk::CdkRuntime,
    };

    match futures::future::try_join4(client.name(), client.symbol(), client.decimals(), client.fee()).await {
        Ok((name, symbol, decimals, fee)) => mutate_state(|state| {
            let now = state.env.now();
            if state.data.tokens.add(
                args.ledger_canister_id,
                name,
                symbol,
                decimals,
                fee as u128,
                args.info_url,
                args.how_to_buy_url,
                args.transaction_url_format,
                now,
            ) {
                state.data.version += 1;
                Success
            } else {
                AlreadyAdded
            }
        }),
        Err(error) => InternalError(format!("{error:?}")),
    }
}
