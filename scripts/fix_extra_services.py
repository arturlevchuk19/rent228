import re

with open('/home/engine/project/src/components/BudgetEditor.tsx', 'r') as f:
    content = f.read()

original = content

# 1. Add showTotal to location-based CategoryBlock (first one in location)
# Look for the pattern after onTouchItemDrop line
content = content.replace(
    "onTouchItemDrop={handleTouchItemDrop}\n                                    dragOverItemId={dragOverItemId}\n                                  />\n                                </div>\n                              );\n                            })}\n\n                            {(groupedItems",
    "onTouchItemDrop={handleTouchItemDrop}\n                                    dragOverItemId={dragOverItemId}\n                                    showTotal={getCategoryShowTotal(category.id)}\n                                  />\n                                </div>\n                              );\n                            })}\n\n                            {(groupedItems"
)

# 2. Add ExtraServicesDialog after ContractDialog in the modals section
content = content.replace(
    "        onClose={() => setShowContractDialog(false)}\n        onConfirm={handleContractConfirm}\n      />",
    "        onClose={() => setShowContractDialog(false)}\n        onConfirm={handleContractConfirm}\n      />\n      <ExtraServicesDialog\n        isOpen={showExtraServicesDialog}\n        existingNames={categories.map((c) => c.name)}\n        onClose={() => setShowExtraServicesDialog(false)}\n        onConfirm={handleExtraServicesConfirm}\n      />"
)

print(f"Changes made: {content != original}")

with open('/home/engine/project/src/components/BudgetEditor.tsx', 'w') as f:
    f.write(content)

print("Done")

# Verify
import subprocess
r = subprocess.run(['python3', '-c', """
with open('/home/engine/project/src/components/BudgetEditor.tsx') as f:
    c = f.read()
print(f"showTotal count: {c.count('showTotal')}")
print(f"ExtraServicesDialog count: {c.count('ExtraServicesDialog')}")
print(f"ExtraServices count: {c.count('ExtraServices')}")
"""], capture_output=True, text=True)
print(r.stdout)
