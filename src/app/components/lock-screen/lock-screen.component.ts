import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-lock-screen',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-base-200 flex items-center justify-center px-4 selection:bg-primary/30">
      <!-- Background pattern -->
      <div class="absolute inset-0 opacity-30"
        style="background-image: radial-gradient(rgba(255, 102, 0, 0.05) 1px, transparent 0); background-size: 24px 24px;">
      </div>

      <div class="card-racing rounded-2xl w-full max-w-md relative z-10 overflow-hidden">
        <!-- Racing stripe top -->
        <div class="h-1 w-full bg-gradient-to-r from-primary via-primary/50 to-transparent"></div>

        <div class="card-body p-8 sm:p-10 flex flex-col items-center">
          <!-- Logo -->
          <div class="flex items-center gap-3 mb-2">
            <div class="bg-primary p-2.5 rounded-xl shadow-lg shadow-primary/30">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-primary-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div class="flex flex-col leading-none">
              <span class="text-3xl font-black tracking-tighter uppercase font-technical italic text-primary">MotoStock</span>
              <span class="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">Racing Inventory</span>
            </div>
          </div>

          <!-- Lock icon -->
          <div class="my-6 p-4 bg-base-content/5 rounded-full border border-base-content/10">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <p class="text-[10px] uppercase tracking-[0.3em] font-black opacity-30 mb-6">Acceso Restringido</p>

          <!-- Error message -->
          @if (error()) {
            <div class="alert alert-error text-sm py-2 px-4 rounded-lg mb-4 w-full">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 14c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{{ error() }}</span>
            </div>
          }

          <!-- Password form -->
          <form (ngSubmit)="onSubmit()" class="w-full space-y-4">
            <div class="form-control w-full">
              <input
                type="password"
                placeholder="Ingresa la clave de acceso..."
                class="input input-bordered w-full h-14 text-center font-technical text-lg tracking-[0.2em] uppercase bg-base-200/50 border-base-content/10 focus:border-primary/50 transition-all"
                [(ngModel)]="password"
                name="password"
                autocomplete="current-password"
                autofocus
                [disabled]="loading()"
              />
            </div>

            <button
              type="submit"
              class="btn btn-primary w-full h-14 btn-mechanical font-technical italic text-xl uppercase shadow-lg shadow-primary/20"
              [disabled]="!password || loading()"
            >
              @if (loading()) {
                <span class="loading loading-spinner loading-sm"></span>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              }
              Desbloquear
            </button>
          </form>

          <!-- Footer note -->
          <p class="text-[9px] uppercase tracking-widest font-bold opacity-20 mt-8 text-center">
            Sistema de Gestión de Inventario — Acceso Autorizado
          </p>
        </div>
      </div>
    </div>
  `,
})
export class LockScreenComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  password = '';
  readonly loading = signal(false);
  readonly error = signal('');

  onSubmit(): void {
    if (!this.password) return;

    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.error?.message || 'Contraseña incorrecta',
        );
        this.password = '';
      },
    });
  }
}
