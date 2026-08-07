import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bikice.com',
  appName: 'mediafeed-app',
  webDir: 'dist',
  server: {
    // Android's WebView refuses to load http:// resources from an https://
    // origin by default. androidScheme: 'https' (the Capacitor default)
    // means the app itself is served over https://localhost, which is fine
    // -- but if your backend (VITE_API_BASE_URL) is also plain http, THOSE
    // requests will be blocked too. Point the backend at a real TLS cert,
    // or, only for local testing against an http backend, uncomment below:
    // cleartext: true,
    androidScheme: 'https',
  },
};

export default config;
