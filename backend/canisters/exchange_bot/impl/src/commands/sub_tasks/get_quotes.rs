use crate::commands::CommandSubTaskResult;
use crate::swap_client::SwapClient;
use ledger_utils::format_crypto_amount;

pub(crate) async fn get_quote(client: &dyn SwapClient, amount: u128, output_token_decimals: u8) -> CommandSubTaskResult<u128> {
    let response = client.quote(amount).await;

    match response {
        Ok(amount_out) => {
            CommandSubTaskResult::Complete(amount_out, Some(format_crypto_amount(amount_out, output_token_decimals)))
        }
        Err(error) => CommandSubTaskResult::Failed(format!("{error:?}")),
    }
}
