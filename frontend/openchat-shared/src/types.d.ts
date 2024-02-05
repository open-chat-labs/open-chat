type NetworkType = "slow-2g" | "2g" | "3g" | "4g";

interface NetworkInformation extends Events {
    readonly downlink: number;
    readonly effectiveType: NetworkType;
    readonly rtt: number;
    readonly saveData: boolean;
}

interface Navigator {
    connection?: NetworkInformation;
}
