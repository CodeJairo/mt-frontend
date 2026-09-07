import { Injectable, signal } from '@angular/core';

export interface AppNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  // We keep a list of active notifications
  readonly notifications = signal<AppNotification[]>([]);

  show(
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    durationMs = 3000,
  ) {
    const id = Math.random().toString(36).substring(2, 9);
    const newNotif: AppNotification = { id, message, type };

    this.notifications.update((n) => [...n, newNotif]);

    if (durationMs > 0) {
      setTimeout(() => {
        this.remove(id);
      }, durationMs);
    }
  }

  success(message: string, durationMs = 3000) {
    this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = 4000) {
    this.show(message, 'error', durationMs);
  }

  remove(id: string) {
    this.notifications.update((n) => n.filter((x) => x.id !== id));
  }
}
