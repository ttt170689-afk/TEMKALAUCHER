// Typecheck reads the preserved source bundle. vite.config.js then restores
// and validates the real native runtime before bundling/packaging.
import contract from '../../native-bundle/electron/release-feed-contract.json';
if(contract.protocol<3)throw Error('Повреждён комплект desktop-кода. Используйте полный ZIP.');
