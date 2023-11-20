use exchange_bot_canister::ExchangeId;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use types::TimestampMillis;

#[derive(Serialize, Deserialize, Default)]
pub struct SwapsLog {
    log: Vec<SwapsLogEntry>,
    aggregated: BTreeMap<(String, String), AggregatedSwapMetricsInternal>,
}

impl SwapsLog {
    pub fn push(&mut self, entry: SwapsLogEntry) {
        let metrics = self
            .aggregated
            .entry((entry.input_token.clone(), entry.output_token.clone()))
            .or_default();

        metrics.count += 1;
        metrics.total_in += entry.amount_in;
        metrics.total_out += entry.amount_out;

        self.log.push(entry);
    }

    pub fn iter(&self) -> impl DoubleEndedIterator<Item = &SwapsLogEntry> {
        self.log.iter()
    }

    pub fn metrics(&self) -> Vec<AggregatedSwapMetrics> {
        self.aggregated
            .iter()
            .map(|((i, o), m)| AggregatedSwapMetrics {
                input_token: i.clone(),
                output_token: o.clone(),
                count: m.count,
                total_in: m.total_in,
                total_out: m.total_out,
            })
            .collect()
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SwapsLogEntry {
    pub timestamp: TimestampMillis,
    pub exchange_id: ExchangeId,
    pub input_token: String,
    pub output_token: String,
    pub amount_in: u128,
    pub amount_out: u128,
}

#[derive(Serialize, Deserialize, Default)]
struct AggregatedSwapMetricsInternal {
    count: u64,
    total_in: u128,
    total_out: u128,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AggregatedSwapMetrics {
    input_token: String,
    output_token: String,
    count: u64,
    total_in: u128,
    total_out: u128,
}
