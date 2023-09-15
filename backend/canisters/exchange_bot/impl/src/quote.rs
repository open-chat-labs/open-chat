// use crate::swap_client::SwapClient;
// use crate::{read_state, RuntimeState};
// use exchange_bot_canister::ExchangeId;
// use serde::{Deserialize, Serialize};
// use types::{TokenInfo, UserId};
//
// pub struct QuoteArgs {
//     pub caller: UserId,
//     pub input_token: TokenInfo,
//     pub output_token: TokenInfo,
//     pub amount: u128,
// }
//
// pub struct PrepareQuoteResult {
//     message_text: String,
//     clients: Vec<Box<dyn SwapClient>>,
// }
//
// #[derive(Serialize, Deserialize, Debug)]
// pub struct QuoteResult {
//     pub quotes: Vec<Quote>,
//     pub failures: Vec<Failure>,
// }
//
// #[derive(Serialize, Deserialize, Debug)]
// pub struct Quote {
//     pub exchange_id: ExchangeId,
//     pub amount_out: u128,
// }
//
// #[derive(Serialize, Deserialize, Debug)]
// pub struct Failure {
//     pub exchange_id: ExchangeId,
//     pub error: String,
// }
//
// async fn quote(args: QuoteArgs) {
//     let PrepareResult { clients } = match read_state(|state| prepare(&args, state)) {
//         Ok(ok) => ok,
//         Err(response) => return response,
//     };
//
//     let futures: Vec<_> = clients.into_iter().map(|c| quote_single(c, args.amount)).collect();
//
//     let results = futures::future::join_all(futures).await;
//
//     let mut quotes = Vec::new();
//     let mut failures = Vec::new();
//     for (exchange_id, result) in results {
//         match result {
//             Ok(amount_out) => quotes.push(Quote { exchange_id, amount_out }),
//             Err(error) => failures.push(Failure { exchange_id, error }),
//         }
//     }
//
//     if failures.is_empty() {
//         Success(quotes)
//     } else if quotes.is_empty() {
//         Failed(failures)
//     } else {
//         PartialSuccess(PartialSuccessResult { quotes, failures })
//     }
// }
