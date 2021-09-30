class RtcMessageReceiver {
    public handleMessage = (from: string, message: string): void => {
        console.log("handle webrtc message: ", from, message);
    };
}

export const receiver = new RtcMessageReceiver();
