import { WorkPersonnelManager } from '../../WorkPersonnelManager';
import { TemplatesInBudget } from '../../TemplatesInBudget';
import { WarehouseSpecification } from '../../WarehouseSpecification';
import { UShapeUnifiedDialog, LedSizeDialog, PodiumDialog, TotemDialog, AddLocationDialog } from '../../dialogs';
import type { BudgetLogicVM } from '../hooks/useBudgetLogic';
import { NO_LOCATION_GROUP_ID, parseGroupId } from '../constants';

interface BudgetModalsProps {
  vm: BudgetLogicVM;
  eventId: string;
  eventName: string;
}

export function BudgetModals({ vm, eventId, eventName }: BudgetModalsProps) {
  return (
    <>
      {vm.workPersonnelManagerOpen && vm.selectedCategoryForPersonnel && (
        <WorkPersonnelManager
          workItems={vm.budgetItems.filter((item) => {
            if (item.item_type !== 'work') return false;
            const parsed = parseGroupId(vm.selectedCategoryForPersonnel!);
            if (vm.selectedCategoryForPersonnel === NO_LOCATION_GROUP_ID) return !item.category_id && !item.location_id;
            return (item.category_id || null) === parsed.categoryId && (item.location_id || null) === parsed.locationId;
          })}
          onClose={() => { vm.setWorkPersonnelManagerOpen(false); vm.setSelectedCategoryForPersonnel(null); }}
          onSave={vm.handleWorkPersonnelSave}
          paymentMode={vm.paymentMode}
          exchangeRate={vm.exchangeRate}
        />
      )}

      {vm.showTemplates && (
        <TemplatesInBudget
          eventId={eventId}
          onClose={() => vm.setShowTemplates(false)}
          onApply={() => { vm.setShowTemplates(false); vm.loadData(); }}
        />
      )}

      {vm.showWarehouseSpec && (
        <WarehouseSpecification
          eventId={eventId}
          eventName={eventName}
          onClose={() => vm.setShowWarehouseSpec(false)}
        />
      )}

      <AddLocationDialog
        isOpen={vm.showLocationDialog}
        existingNames={vm.locations.map((location) => location.name)}
        onClose={() => vm.setShowLocationDialog(false)}
        onConfirm={vm.handleCreateLocation}
      />

      {vm.showLedSizeDialog && vm.selectedLedEquipment && (
        <LedSizeDialog
          equipment={vm.selectedLedEquipment}
          isOpen={vm.showLedSizeDialog}
          onClose={() => {
            vm.setShowLedSizeDialog(false);
            vm.setSelectedLedEquipment(null);
          }}
          onConfirm={vm.handleLedSizeConfirm}
        />
      )}

      {vm.showPodiumDialog && vm.selectedPodiumEquipment && (
        <PodiumDialog
          equipment={vm.selectedPodiumEquipment}
          isOpen={vm.showPodiumDialog}
          onClose={() => {
            vm.setShowPodiumDialog(false);
            vm.setSelectedPodiumEquipment(null);
          }}
          onConfirm={vm.handlePodiumConfirm}
        />
      )}

      {vm.showTotemDialog && vm.selectedTotemEquipment && (
        <TotemDialog
          equipment={vm.selectedTotemEquipment}
          isOpen={vm.showTotemDialog}
          onClose={() => {
            vm.setShowTotemDialog(false);
            vm.setSelectedTotemEquipment(null);
          }}
          onConfirm={vm.handleTotemConfirm}
          isMonototem={vm.isMonototem}
        />
      )}

      {vm.showUShapeUnifiedDialog && vm.selectedUShapeEquipment && (
        <UShapeUnifiedDialog
          equipment={vm.selectedUShapeEquipment}
          isOpen={vm.showUShapeUnifiedDialog}
          onClose={() => {
            vm.setShowUShapeUnifiedDialog(false);
            vm.setSelectedUShapeEquipment(null);
          }}
          onConfirm={vm.handleUShapeUnifiedConfirm}
          initialMode={vm.uShapeMode}
        />
      )}
    </>
  );
}
