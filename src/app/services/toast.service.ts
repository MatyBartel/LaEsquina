import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
  durationMs: number;
  isConfirm?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private messagesSubject = new BehaviorSubject<ToastMessage[]>([]);
  messages$ = this.messagesSubject.asObservable();
  private nextId = 1;
  private confirmResolvers = new Map<number, (ok: boolean) => void>();

  show(text: string, type: ToastType = 'success', durationMs = 2500): void {
    const toast: ToastMessage = { id: this.nextId++, text, type, durationMs };
    const current = this.messagesSubject.value;
    this.messagesSubject.next([...current, toast]);

    if (durationMs > 0) {
      setTimeout(() => this.dismiss(toast.id), durationMs);
    }
  }

  confirm(text: string, type: ToastType = 'warning'): Promise<boolean> {
    const id = this.nextId++;
    const toast: ToastMessage = { id, text, type, durationMs: 0, isConfirm: true };
    const current = this.messagesSubject.value;
    this.messagesSubject.next([...current, toast]);
    return new Promise(resolve => {
      this.confirmResolvers.set(id, resolve);
    });
  }

  dismiss(id: number): void {
    const filtered = this.messagesSubject.value.filter(t => t.id !== id);
    this.messagesSubject.next(filtered);
  }

  resolveConfirm(id: number, ok: boolean): void {
    const resolver = this.confirmResolvers.get(id);
    if (resolver) {
      resolver(ok);
      this.confirmResolvers.delete(id);
    }
    this.dismiss(id);
  }
}

