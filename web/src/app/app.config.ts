import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideRouter, withHashLocation, withInMemoryScrolling } from '@angular/router';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideDatabase, getDatabase } from '@angular/fire/database';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideServiceWorker } from '@angular/service-worker';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  // GitHub Pages cannot rewrite deep SPA URLs to index.html. Hash routing keeps
  // the requested document at the deployed application root on refresh.
  providers: [
    provideHttpClient(),
    provideRouter(routes, withHashLocation(), withInMemoryScrolling({
      scrollPositionRestoration: 'disabled'
    })),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideDatabase(() => getDatabase()),
    // Kept during the cutover for the legacy backup/import screen and rollback.
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production && !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
