import { useBudgetLogic } from './budget-editor/hooks/useBudgetLogic';
import { BudgetLayout } from './budget-editor/ui/BudgetLayout';
import { BudgetModals } from './budget-editor/ui/BudgetModals';

interface BudgetEditorProps {
  eventId: string;
  eventName: string;
  onClose: () => void;
}

export function BudgetEditor({ eventId, eventName, onClose }: BudgetEditorProps) {
  const vm = useBudgetLogic({ eventId, eventName, onClose });

  if (vm.loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
        <div className="bg-gray-900 p-8 rounded-lg">
          <p className="text-white">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <BudgetLayout vm={vm} eventName={eventName} onClose={onClose} />
      <BudgetModals vm={vm} eventId={eventId} eventName={eventName} />
    </>
  );
}
