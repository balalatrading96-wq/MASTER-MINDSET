self.addEventListener('push', function(event){
    const data = event.data ? event.data.json() : {title:'Reminder', body:'Stay strong — open your tracker.'};
    const options = { body: data.body, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', data };
    event.waitUntil(self.registration.showNotification(data.title, options));
    });
    self.addEventListener('notificationclick', function(event){ event.notification.close(); event.waitUntil(clients.openWindow('/')); });