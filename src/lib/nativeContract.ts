// Deliberate build guard: an old Publisher must not silently overwrite the fixed native updater.
// If this import is missing, use Publisher 1.0.6 or newer with the matching native template.
import contract from '../../electron/native-contract.json';
if (contract.protocol < 2) throw new Error('Обновите native-шаблон: требуется Publisher 1.0.6.');
