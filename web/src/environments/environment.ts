export interface FirebaseEnvironment {
  production: boolean;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    databaseURL: string;
  };
  r2?: {
    workerUrl: string;
    publicUrl: string;
    purgeKey?: string;
  };
}

/**
 * Public Firebase web configuration placeholder for local development.
 * Firebase API keys identify a project; access control is enforced by Firebase Rules.
 */
export const environment: FirebaseEnvironment = {
  production: true,
  firebase: {
    apiKey: "AIzaSyC08WzKloro23b3q3dKuLqgYyc0yntKBNU",
    authDomain: "thairomdb.firebaseapp.com",
    projectId: "thairomdb",
    storageBucket: "thairomdb",
    messagingSenderId: "408124827279",
    appId: "1:408124827279:web:f5fd7228b32d08465632fa",
    databaseURL: "https://thairomdb-default-rtdb.asia-southeast1.firebasedatabase.app",
  },
  r2: {
    workerUrl: 'https://r2-upload-worker.thairomdb.workers.dev',
    publicUrl: 'https://pub-6ba6c842bf76437db39aeb21dc0f37e2.r2.dev',
    purgeKey: 'thairomdb-cache-key-2026'
  }
};
