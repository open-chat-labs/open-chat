export function shakeElements(
    selectors: string[],
    {
        duration = 2000,
        maxIntensity = 20,
        explosionForce = 1000,
    }: {
        duration?: number;
        maxIntensity?: number;
        explosionForce?: number;
    } = {},
): void {
    const elements: HTMLElement[] = selectors
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .filter((el): el is HTMLElement => el instanceof HTMLElement);

    const originalStyle = new Map<HTMLElement, CSSStyleDeclaration>();

    for (const el of elements) {
        originalStyle.set(el, el.style ?? {});
    }

    const startTime = performance.now();

    function animate(now: number): void {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const intensity = maxIntensity * progress;

        for (const el of elements) {
            const x = (Math.random() - 0.5) * 2 * intensity;
            const y = (Math.random() - 0.5) * 2 * intensity;
            el.style.transform = `translate(${x}px, ${y}px)`;
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // put the original elements back how they were
            for (const el of elements) {
                el.style = JSON.stringify(originalStyle.get(el) ?? {});
                el.style.transform = "";
            }

            for (const el of elements) {
                const rect = el.getBoundingClientRect();
                const clone = el.cloneNode(true) as HTMLElement;

                Object.assign(clone.style, {
                    position: "absolute",
                    top: `${rect.top + window.scrollY}px`,
                    left: `${rect.left + window.scrollX}px`,
                    width: `${rect.width}px`,
                    height: `${rect.height}px`,
                    margin: "0",
                    pointerEvents: "none",
                    zIndex: "9999",
                    transform: "none",
                });

                document.body.appendChild(clone);

                clone.getBoundingClientRect();

                const angle = Math.random() * 2 * Math.PI;
                const distance = explosionForce * (0.5 + Math.random() / 2);
                const x = Math.cos(angle) * distance;
                const y = Math.sin(angle) * distance;
                const rotation = (Math.random() - 0.5) * 720 * 2;
                const scale = 1 + Math.random() * 5;

                clone.style.transition = "transform 3s ease-out, opacity 3s ease-out";
                clone.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
                clone.style.transformOrigin = "center";
                clone.style.opacity = "0";

                setTimeout(() => {
                    clone.remove();
                }, 3000);
            }
        }
    }

    requestAnimationFrame(animate);
}
