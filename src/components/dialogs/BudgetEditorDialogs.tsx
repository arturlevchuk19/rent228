import { BudgetItem } from '../../lib/events';
import { EquipmentItem } from '../../lib/equipment';
import { WorkPersonnelManager } from '../WorkPersonnelManager';
import { TemplatesInBudget } from '../TemplatesInBudget';
import { WarehouseSpecification } from '../WarehouseSpecification';
import { AddLocationDialog, LedSizeDialog, PodiumDialog, TotemDialog, UShapeUnifiedDialog } from './index';

interface BudgetEditorDialogsProps {
  eventId: string;
  eventName: string;
  budgetItems: BudgetItem[];
  locations: { name: string }[];
  paymentMode: 'usd' | 'byn_cash' | 'byn_noncash';
  exchangeRate: number;
  parseGroupId: (groupId: string) => { categoryId: string | null; locationId: string | null };
  noLocationGroupId: string;

  workPersonnelManagerOpen: boolean;
  selectedCategoryForPersonnel: string | null;
  onCloseWorkPersonnelManager: () => void;
  onSaveWorkPersonnelManager: () => Promise<void> | void;

  showTemplates: boolean;
  onCloseTemplates: () => void;
  onApplyTemplates: () => Promise<void> | void;

  showWarehouseSpec: boolean;
  onCloseWarehouseSpec: () => void;

  showLocationDialog: boolean;
  onCloseLocationDialog: () => void;
  onConfirmLocation: (payload: { name: string; color: string }) => Promise<void> | void;

  showLedSizeDialog: boolean;
  selectedLedEquipment: EquipmentItem | null;
  onCloseLedSizeDialog: () => void;
  onConfirmLedSizeDialog: (result: { quantity: number; customName: string; customPrice: number }) => void;

  showPodiumDialog: boolean;
  selectedPodiumEquipment: EquipmentItem | null;
  onClosePodiumDialog: () => void;
  onConfirmPodiumDialog: (result: { quantity: number; customName: string; customPrice: number }) => void;

  showTotemDialog: boolean;
  selectedTotemEquipment: EquipmentItem | null;
  isMonototem: boolean;
  onCloseTotemDialog: () => void;
  onConfirmTotemDialog: (result: { quantity: number; customName: string; customPrice?: number }) => void;

  showUShapeUnifiedDialog: boolean;
  selectedUShapeEquipment: EquipmentItem | null;
  uShapeMode: 'standard' | 'lifting';
  onCloseUShapeUnifiedDialog: () => void;
  onConfirmUShapeUnifiedDialog: (result: { quantity: number; customName: string; customPrice: number }) => void;
}

export function BudgetEditorDialogs({
  eventId,
  eventName,
  budgetItems,
  locations,
  paymentMode,
  exchangeRate,
  parseGroupId,
  noLocationGroupId,
  workPersonnelManagerOpen,
  selectedCategoryForPersonnel,
  onCloseWorkPersonnelManager,
  onSaveWorkPersonnelManager,
  showTemplates,
  onCloseTemplates,
  onApplyTemplates,
  showWarehouseSpec,
  onCloseWarehouseSpec,
  showLocationDialog,
  onCloseLocationDialog,
  onConfirmLocation,
  showLedSizeDialog,
  selectedLedEquipment,
  onCloseLedSizeDialog,
  onConfirmLedSizeDialog,
  showPodiumDialog,
  selectedPodiumEquipment,
  onClosePodiumDialog,
  onConfirmPodiumDialog,
  showTotemDialog,
  selectedTotemEquipment,
  isMonototem,
  onCloseTotemDialog,
  onConfirmTotemDialog,
  showUShapeUnifiedDialog,
  selectedUShapeEquipment,
  uShapeMode,
  onCloseUShapeUnifiedDialog,
  onConfirmUShapeUnifiedDialog
}: BudgetEditorDialogsProps) {
  return (
    <>
      {workPersonnelManagerOpen && selectedCategoryForPersonnel && (
        <WorkPersonnelManager
          workItems={budgetItems.filter((item) => {
            if (item.item_type !== 'work') return false;
            const parsed = parseGroupId(selectedCategoryForPersonnel);
            if (selectedCategoryForPersonnel === noLocationGroupId) return !item.category_id && !item.location_id;
            return (item.category_id || null) === parsed.categoryId && (item.location_id || null) === parsed.locationId;
          })}
          onClose={onCloseWorkPersonnelManager}
          onSave={onSaveWorkPersonnelManager}
          paymentMode={paymentMode}
          exchangeRate={exchangeRate}
        />
      )}

      {showTemplates && (
        <TemplatesInBudget
          eventId={eventId}
          onClose={onCloseTemplates}
          onApply={onApplyTemplates}
        />
      )}

      {showWarehouseSpec && (
        <WarehouseSpecification
          eventId={eventId}
          eventName={eventName}
          onClose={onCloseWarehouseSpec}
        />
      )}

      <AddLocationDialog
        isOpen={showLocationDialog}
        existingNames={locations.map((location) => location.name)}
        onClose={onCloseLocationDialog}
        onConfirm={onConfirmLocation}
      />

      {showLedSizeDialog && selectedLedEquipment && (
        <LedSizeDialog
          equipment={selectedLedEquipment}
          isOpen={showLedSizeDialog}
          onClose={onCloseLedSizeDialog}
          onConfirm={onConfirmLedSizeDialog}
        />
      )}

      {showPodiumDialog && selectedPodiumEquipment && (
        <PodiumDialog
          equipment={selectedPodiumEquipment}
          isOpen={showPodiumDialog}
          onClose={onClosePodiumDialog}
          onConfirm={onConfirmPodiumDialog}
        />
      )}

      {showTotemDialog && selectedTotemEquipment && (
        <TotemDialog
          equipment={selectedTotemEquipment}
          isOpen={showTotemDialog}
          onClose={onCloseTotemDialog}
          onConfirm={onConfirmTotemDialog}
          isMonototem={isMonototem}
        />
      )}

      {showUShapeUnifiedDialog && selectedUShapeEquipment && (
        <UShapeUnifiedDialog
          equipment={selectedUShapeEquipment}
          isOpen={showUShapeUnifiedDialog}
          onClose={onCloseUShapeUnifiedDialog}
          onConfirm={onConfirmUShapeUnifiedDialog}
          initialMode={uShapeMode}
        />
      )}
    </>
  );
}
