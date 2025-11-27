import type { Readable } from "svelte/store";

export type ConnectivityStatus = {
    online: boolean;
    estimatedDownlinkMbps: number | null;
    lastChecked: number;
};

export type ConnectivityMonitorConfig = {
    pollIntervalMs?: number;
    probeUrl?: string;
    timeoutMs?: number;
};

const DEFAULT_CONFIG: Required<ConnectivityMonitorConfig> = {
    pollIntervalMs: 30_000,
    probeUrl: "/api/health",
    timeoutMs: 5_000,
};

export class ConnectivityMonitor implements Readable<ConnectivityStatus> {
    #config: Required<ConnectivityMonitorConfig>;
    #listeners: Set<(status: ConnectivityStatus) => void> = new Set();
    #currentStatus: ConnectivityStatus = {
        online: navigator.onLine,
        estimatedDownlinkMbps: this.#getEstimatedDownlink(),
        lastChecked: Date.now(),
    };
    #intervalId: number | null = null;
    #isPageVisible: boolean = !document.hidden;
    #isChecking: boolean = false;
    #started: boolean = false;

    constructor(config: ConnectivityMonitorConfig = {}) {
        this.#config = { ...DEFAULT_CONFIG, ...config };
        this.#setupEventListeners();
    }

    #getEstimatedDownlink(): number | null {
        if ("connection" in navigator && navigator.connection) {
            const downlink = (navigator.connection as NetworkInformation).downlink;
            return downlink !== undefined ? downlink : null;
        }
        return null;
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
        const newDownlink = this.#getEstimatedDownlink();
        if (newDownlink !== this.#currentStatus.estimatedDownlinkMbps) {
            this.#updateStatus({
                ...this.#currentStatus,
                estimatedDownlinkMbps: newDownlink,
                lastChecked: Date.now(),
            });
        }
        await this.#checkConnection();
    }

    async #checkConnection(): Promise<void> {
        if (!this.#isPageVisible || this.#isChecking) {
            return;
        }

        this.#isChecking = true;

        try {
            const cacheBuster = `?_=${Date.now()}`;
            const url = this.#config.probeUrl + cacheBuster;
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), this.#config.timeoutMs);

            const response = await fetch(url, {
                method: "HEAD",
                cache: "no-store",
                signal: controller.signal,
            });

            window.clearTimeout(timeoutId);

            this.#updateStatus({
                online: response.ok,
                estimatedDownlinkMbps: this.#getEstimatedDownlink(),
                lastChecked: Date.now(),
            });
        } catch (err) {
            console.debug("Error checking connectivity", err);
            this.#updateStatus({
                online: false,
                estimatedDownlinkMbps: this.#getEstimatedDownlink(),
                lastChecked: Date.now(),
            });
        } finally {
            this.#isChecking = false;
        }
    }

    #updateStatus(status: ConnectivityStatus): void {
        console.debug("NetworkStatus: ", status);
        const changed =
            this.#currentStatus.online !== status.online ||
            this.#currentStatus.estimatedDownlinkMbps !== status.estimatedDownlinkMbps;

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
            clearInterval(this.#intervalId);
            this.#intervalId = null;
        }
        this.#started = false;
    }

    public subscribe(listener: (status: ConnectivityStatus) => void): () => void {
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

    public getStatus(): ConnectivityStatus {
        return { ...this.#currentStatus };
    }

    public updateConfig(config: Partial<ConnectivityMonitorConfig>): void {
        const wasRunning = this.#intervalId !== null;

        if (wasRunning) {
            this.stop();
        }

        this.#config = { ...this.#config, ...config };

        if (wasRunning) {
            this.start();
        }
    }

    public async forceCheck(): Promise<ConnectivityStatus> {
        await this.#checkConnection();
        return this.getStatus();
    }
}
