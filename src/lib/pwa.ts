type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

let installPrompt: InstallPrompt | undefined;

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event as InstallPrompt;
});

export async function promptInstall() {
  const prompt = installPrompt;
  if (!prompt) return 'unavailable';
  installPrompt = undefined;
  await prompt.prompt();
  return (await prompt.userChoice).outcome;
}

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    !!(navigator as Navigator & { standalone?: boolean }).standalone;
}

export async function notifySyncComplete() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' ||
    !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration?.active) return;
    await registration.showNotification('RentMaster', {
      body: 'Изменения, сделанные без сети, отправлены.',
      icon: '/icon-192.png',
      tag: 'rentmaster-sync-complete',
    });
  } catch (error) {
    console.warn('Could not show sync notification:', error);
  }
}
