# BudgetEditor Refactoring Guide

## What Has Been Completed

✅ **Created 5 new dialog components in `/home/engine/project/src/components/dialogs/`:**

1. **LedSizeDialog.tsx** - Handles LED screen size input (dimensions or area mode)
2. **PodiumDialog.tsx** - Handles podium dimensions (width, depth, height)
3. **TotemDialog.tsx** - Handles totem/monototem height input with custom pricing
4. **UShapeDialog.tsx** - Handles U-shape construction with supports
5. **UShapeLedDialog.tsx** - Handles U-shape LED construction with hoist type

6. **index.ts** - Barrel export for all dialog components

✅ **All dialog components:**
- Follow existing modal patterns (fixed overlay, z-[70], consistent styling)
- Manage their own state and validation
- Calculate prices internally
- Return results via `onConfirm` callback with DialogResult interface
- Support Enter key to submit
- Show real-time price preview
- Reset state on close

## What Needs to Be Completed

The BudgetEditor.tsx file needs to be refactored to use these new dialog components. Here are the specific changes:

### 1. Add Dialog Imports (around line 11)

Add these imports after the WarehouseSpecification import:

```typescript
import { LedSizeDialog } from './dialogs/LedSizeDialog';
import { PodiumDialog } from './dialogs/PodiumDialog';
import { TotemDialog } from './dialogs/TotemDialog';
import { UShapeDialog } from './dialogs/UShapeDialog';
import { UShapeLedDialog } from './dialogs/UShapeLedDialog';
```

### 2. Simplify Dialog State (lines 48-79)

Replace the 32 lines of individual state variables with just 12 lines:

```typescript
// Dialog state for refactored components
const [showLedSizeDialog, setShowLedSizeDialog] = useState(false);
const [showPodiumDialog, setShowPodiumDialog] = useState(false);
const [showTotemDialog, setShowTotemDialog] = useState(false);
const [showUShapeDialog, setShowUShapeDialog] = useState(false);
const [showUShapeLedDialog, setShowUShapeLedDialog] = useState(false);

const [selectedLedEquipment, setSelectedLedEquipment] = useState<EquipmentItem | null>(null);
const [selectedPodiumEquipment, setSelectedPodiumEquipment] = useState<EquipmentItem | null>(null);
const [selectedTotemEquipment, setSelectedTotemEquipment] = useState<EquipmentItem | null>(null);
const [isMonototem, setIsMonototem] = useState(false);
const [selectedUShapeEquipment, setSelectedUShapeEquipment] = useState<EquipmentItem | null>(null);
const [selectedUShapeLedEquipment, setSelectedUShapeLedEquipment] = useState<EquipmentItem | null>(null);
```

**Remove these state variables:**
- ledWidth, ledHeight, ledArea, ledSizeType
- podiumWidth, podiumDepth, podiumHeight
- totemHeight
- uShapeWidth, uShapeHeight, uShapeSupportCount, uShapeSupportLength
- uShapeLedWidth, uShapeLedHeight, uShapeLedSupportCount, uShapeLedSupportLength, uShapeLedHoistType

### 3. Remove Dialog Handler Functions (lines 280-414)

Delete these entire functions:
- `handleAddLedScreen()` (lines 280-304)
- `handleAddPodium()` (lines 306-323)
- `handleAddTotem()` (lines 325-342)
- `handleAddUShape()` (lines 344-375)
- `handleAddUShapeLed()` (lines 377-414)

### 4. Update handleEquipmentClick (lines 195-238)

Simplify to just set state and open dialogs (remove the state reset logic since dialogs manage it internally):

```typescript
const handleEquipmentClick = async (equipmentItem: EquipmentItem) => {
  if (isLedScreen(equipmentItem)) {
    setSelectedLedEquipment(equipmentItem);
    setShowLedSizeDialog(true);
    return;
  }
  if (isStagePodium(equipmentItem)) {
    setSelectedPodiumEquipment(equipmentItem);
    setShowPodiumDialog(true);
    return;
  }
  if (isMonoTotem(equipmentItem)) {
    setSelectedTotemEquipment(equipmentItem);
    setIsMonototem(true);
    setShowTotemDialog(true);
    return;
  }
  if (isTotem(equipmentItem)) {
    setSelectedTotemEquipment(equipmentItem);
    setIsMonototem(false);
    setShowTotemDialog(true);
    return;
  }
  if (isUShapeConstruction(equipmentItem)) {
    setSelectedUShapeEquipment(equipmentItem);
    setShowUShapeDialog(true);
    return;
  }
  if (isUShapeLedConstruction(equipmentItem)) {
    setSelectedUShapeLedEquipment(equipmentItem);
    setShowUShapeLedDialog(true);
    return;
  }
  await handleAddItem(equipmentItem, 1, undefined, selectedCategoryId || undefined);
};
```

