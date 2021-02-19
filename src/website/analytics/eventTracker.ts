export default function trackEvent(name: string, parameters?: {}) {
    const dataLayer: any[] = (window as any).dataLayer;
    if (dataLayer) {
        const event = { ...parameters, event: name };
        dataLayer.push(event);
    }
}
