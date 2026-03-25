/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

// Suppress @react-native-firebase v23 deprecation warnings.
// These are cosmetic notices about the future modular API migration
// and do NOT affect functionality.
LogBox.ignoreLogs([
    'This method is deprecated and will be removed',
    'warnIfNotModularCall',
    'firebase',
    'Firebase',
]);

// Also filter at console level since Firebase overrides console.warn internally
const _originalWarn = console.warn;
console.warn = (...args) => {
    const message = args[0]?.toString?.() ?? '';
    if (
        message.includes('deprecated') ||
        message.includes('modular') ||
        message.includes('warnIfNotModularCall') ||
        message.includes('rnfirebase')
    ) {
        return; // Suppress
    }
    _originalWarn(...args);
};

AppRegistry.registerComponent(appName, () => App);

