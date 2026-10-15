import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pk.edu.uet.ai.mims',
  appName: 'AI-MIMS',
  webDir: 'dist',
  server: {
    url: 'https://ai-director-xn44.onrender.com',
    cleartext: false,
    androidScheme: 'https',
    errorPath: 'error.html'
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false
  }
};

export default config;
