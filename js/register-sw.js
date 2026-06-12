if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker de l\'application active.'))
            .catch(err => console.error('Erreur d\'activation SW:', err));
    });
}