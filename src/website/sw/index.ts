declare var self: ServiceWorkerGlobalScope;
export {};

self.addEventListener('push', function(event: PushEvent) {
    event.waitUntil(
        self.registration.showNotification('OpenChat', {
          body: 'My notification 8',
          icon: 'data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
        })
    );
});