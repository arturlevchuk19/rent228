import { useEffect, useRef, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { isStandalone, promptInstall } from '../lib/pwa';

export function InstallAppButton({ onLogin = false }: { onLogin?: boolean }) {
  const [installed, setInstalled] = useState(isStandalone);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unavailable'>('unavailable');
  const dialog = useRef<HTMLDialogElement>(null);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(isStandalone());
    const complete = () => setInstalled(true);
    window.addEventListener('appinstalled', complete);
    standalone.addEventListener('change', update);
    return () => {
      window.removeEventListener('appinstalled', complete);
      standalone.removeEventListener('change', update);
    };
  }, []);

  const open = async () => {
    if (!installed) {
      setBusy(true);
      try {
        const outcome = await promptInstall();
        if (outcome === 'accepted') setInstalled(true);
        if (outcome !== 'unavailable') return;
      } catch {
        // Show manual installation instructions if the browser prompt fails.
      } finally {
        setBusy(false);
      }
    }
    setPermission(import.meta.env.PROD && 'serviceWorker' in navigator && typeof Notification !== 'undefined' && (!ios || isStandalone())
      ? Notification.permission
      : 'unavailable');
    dialog.current?.showModal();
  };

  const enableNotifications = async () => {
    setBusy(true);
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission('unavailable');
    } finally {
      setBusy(false);
    }
  };

  if (onLogin && installed) return null;
  const Icon = installed ? Smartphone : Download;
  return <>
    <button type="button" disabled={busy} onClick={() => void open()} className={onLogin
      ? 'fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-20 flex min-h-11 items-center gap-2 rounded-xl border border-accent-700 bg-gray-900 px-3 text-sm text-accent-400 shadow-lg disabled:opacity-50'
      : 'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white disabled:opacity-50'}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      {installed ? 'Уведомления приложения' : 'Установить RentMaster'}
    </button>
    <dialog ref={dialog} aria-labelledby="rentmaster-app-title" className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-5 text-gray-200 backdrop:bg-black/70">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="rentmaster-app-title" className="font-semibold">{installed ? 'Уведомления RentMaster' : 'Установка RentMaster'}</h2>
        <button type="button" aria-label="Закрыть" onClick={() => dialog.current?.close()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-gray-800"><X aria-hidden="true" className="h-5 w-5" /></button>
      </div>
      {!installed && <p className="leading-relaxed">{ios
        ? 'В Safari нажмите «Поделиться», затем «На экран “Домой”». Включите «Открывать как веб-приложение», если этот переключатель есть, и нажмите «Добавить».'
        : 'В меню Chrome или Edge выберите «Установить приложение». На телефоне этот пункт может быть внутри «Добавить на главный экран».'}</p>}
      {(!onLogin || installed) && <div className={installed ? 'space-y-3' : 'mt-4 space-y-3'}>
        <p className="leading-relaxed">RentMaster может сообщить, когда правки, сделанные без сети, отправлены. Для отправки откройте приложение после восстановления связи.</p>
        {permission === 'default' && <button type="button" disabled={busy} onClick={() => void enableNotifications()} className="min-h-11 w-full rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-gray-950 hover:bg-accent-400 disabled:opacity-50">Разрешить уведомления</button>}
        <p role="status" className="text-sm text-gray-300">
          {permission === 'granted' && 'Уведомления разрешены.'}
          {permission === 'denied' && 'Уведомления заблокированы. Их можно разрешить в настройках браузера или устройства.'}
          {permission === 'unavailable' && (ios && !isStandalone()
            ? 'На iPhone и iPad откройте RentMaster с экрана «Домой», чтобы разрешить уведомления.'
            : 'Уведомления недоступны в этом браузере или режиме запуска.')}
        </p>
      </div>}
    </dialog>
  </>;
}
