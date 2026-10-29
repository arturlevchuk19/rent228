import { useEffect, useRef, useState } from 'react';
import { Download, X } from 'lucide-react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)');
    const update = () => setInstalled(standalone.matches || !!(navigator as Navigator & { standalone?: boolean }).standalone);
    const available = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const complete = () => { setInstalled(true); setPrompt(null); };
    update();
    window.addEventListener('beforeinstallprompt', available);
    window.addEventListener('appinstalled', complete);
    standalone.addEventListener('change', update);
    return () => {
      window.removeEventListener('beforeinstallprompt', available);
      window.removeEventListener('appinstalled', complete);
      standalone.removeEventListener('change', update);
    };
  }, []);
  const install = async () => {
    if (!prompt) { dialog.current?.showModal(); return; }
    setBusy(true);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') setInstalled(true);
    } catch { dialog.current?.showModal(); }
    finally { setPrompt(null); setBusy(false); }
  };
  if (installed) return null;
  return <>
    <button type="button" disabled={busy} onClick={() => void install()} className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-20 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border border-cyan-700 bg-gray-900 px-3 py-2 text-xs text-cyan-400 shadow-lg disabled:opacity-50 sm:hidden" aria-label="Добавить RentMaster на главный экран"><Download className="h-4 w-4 shrink-0" />Добавить RentMaster</button>
    <dialog ref={dialog} className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-gray-700 bg-gray-900 p-5 text-gray-200 backdrop:bg-black/70">
      <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold">RentMaster на главном экране</h2><button type="button" aria-label="Закрыть инструкцию установки" onClick={() => dialog.current?.close()} className="p-2 text-gray-400"><X className="h-5 w-5" /></button></div>
      <p className="text-sm leading-relaxed">{ios ? 'Откройте сайт в Safari. Нажмите «Поделиться», затем «На экран “Домой”». Оставьте название RentMaster и нажмите «Добавить».' : 'Откройте сайт в Chrome. В меню браузера ⋮ выберите «Добавить на главный экран» или «Установить приложение», затем подтвердите добавление RentMaster.'}</p>
      <p className="mt-3 break-all text-xs text-gray-400">Ярлык открывает https://rent228.vercel.app/</p>
      <button type="button" onClick={() => dialog.current?.close()} className="mt-5 w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white">Понятно</button>
    </dialog>
  </>;
}
