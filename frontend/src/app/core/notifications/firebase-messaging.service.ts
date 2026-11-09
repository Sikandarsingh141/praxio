import { Injectable } from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import type { MessagePayload, Unsubscribe } from 'firebase/messaging';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseMessagingService {
  isConfigured(): boolean {
    const config = environment.firebase;
    return Boolean(
      config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.messagingSenderId &&
      config.appId &&
      environment.firebaseVapidKey,
    );
  }

  async requestDeviceToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error(
        'Firebase Web Push is not configured. Add the public Firebase web settings and VAPID key to the frontend environment.',
      );
    }
    await this.requestBrowserPermission();
    if (!('serviceWorker' in navigator)) {
      throw new Error('This browser does not support Firebase Web Push notifications.');
    }

    const messagingSdk = await import('firebase/messaging');
    if (!(await messagingSdk.isSupported())) {
      throw new Error('This browser does not support Firebase Web Push notifications.');
    }

    const config = environment.firebase;
    const serviceWorkerUrl = new URL('/firebase-messaging-sw.js', window.location.origin);
    serviceWorkerUrl.searchParams.set('firebaseConfig', JSON.stringify(config));
    const serviceWorkerRegistration = await navigator.serviceWorker.register(serviceWorkerUrl);
    const app = await this.getFirebaseApp();
    const token = await messagingSdk.getToken(messagingSdk.getMessaging(app), {
      vapidKey: environment.firebaseVapidKey,
      serviceWorkerRegistration,
    });
    if (!token) {
      throw new Error('Firebase did not return a push token for this browser.');
    }
    return token;
  }

  async listen(callback: (payload: MessagePayload) => void): Promise<Unsubscribe | null> {
    if (!this.isConfigured()) {
      return null;
    }
    const messagingSdk = await import('firebase/messaging');
    if (!(await messagingSdk.isSupported())) {
      return null;
    }
    return messagingSdk.onMessage(messagingSdk.getMessaging(await this.getFirebaseApp()), callback);
  }

  async requestBrowserPermission(): Promise<void> {
    if (typeof Notification === 'undefined') {
      throw new Error('This browser does not support browser notifications.');
    }
    const permission =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== 'granted') {
      throw new Error(
        permission === 'denied'
          ? 'Browser notifications are blocked. Allow notifications for this site in your browser settings.'
          : 'Notification permission was not granted.',
      );
    }
  }

  async showBrowserNotification(title: string, body: string, link: string): Promise<void> {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }

    const options: NotificationOptions = {
      body,
      data: { link },
    };
    const registration = await navigator.serviceWorker?.getRegistration('/');
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
    const notification = new Notification(title, options);
    notification.onclick = () => {
      const target = new URL(options.data.link, window.location.origin);
      if (target.origin === window.location.origin) {
        window.location.assign(target);
      }
    };
  }

  private async getFirebaseApp(): Promise<FirebaseApp> {
    const appSdk = await import('firebase/app');
    return appSdk.getApps().some((app) => app.name === '[DEFAULT]')
      ? appSdk.getApp()
      : appSdk.initializeApp(environment.firebase);
  }
}
