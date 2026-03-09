const fs = require('fs');

// Read the original file
const content = fs.readFileSync('/home/engine/project/src/components/BudgetEditor.tsx', 'utf8');

// 1. Add new imports
const importsSection = content.substring(0, content.indexOf('interface BudgetEditorProps'));
const newImports = importsSection.replace(
  "import { WarehouseSpecification } from './WarehouseSpecification';\nimport { generateBudgetPDF } from '../lib/pdfGenerator';",
  `import { WarehouseSpecification } from './WarehouseSpecification';
import { generateBudgetPDF } from '../lib/pdfGenerator';
import { LedSizeDialog } from './dialogs/LedSizeDialog';
import { PodiumDialog } from './dialogs/PodiumDialog';
import { TotemDialog } from './dialogs/TotemDialog';
import { UShapeDialog } from './dialogs/UShapeDialog';
import { UShapeLedDialog } from './dialogs/UShapeLedDialog';`
);

const restOfContent = content.substring(content.indexOf('interface BudgetEditorProps'));

// 2. Remove dialog state and handlers - will be done in next steps
// For now, just save with new imports
const refactored = newImports + restOfContent;

fs.writeFileSync('/home/engine/project/src/components/BudgetEditor.tsx', refactored, 'utf8');

console.log('Imports added successfully!');
