import { HttpAgent, type Identity } from "@icp-sdk/core/agent";
import { isMainnet } from "./network";
import { offline } from "openchat-shared";

export function createHttpAgentSync(identity: Identity, icUrl: string): HttpAgent {
    const [agent] = createHttpAgentInternal(identity, icUrl);
    return agent;
}

export async function createHttpAgent(identity: Identity, icUrl: string): Promise<HttpAgent> {
    const [agent, fetchRootKeyPromise] = createHttpAgentInternal(identity, icUrl);
    await fetchRootKeyPromise;
    return agent;
}

function createHttpAgentInternal(identity: Identity, icUrl: string): [HttpAgent, Promise<void>] {
    const agent = HttpAgent.createSync({
        identity,
        host: icUrl,
        verifyQuerySignatures: false,
    });
    const fetchRootKey = !isMainnet(icUrl) && !offline();
    const fetchRootKeyPromise = fetchRootKey
        ? agent.fetchRootKey().then((_) => {})
        : Promise.resolve();

    return [agent, fetchRootKeyPromise];
}
