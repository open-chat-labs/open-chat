export default class Stopwatch {
    startTime: number;

    private constructor() {
        this.startTime = performance.now();
    }

    public static startNew() {
        return new Stopwatch();
    }

    public getElapsedMs() {
        return performance.now() - this.startTime;
    }
}
