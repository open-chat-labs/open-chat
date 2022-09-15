#!/usr/bin/env node

const { HttpAgent } = require("@dfinity/agent");
const { Ed25519KeyIdentity } = require("@dfinity/identity");
const { AccountIdentifier, LedgerCanister } = require("@dfinity/nns");
const fetch = require("cross-fetch");
global.fetch = fetch;

const [,, ...args] = process.argv;

async function mintTestIcp(accountIdentifier, e8s) {
    if (accountIdentifier === undefined) throw new Error("AccountIdentifier not set");
    if (e8s === undefined) throw new Error("E8s not set");

    // Create an identity whose default ledger account is initialised with 10k ICP.
    // The identity's principal is jg6qm-uw64t-m6ppo-oluwn-ogr5j-dc5pm-lgy2p-eh6px-hebcd-5v73i-nqe
    // The identity's default ledger address is 5b315d2f6702cb3a27d826161797d7b2c2e131cd312aece51d4d5574d1247087
    const publicKey = "Uu8wv55BKmk9ZErr6OIt5XR1kpEGXcOSOC1OYzrAwuk=";
    const privateKey = "N3HB8Hh2PrWqhWH2Qqgr1vbU9T3gb1zgdBD8ZOdlQnVS7zC/nkEqaT1kSuvo4i3ldHWSkQZdw5I4LU5jOsDC6Q==";
    const identity = Ed25519KeyIdentity.fromKeyPair(
        base64ToUInt8Array(publicKey),
        base64ToUInt8Array(privateKey)
    );

    const agent = new HttpAgent({
        host: "http://127.0.0.1:8080/",
        identity,
    });
    await agent.fetchRootKey();

    const ledgerCanister = LedgerCanister.create({agent});

    await ledgerCanister.transfer({
        amount: e8s,
        to: accountIdentifier,
    });
}

function base64ToUInt8Array(base64String) {
    return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
}

const accountIdentifier = AccountIdentifier.fromHex(args[0]);
const e8s = BigInt(args[1]);

mintTestIcp(accountIdentifier, e8s);
