export default function trackEvent(name: string, parameters?: {}) {
    const dataLayer: any[] = (window as any).dataLayer;
    if (dataLayer) {
        dataLayer.push({ ...parameters, event: name });
    }
}