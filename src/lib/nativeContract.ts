// Old Publisher templates must fail at build time, not replace the fixed updater.
import contract from '../../electron/release-feed-contract.json';
if(contract.protocol<3)throw Error('Нужен native-шаблон Publisher 1.0.7.');
