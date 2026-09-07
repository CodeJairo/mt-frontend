import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  OnDestroy,
  HostListener,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs/operators';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventoryService } from './services/inventory.service';
import { ExportService } from './services/export.service';
import { NotificationService } from './services/notification.service';
import { AuthService } from './services/auth.service';
import { Product, ShelfWithItems } from './models/inventory.models';

interface SearchResult {
  type: 'product' | 'shelf';
  id: number;
  title: string;
  subtitle: string;
  route: string[];
}

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  template: `
    <div class="min-h-screen bg-base-200 pb-16 selection:bg-primary/30">
      <!-- Top Navbar -->
      @if (!isLoginRoute()) {
        <nav class="navbar bg-base-100/80 backdrop-blur-md border-b border-base-content/5 sticky top-0 z-50 px-4 min-h-16 shadow-2xl">
        <div class="navbar-start">
          <a
            routerLink="/"
            class="flex items-center gap-2 group transition-all active:scale-95"
          >
            <div class="bg-primary p-1.5 rounded-lg shadow-lg shadow-primary/20 group-hover:rotate-12 transition-transform">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-6 w-6 text-primary-content"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div class="flex flex-col leading-none">
              <span class="text-xl font-black tracking-tighter uppercase font-technical italic italic text-primary">MotoStock</span>
              <span class="text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">Racing Inventory</span>
            </div>
          </a>
        </div>

        <div class="navbar-end gap-2">
          <!-- Search Toggle -->
          <button
            class="btn btn-ghost btn-circle btn-sm sm:btn-md hover:bg-base-content/5"
            (click)="toggleSearch()"
            title="Buscar (Ctrl+K)"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 opacity-70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>

          <!-- Export PDF -->
          <button
            class="btn btn-ghost btn-circle btn-sm sm:btn-md"
            (click)="exportGlobalPDF()"
            title="Exportar PDF Global"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 sm:h-5 sm:w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </button>

          <!-- Theme toggle -->
          <label
            class="swap swap-rotate btn btn-ghost btn-circle btn-sm sm:btn-md"
            aria-label="Alternar tema"
          >
            <input
              type="checkbox"
              [checked]="isDark()"
              (change)="onThemeChange($event)"
              title="Alternar tema oscuro"
            />
            <svg
              class="swap-off h-4 w-4 sm:h-5 sm:w-5 fill-current"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path
                d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"
              />
            </svg>
            <svg
              class="swap-on h-4 w-4 sm:h-5 sm:w-5 fill-current"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path
                d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z"
              />
            </svg>
          </label>

          <!-- Logout -->
          <button
            class="btn btn-ghost btn-circle btn-sm sm:btn-md"
            (click)="onLogout()"
            title="Cerrar sesión"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 sm:h-5 sm:w-5 opacity-70"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </nav>
      }

      <!-- Global Search Modal -->
      @if (showSearch()) {
        <dialog
          class="modal modal-open modal-bottom sm:modal-middle"
          role="dialog"
          aria-modal="true"
          (click)="onDialogClick($event)"
        >
          <div
            class="modal-box p-0 overflow-hidden bg-base-100 shadow-2xl sm:max-w-2xl sm:rounded-2xl rounded-t-2xl m-0 sm:m-auto absolute bottom-0 sm:bottom-auto sm:top-[10%] max-h-[85vh] flex flex-col items-center"
          >
            <div class="relative w-full border-b border-base-300/50 bg-base-100 shrink-0">
              <input
                #globalSearchInput
                type="text"
                placeholder="Buscar productos o estantes..."
                class="input input-ghost w-full h-14 pl-12 sm:text-lg focus:outline-none focus:bg-base-100/50 rounded-none bg-transparent"
                [ngModel]="searchQuery()"
                (ngModelChange)="onGlobalSearch($event)"
                autofocus
                [autocomplete]="'off'"
                [spellcheck]="false"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 absolute left-4 top-1/2 -translate-y-1/2 text-base-content/40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <kbd
                class="kbd kbd-sm absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs opacity-50 hidden sm:inline-flex"
                >ESC</kbd
              >
            </div>

            <div class="overflow-y-auto w-full grow bg-base-200/30">
              @if (searchResults().length > 0) {
                <div class="p-2 w-full space-y-1">
                  @for (r of searchResults(); track r.type + r.id) {
                    <a
                      [routerLink]="r.route"
                      class="flex items-center gap-3 px-3 py-3 text-sm hover:bg-base-200 hover:shadow-sm rounded-xl transition-all cursor-pointer w-full group active:scale-[0.99]"
                      (click)="showSearch.set(false)"
                    >
                      @if (r.type === 'product') {
                        <div
                          class="bg-primary text-primary-content w-9 h-9 rounded-lg flex items-center justify-center font-bold shadow-sm group-hover:scale-105 transition-transform"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                        </div>
                      } @else {
                        <div
                          class="bg-secondary text-secondary-content w-9 h-9 rounded-lg flex items-center justify-center font-bold shadow-sm group-hover:scale-105 transition-transform"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            class="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                            />
                          </svg>
                        </div>
                      }
                      <div class="min-w-0 flex-1">
                        <p
                          class="font-semibold truncate text-base-content text-[15px] leading-tight"
                        >
                          {{ r.title }}
                        </p>
                        <p class="text-xs text-base-content/50 truncate mt-0.5">{{ r.subtitle }}</p>
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-4 w-4 opacity-0 group-hover:opacity-40 text-base-content transition-opacity shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </a>
                  }
                </div>
              } @else if (searchQuery()) {
                <div class="p-10 text-center w-full flex flex-col items-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-10 w-10 text-base-content/20 mb-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p class="text-base-content/60 font-medium">No se encontraron resultados para</p>
                  <p class="text-base-content font-bold mt-1 max-w-[80%] truncate">
                    "{{ searchQuery() }}"
                  </p>
                </div>
              } @else {
                <div class="p-10 text-center text-sm w-full flex flex-col items-center gap-3">
                  <div
                    class="bg-base-300 w-12 h-12 rounded-full flex items-center justify-center opacity-50"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-6 w-6 text-base-content"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                  <div class="text-base-content/50">
                    <p class="font-medium text-base mb-1">Busca cualquier cosa</p>
                    <p class="text-xs">Por nombre de producto, SKU o código de estantería</p>
                  </div>
                </div>
              }
            </div>
          </div>
          <form method="dialog" class="modal-backdrop bg-base-300/60 backdrop-blur-[2px]">
            <button (click)="showSearch.set(false)" title="Cerrar" class="cursor-default">
              close
            </button>
          </form>
        </dialog>
      }

      <!-- Content -->
      <main class="px-3 py-4 sm:container sm:mx-auto sm:px-4 sm:py-6 sm:max-w-7xl">
        <router-outlet />
      </main>

      <!-- Bottom Dock Navigation -->
      @if (!isLoginRoute()) {
        <div class="dock dock-sm z-50">
          <a
          routerLink="/"
          routerLinkActive="dock-active"
          [routerLinkActiveOptions]="{ exact: true }"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="size-[1.2em]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
          <span class="dock-label">Estantes</span>
        </a>
        <a routerLink="/products" routerLinkActive="dock-active">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="size-[1.2em]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <span class="dock-label">Productos</span>
        </a>
      </div>
      }
    </div>
  `,
})
export class App implements OnInit {
  private readonly svc = inject(InventoryService);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly isLoginRoute = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.includes('/login'))
    ),
    { initialValue: this.router.url.includes('/login') }
  );

  readonly isDark = signal(false);
  readonly showSearch = signal(false);
  readonly searchQuery = signal('');
  private readonly searchSubject = new Subject<string>();
  private allProducts: Product[] = [];
  private allShelves: ShelfWithItems[] = [];

  readonly searchResults = computed(() => {
    const q = this.searchQuery().toLowerCase();
    if (!q) return [] as SearchResult[];
    const results: SearchResult[] = [];

    for (const p of this.allProducts) {
      if (p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))) {
        const totalQty = p.shelfItems?.reduce((sum, si) => sum + si.quantity, 0) || 0;
        const locations =
          p.shelfItems?.map((si) => `${si.shelf.locationCode} (${si.quantity})`).join(', ') ||
          'Sin stock';

        results.push({
          type: 'product',
          id: p.id,
          title: p.name,
          subtitle: `Total: ${totalQty} uds | ${locations}`,
          route: ['/product', String(p.id)],
        });
      }
    }
    // Flatten all shelves recursively so sub-shelves appear in results
    const flatShelves = this.flattenShelves(this.allShelves);
    for (const { shelf, path } of flatShelves) {
      if (
        shelf.locationCode.toLowerCase().includes(q) ||
        (shelf.description ?? '').toLowerCase().includes(q) ||
        shelf.shelfItems.some((i) => i.product.name.toLowerCase().includes(q))
      ) {
        results.push({
          type: 'shelf',
          id: shelf.id,
          title: shelf.locationCode,
          subtitle: path || shelf.description || 'Estantería',
          route: ['/shelf', String(shelf.id)],
        });
      }
    }
    return results.slice(0, 12);
  });

  private flattenShelves(
    shelves: ShelfWithItems[],
    parentPath = '',
  ): { shelf: ShelfWithItems; path: string }[] {
    const result: { shelf: ShelfWithItems; path: string }[] = [];
    for (const s of shelves) {
      const currentPath = parentPath ? `${parentPath} › ${s.locationCode}` : '';
      result.push({ shelf: s, path: currentPath });
      if (s.children) {
        const childPath = parentPath ? `${parentPath} › ${s.locationCode}` : s.locationCode;
        result.push(...this.flattenShelves(s.children, childPath));
      }
    }
    return result;
  }

  constructor() {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((query) => {
        this.searchQuery.set(query);
      });
  }

  ngOnInit(): void {
    // Restore theme from localStorage
    const saved = localStorage.getItem('motostock-theme');
    const dark = saved !== 'light'; // Default to dark when no preference saved
    this.isDark.set(dark);
    document.documentElement.setAttribute(
      'data-theme',
      dark ? 'motoinventory-dark' : 'motoinventory',
    );
  }

  onThemeChange(e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this.isDark.set(checked);
    document.documentElement.setAttribute(
      'data-theme',
      checked ? 'motoinventory-dark' : 'motoinventory',
    );
    localStorage.setItem('motostock-theme', checked ? 'dark' : 'light');
  }

  toggleSearch(): void {
    const next = !this.showSearch();
    this.showSearch.set(next);
    if (next) {
      this.searchQuery.set('');
      // Load data for search
      this.svc.getProducts().subscribe({
        next: (p) => {
          this.allProducts = p;
        },
      });
      this.svc.getShelves().subscribe({
        next: (s) => {
          this.allShelves = s;
        },
      });
    }
  }

  onGlobalSearch(q: string): void {
    this.searchSubject.next(q);
  }

  private readonly exportSvc = inject(ExportService);

  exportGlobalPDF(): void {
    this.exportSvc.exportGlobalInventoryPdf();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      this.toggleSearch();
    }
  }

  onDialogClick(event: MouseEvent) {
    // If the click is exactly on the dialog element (outside the modal box)
    if ((event.target as HTMLElement).tagName === 'DIALOG') {
      this.showSearch.set(false);
    }
  }

  onLogout(): void {
    this.authService.logout();
  }
}
