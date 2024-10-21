import type { IDL } from "@dfinity/candid";
import {
    _SERVICE,
    GetAccountIdentifierTransactionsResult,
    GetAccountIdentifierTransactionsResponse,
    TimeStamp,
    TransactionWithId,
    Transaction,
    Account,
} from "./types";
export {
    _SERVICE as IcpLedgerIndexService,
    GetAccountIdentifierTransactionsResult as ApiGetTransactionsResult,
    GetAccountIdentifierTransactionsResponse as ApiGetTransactions,
    TimeStamp as ApiTimeStamp,
    TransactionWithId as ApiTransactionWithId,
};

export const idlFactory: IDL.InterfaceFactory;
