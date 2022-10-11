export const E8S_PER_TOKEN = 100000000;
export const ICP_TRANSFER_FEE_E8S = BigInt(10000);
export const cryptoCurrencyList = ["icp", "btc", "chat"];
export const cryptoLookup = {
    icp: {
        symbol: "ICP",
        name: "InternetComputer",
        transferFeesE8s: BigInt(10000),
        howToBuyUrl: "https://www.finder.com/uk/how-to-buy-internet-computer",
    },
    btc: {
        symbol: "BTC",
        name: "Bitcoin",
        transferFeesE8s: BigInt(10000),
        howToBuyUrl: "https://www.finder.com/uk/how-to-buy-bitcoin",
    },
    chat: {
        symbol: "CHAT",
        name: "OpenChat",
        transferFeesE8s: BigInt(10000),
        howToBuyUrl: "https://oc.app/#/?faq=chat_account",
    },
};
//# sourceMappingURL=crypto.js.map