/* eslint-disable @typescript-eslint/no-explicit-any */

type NetworkType = "slow-2g" | "2g" | "3g" | "4g";

interface NetworkInformation extends Events {
    readonly downlink: number;
    readonly effectiveType: NetworkType;
    readonly rtt: number;
    readonly saveData: boolean;
    addEventListener: (ev: string, cb: () => void) => void;
    removeEventListener: (ev: string, cb: () => void) => void;
}

interface Navigator {
    connection?: NetworkInformation;
}

declare function gtag(command: "event", name: string, options?: any): void;

declare module "borc";
