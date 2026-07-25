module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    'react/no-unstable-nested-components': ['warn', { allowAsProps: true }],
    'react-native/no-inline-styles': 'off',
  },
};
