import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*', 'android/**/*', 'android-native/**/*'],
  },
  firebaseRulesPlugin.configs['flat/recommended'],
];
