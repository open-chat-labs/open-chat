// Register event listener for the 'push' event.
self.addEventListener('push', function(event) {
    // Keep the service worker alive until the notification is created.
    event.waitUntil(
      self.registration.showNotification('OpenChat', {
        body: 'My first notification',
        icon: 'data:image/png;base64, iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==',
      })
    );
  });
  