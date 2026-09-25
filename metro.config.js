const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// react-native-maps has no web build (see src/shims/react-native-maps.web.tsx).
// Point every web-platform import of it at the stub instead.
const mapsStub = path.resolve(__dirname, 'src/shims/react-native-maps.web.tsx');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    (moduleName === 'react-native-maps' || moduleName.startsWith('react-native-maps/'))
  ) {
    return { type: 'sourceFile', filePath: mapsStub };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
