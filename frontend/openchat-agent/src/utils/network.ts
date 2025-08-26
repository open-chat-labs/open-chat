export function isMainnet(icUrl: string): boolean {
    return icUrl.includes("icp-api.io");
}
