use crate::commands::CommandSubTaskResult;
use crate::swap_client::SwapClient;
use exchange_bot_canister::ExchangeId;
use futures::stream::FuturesUnordered;
use futures::StreamExt;
use ledger_utils::format_crypto_amount;
use std::future::ready;

pub(crate) async fn get_quotes<C: FnMut(ExchangeId, CommandSubTaskResult<u128>)>(
    clients: Vec<Box<dyn SwapClient>>,
    amount: u128,
    mut callback: C,
) {
    let futures = FuturesUnordered::new();
    for client in clients {
        futures.push(get_quote(client, amount));
    }

    futures
        .for_each(|(exchange_id, result)| {
            callback(exchange_id, result);
            ready(())
        })
        .await;
}

async fn get_quote(client: Box<dyn SwapClient>, amount: u128) -> (ExchangeId, CommandSubTaskResult<u128>) {
    let response = client.quote(amount).await;

    let result = match response {
        Ok(amount_out) => {
            let output_token = client.output_token();
            let text = format!(
                "{} {}",
                format_crypto_amount(amount_out, output_token.decimals),
                output_token.token.token_symbol()
            );
            CommandSubTaskResult::Complete(amount_out, Some(text))
        }
        Err(error) => CommandSubTaskResult::Failed(format!("{error:?}")),
    };

    let exchange_id = client.exchange_id();
    (exchange_id, result)
}
