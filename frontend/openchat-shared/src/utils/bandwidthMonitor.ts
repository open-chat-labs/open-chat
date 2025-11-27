import type { Readable } from "svelte/store";

export type BandwidthStatus = {
    online: boolean;
    bandwidthMbps: number | null;
    lastChecked: number;
};

export type BandwidthMonitorConfig = {
    pollIntervalMs?: number;
    probeUrl?: string;
    timeoutMs?: number;
};

const DEFAULT_CONFIG: Required<BandwidthMonitorConfig> = {
    pollIntervalMs: 10_000,
    probeUrl: "/api/health",
    timeoutMs: 5_000,
};

export class BandwidthMonitor implements Readable<BandwidthStatus> {
    #config: Required<BandwidthMonitorConfig>;
    #listeners: Set<(status: BandwidthStatus) => void> = new Set();
    #currentStatus: BandwidthStatus = {
        online: navigator.onLine,
        bandwidthMbps: null,
        lastChecked: Date.now(),
    };
    #intervalId: number | null = null;
    #isPageVisible: boolean = !document.hidden;
    #isChecking: boolean = false;
    #started: boolean = false;

    constructor(config: BandwidthMonitorConfig = {}) {
        this.#config = { ...DEFAULT_CONFIG, ...config };
        this.#setupEventListeners();
    }

    #setupEventListeners(): void {
        window.addEventListener("online", () => this.#handleConnectivityChange());
        window.addEventListener("offline", () => this.#handleConnectivityChange());
        document.addEventListener("visibilitychange", () => {
            this.#isPageVisible = !document.hidden;
            if (this.#isPageVisible) {
                this.#checkConnection();
            }
        });
        if ("connection" in navigator && navigator.connection) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            navigator.connection.addEventListener("change", () => this.#handleConnectivityChange());
        }
    }

    async #handleConnectivityChange(): Promise<void> {
        await this.#checkConnection();
    }

    async #checkConnection(): Promise<void> {
        if (!this.#isPageVisible || this.#isChecking) {
            return;
        }

        this.#isChecking = true;

        try {
            // Add cache buster to prevent cached responses
            const cacheBuster = `?_=${Date.now()}_${Math.random()}`;
            const url = this.#config.probeUrl + cacheBuster;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.#config.timeoutMs);
            const startTime = performance.now();
            const response = await fetch(url, {
                cache: "no-store",
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                await response.blob();
                const endTime = performance.now();
                const durationSeconds = (endTime - startTime) / 1000;
                const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
                let bandwidth: number | null = null;
                if (durationSeconds > 0 && contentLength > 0) {
                    // Calculate bandwidth in Mbps
                    const bitsDownloaded = contentLength * 8;
                    bandwidth = bitsDownloaded / durationSeconds / 1_000_000;
                }

                this.#updateStatus({
                    online: true,
                    bandwidthMbps: bandwidth,
                    lastChecked: Date.now(),
                });
            } else {
                this.#updateStatus({
                    online: false,
                    bandwidthMbps: null,
                    lastChecked: Date.now(),
                });
            }
        } catch (err) {
            console.debug("Error probing network bandwidth", err);
            // Network error or timeout
            this.#updateStatus({
                online: false,
                bandwidthMbps: null,
                lastChecked: Date.now(),
            });
        } finally {
            this.#isChecking = false;
        }
    }

    #updateStatus(status: BandwidthStatus): void {
        const changed =
            this.#currentStatus.online !== status.online ||
            this.#currentStatus.bandwidthMbps !== status.bandwidthMbps;
        this.#currentStatus = status;
        if (changed) {
            this.#notifyListeners();
        }
    }

    #notifyListeners(): void {
        this.#listeners.forEach((listener) => listener(this.#currentStatus));
    }

    public start(): void {
        if (this.#started) {
            return;
        }
        this.#started = true;

        this.#checkConnection();

        this.#intervalId = window.setInterval(() => {
            if (this.#isPageVisible) {
                this.#checkConnection();
            }
        }, this.#config.pollIntervalMs);
    }

    public stop(): void {
        if (this.#intervalId !== null) {
            window.clearInterval(this.#intervalId);
            this.#intervalId = null;
        }
        this.#started = false;
    }

    public subscribe(listener: (status: BandwidthStatus) => void): () => void {
        this.#listeners.add(listener);

        if (this.#listeners.size === 1 && !this.#started) {
            this.start();
        }

        listener(this.#currentStatus);

        return () => {
            this.#listeners.delete(listener);
            if (this.#listeners.size === 0 && this.#started) {
                this.stop();
            }
        };
    }

    public getStatus(): BandwidthStatus {
        return { ...this.#currentStatus };
    }

    public updateConfig(config: Partial<BandwidthMonitorConfig>): void {
        const wasRunning = this.#intervalId !== null;
        if (wasRunning) {
            this.stop();
        }
        this.#config = { ...this.#config, ...config };
        if (wasRunning) {
            this.start();
        }
    }

    public async forceCheck(): Promise<BandwidthStatus> {
        await this.#checkConnection();
        return this.getStatus();
    }
}
