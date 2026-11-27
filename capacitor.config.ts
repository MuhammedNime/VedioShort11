import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quizpro.reelsstudio1',
  appName: 'استوديو كويز برو',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0c0c0c',
  },
};

export default config;
