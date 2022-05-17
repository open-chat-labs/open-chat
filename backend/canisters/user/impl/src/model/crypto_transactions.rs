use candid::CandidType;
use ic_ledger_types::{Block, BlockIndex};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use types::{Cryptocurrency, CryptocurrencyTransaction};

#[derive(CandidType, Serialize, Deserialize, Default)]
pub struct CryptoTransactions {
    transactions: HashMap<Cryptocurrency, BTreeMap<BlockIndex, (CryptocurrencyTransaction, Block)>>,
}

impl CryptoTransactions {
    #[allow(dead_code)]
    pub fn get(&self, token: Cryptocurrency, block_index: BlockIndex) -> Option<(CryptocurrencyTransaction, Block)> {
        self.transactions.get(&token).and_then(|t| t.get(&block_index)).cloned()
    }

    pub fn add(&mut self, block_index: BlockIndex, transaction: CryptocurrencyTransaction, block: Block) {
        self.transactions
            .entry(transaction.token())
            .or_default()
            .insert(block_index, (transaction, block));
    }
}
