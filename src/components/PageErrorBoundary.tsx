import { Component, type ErrorInfo, type ReactNode } from 'react';

export class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unable to render page:', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const assetLoadFailed = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk .* failed/i.test(error.message);
    return <section role="alert" className="mx-auto max-w-lg rounded-xl border border-gray-700 bg-gray-900 p-6 text-gray-200">
      <h1 className="text-lg font-semibold text-white">{assetLoadFailed ? 'Не удалось загрузить раздел' : 'Не удалось открыть раздел'}</h1>
      <p className="mt-3 text-sm">{assetLoadFailed ? 'Возможно, приложение обновилось или пропало соединение. Проверьте интернет и обновите страницу.' : 'При открытии раздела произошла ошибка. Попробуйте обновить страницу.'}</p>
      <p className="mt-2 text-sm text-gray-400">Перед обновлением сохраните несохранённые изменения в других открытых формах.</p>
      <button type="button" onClick={() => window.location.reload()} className="mt-5 min-h-11 rounded-lg bg-cyan-600 px-4 font-semibold text-white hover:bg-cyan-500">Обновить страницу</button>
    </section>;
  }
}
