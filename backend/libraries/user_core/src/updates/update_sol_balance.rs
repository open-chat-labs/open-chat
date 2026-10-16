use candid::Principal;
use cksol_minter_canister::deposit_sol::{DepositSolError, InsufficientCyclesError};
use cksol_minter_canister::{
    CKSOL_MINTER_CANISTER_ID, DEPOSIT_SOL_REQUIRED_CYCLES, MAX_DEPOSIT_SOL_CYCLES, MINIMUM_DEPOSIT_AMOUNT,
};
use ic_cdk_management_canister::{HttpMethod, HttpRequest};
use ledger_utils::convert_to_subaccount;
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use tracing::error;
use types::{CanisterId, OCResult, icrc1};

// What the user is charged for a SOL deposit, in lamports, being what they sent less what they are
// credited with: more for their first, whose sweep leaves the minter's rent reserve on the address.
// Out of it come the reserve, the deposit's share of the sweep's fee and the two ledger fees, and the
// rest goes to the treasury, covering the ~55B cycles the canister pays the minter for the sweep. The
// website shows them in the deposit view from its own copies, which must match.
pub const FIRST_SOL_DEPOSIT_FEE: u64 = 2_000_000;
pub const SOL_DEPOSIT_FEE: u64 = 1_000_000;

// Headers included. Under pay-as-you-go pricing this only sizes the cycles held during the call, the
// rest being refunded, whereas a response over it would fail the check, so it is generous.
const ALCHEMY_MAX_RESPONSE_BYTES: u64 = 16 * 1024;

// The account of the canister holding the user which their SOL deposits are minted to as ckSOL,
// from which the canister forwards them to the user's wallet, less the deposit fee. Its
// subaccount holds the user's principal, so whose ckSOL a subaccount holds can be read from it.
pub fn sol_deposit_account(canister_id: CanisterId, principal: Principal) -> icrc1::Account {
    icrc1::Account {
        owner: canister_id,
        subaccount: Some(convert_to_subaccount(&principal).0),
    }
}

// Asks the ckSOL minter to sweep the SOL deposited to the user's address into its own account, then
// mint that much ckSOL, less the deposit's share of the sweep's fee, to the user's deposit account.
// It mints once the sweep is finalized, after this returns the id of the deposit. A deposit already
// in flight is left as it is, and its id returned.
pub async fn update_sol_balance(deposit_account: icrc1::Account) -> OCResult<u64> {
    let args = cksol_minter_canister::deposit_sol::Args {
        owner: Some(deposit_account.owner),
        subaccount: deposit_account.subaccount,
    };

    let mut response =
        cksol_minter_canister_c2c_client::deposit_sol(CKSOL_MINTER_CANISTER_ID, &args, DEPOSIT_SOL_REQUIRED_CYCLES).await?;

    // The minter may since have been upgraded to require more cycles. It refunds what it doesn't
    // charge, so attach what it now asks for, within reason.
    if let Err(DepositSolError::InsufficientCycles(InsufficientCyclesError { expected, .. })) = &response
        && let Ok(cycles) = u128::try_from(&expected.0)
        && cycles <= MAX_DEPOSIT_SOL_CYCLES
    {
        response = cksol_minter_canister_c2c_client::deposit_sol(CKSOL_MINTER_CANISTER_ID, &args, cycles).await?;
    }

    match response {
        Ok(deposit_id) => Ok(deposit_id),
        Err(DepositSolError::ValueTooSmall {
            minimum_deposit_amount, ..
        }) => {
            if minimum_deposit_amount != MINIMUM_DEPOSIT_AMOUNT {
                error!(minimum_deposit_amount, "The ckSOL minter's minimum deposit has changed");
            }
            Err(OCErrorCode::NoChange.into())
        }
        Err(DepositSolError::AlreadyProcessing) => Err(OCErrorCode::NoChange.into()),
        Err(error) => {
            error!(?error, "Failed to update SOL balance");
            Err(OCErrorCode::Unknown.with_json(&error))
        }
    }
}

#[derive(Serialize)]
pub struct SolDepositEventPayload {
    pub amount: u64,
}

// The finalized balance of a Solana address, in lamports, from Alchemy's Solana RPC. The request is
// made from a single replica rather than from each of the subnet's, since the worst a replica giving
// a false balance could do is cost one call to the minter, or leave a deposit to be credited at the
// next attempt. The key is in the URL, so it is removed from any error.
pub async fn sol_balance_from_alchemy(api_key: &str, address: &str) -> Result<u64, String> {
    let result = HttpRequest::new(alchemy_solana_url(api_key))
        .with_method(HttpMethod::POST)
        .with_header("content-type", "application/json")
        .with_body(get_balance_request_body(address))
        .with_max_response_bytes(ALCHEMY_MAX_RESPONSE_BYTES)
        .non_replicated()
        .send()
        .await;

    match result {
        Ok(response) => {
            let status = u32::try_from(response.status.0).unwrap_or_default();
            parse_get_balance_response(status, &response.body)
        }
        Err(error) => Err(format!("HTTPS outcall failed: {error:?}")),
    }
    .map_err(|error| error.replace(api_key, "<api key>"))
}

fn alchemy_solana_url(api_key: &str) -> String {
    format!("https://solana-mainnet.g.alchemy.com/v2/{api_key}")
}

// At finalized commitment, at which the minter reads the balance too
fn get_balance_request_body(address: &str) -> Vec<u8> {
    serde_json::to_vec(&serde_json::json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getBalance",
        "params": [address, { "commitment": "finalized" }],
    }))
    .unwrap()
}

fn parse_get_balance_response(status: u32, body: &[u8]) -> Result<u64, String> {
    #[derive(Deserialize)]
    struct GetBalanceResponse {
        result: Option<GetBalanceResult>,
        error: Option<serde_json::Value>,
    }

    #[derive(Deserialize)]
    struct GetBalanceResult {
        value: u64,
    }

    if status != 200 {
        return Err(format!("Alchemy returned status {status}: {}", String::from_utf8_lossy(body)));
    }

    let response: GetBalanceResponse =
        serde_json::from_slice(body).map_err(|error| format!("Failed to parse Alchemy's response: {error}"))?;

    match (response.result, response.error) {
        (Some(result), _) => Ok(result.value),
        (None, Some(error)) => Err(format!("Alchemy returned an error: {error}")),
        (None, None) => Err("Alchemy's response had neither a result nor an error".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn asks_for_the_finalized_balance_of_the_address() {
        let body: serde_json::Value = serde_json::from_slice(&get_balance_request_body("address")).unwrap();
        assert_eq!(body["method"], "getBalance");
        assert_eq!(body["params"][0], "address");
        assert_eq!(body["params"][1]["commitment"], "finalized");
    }

    #[test]
    fn reads_the_balance_from_the_result() {
        let body =
            br#"{"jsonrpc":"2.0","result":{"context":{"apiVersion":"2.0.15","slot":341197053},"value":20000000},"id":1}"#;
        assert_eq!(parse_get_balance_response(200, body), Ok(20_000_000));
    }

    #[test]
    fn rpc_errors_and_failed_requests_are_errors() {
        let rpc_error = br#"{"jsonrpc":"2.0","error":{"code":-32602,"message":"Invalid param"},"id":1}"#;
        assert!(parse_get_balance_response(200, rpc_error).is_err());
        assert!(parse_get_balance_response(429, b"Too many requests").is_err());
        assert!(parse_get_balance_response(200, b"not json").is_err());
        assert!(parse_get_balance_response(200, br#"{"jsonrpc":"2.0","id":1}"#).is_err());
    }
}
