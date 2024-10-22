import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    GetTransactionsResult,
    GetTransactions,
    TransactionWithId,
    Transaction,
    Account,
} from "./types";
export {
    _SERVICE as LedgerIndexService,
    GetTransactionsResult as ApiGetTransactionsResult,
    GetTransactions as ApiGetTransactions,
    TransactionWithId as ApiTransactionWithId,
    Transaction as ApiTransaction,
    Account as ApiAccount,
};

export const idlFactory: IDL.InterfaceFactory;