### 5. Remove Helper Functions (lines 716-752)

Delete these functions:
- `roundToFive()` (line 716)
- `uShapeTotalPrice()` (lines 718-732)
- `uShapeLedTotalPrice()` (lines 734-752)

### 6. Replace Dialog JSX (lines 1150-1727)

Replace the 577 lines of inline dialog JSX with these component calls (add after line 1148):

```typescript
{showLedSizeDialog && selectedLedEquipment && (
  <LedSizeDialog
    equipment={selectedLedEquipment}
    isOpen={showLedSizeDialog}
    onClose={() => { setShowLedSizeDialog(false); setSelectedLedEquipment(null); }}
    onConfirm={(result) => handleAddItem(selectedLedEquipment!, result.quantity, undefined, selectedCategoryId || undefined, result.customName, result.customPrice)}
  />
)}

{showPodiumDialog && selectedPodiumEquipment && (
  <PodiumDialog
    equipment={selectedPodiumEquipment}
    isOpen={showPodiumDialog}
    onClose={() => { setShowPodiumDialog(false); setSelectedPodiumEquipment(null); }}
    onConfirm={(result) => handleAddItem(selectedPodiumEquipment!, result.quantity, undefined, selectedCategoryId || undefined, result.customName, result.customPrice)}
  />
)}

{showTotemDialog && selectedTotemEquipment && (
  <TotemDialog
    equipment={selectedTotemEquipment}
    isOpen={showTotemDialog}
    onClose={() => { setShowTotemDialog(false); setSelectedTotemEquipment(null); setIsMonototem(false); }}
    onConfirm={(result) => handleAddItem(selectedTotemEquipment!, result.quantity, undefined, selectedCategoryId || undefined, result.customName, result.customPrice)}
    isMonototem={isMonototem}
  />
)}

{showUShapeDialog && selectedUShapeEquipment && (
  <UShapeDialog
    equipment={selectedUShapeEquipment}
    isOpen={showUShapeDialog}
    onClose={() => { setShowUShapeDialog(false); setSelectedUShapeEquipment(null); }}
    onConfirm={(result) => handleAddItem(selectedUShapeEquipment!, result.quantity, undefined, selectedCategoryId || undefined, result.customName, result.customPrice)}
  />
)}

{showUShapeLedDialog && selectedUShapeLedEquipment && (
  <UShapeLedDialog
    equipment={selectedUShapeLedEquipment}
    isOpen={showUShapeLedDialog}
    onClose={() => { setShowUShapeLedDialog(false); setSelectedUShapeLedEquipment(null); }}
    onConfirm={(result) => handleAddItem(selectedUShapeLedEquipment!, result.quantity, undefined, selectedCategoryId || undefined, result.customName, result.customPrice)}
  />
)}
```

### 7. Keep Equipment Detection Functions (lines 160-193)

**DO NOT DELETE** these functions as they're used to determine which dialog to open:
- `isLedScreen()`
- `isStagePodium()`
- `isMonoTotem()`
- `isTotem()`
- `isUShapeConstruction()`
- `isUShapeLedConstruction()`

## Expected Results

After completing these changes:
- BudgetEditor.tsx will be reduced from ~1,730 lines to ~900-1,000 lines (reduction of ~700-800 lines)
- All dialog logic will be encapsulated in separate components
- No functionality will be lost
- All existing UI/UX will be preserved
- Code will be more maintainable and easier to test

## Testing Checklist

After refactoring, test these scenarios:
1. LED screen dialog: dimensions mode and area mode
2. Podium dialog: all 3 dimensions input
3. Totem dialog: price calculation for height ≤2m and >2m
4. Monototem dialog: no custom price calculation
5. U-Shape dialog: 0/2/4 supports toggle with conditional length input
6. U-Shape LED dialog: hoist type toggle (manual/motor) with price difference
7. Verify that all price calculations match original implementation
8. Verify that all custom name formats match original
9. Test Enter key to submit in all dialogs
10. Test state reset when canceling dialogs
11. Test that adding items works correctly for all dialog types
