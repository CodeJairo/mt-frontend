import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { InventoryService } from '../../services/inventory.service';
import { NotificationService } from '../../services/notification.service';
import {
  Product,
  ShelfWithItems,
  ShelfItem,
  MoveStockRequest,
  Shelf,
} from '../../models/inventory.models';
import { MoveStockDialogComponent } from '../move-stock-dialog/move-stock-dialog.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-optimization-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MoveStockDialogComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Breadcrumbs -->
      <div class="text-sm breadcrumbs opacity-50 uppercase font-bold tracking-widest">
        <ul>
          <li><a routerLink="/">Dashboard</a></li>
          <li><a routerLink="/products">Almacén</a></li>
          <li>
            <a [routerLink]="['/product', product()?.id]">{{ product()?.name || 'Producto' }}</a>
          </li>
          <li class="text-primary">Optimización</li>
        </ul>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-20">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
      } @else if (product(); as p) {
        <!-- Problem Card -->
        <div class="card-racing rounded-2xl border-l-4 border-l-warning overflow-hidden">
          <div class="card-body p-6">
            <div class="flex items-start gap-4">
              <div class="p-3 bg-warning/20 rounded-xl text-warning animate-pulse">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2.5"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 14c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h1 class="text-2xl font-technical italic text-warning uppercase leading-tight">
                  Alerta de Fragmentación: {{ p.name }}
                </h1>
                <p class="text-sm opacity-60 max-w-2xl mt-1 font-medium">
                  Se ha detectado que este componente ocupa
                  <strong>{{ p.shelfItems?.length }} ubicaciones distintas</strong>. Se recomienda
                  consolidar para maximizar la eficiencia del flujo de trabajo.
                </p>
              </div>
            </div>

            <div class="flex flex-wrap gap-3 mt-6">
              <div
                class="bg-base-300/50 px-4 py-2 rounded-lg border border-base-content/5 flex items-center gap-3"
              >
                <span class="text-[10px] font-black opacity-30 uppercase tracking-widest"
                  >Carga Total</span
                >
                <span class="text-xl font-technical text-accent leading-none"
                  >{{ totalStock() }} UDS</span
                >
              </div>
              <div
                class="bg-base-300/50 px-4 py-2 rounded-lg border border-base-content/5 flex items-center gap-3"
              >
                <span class="text-[10px] font-black opacity-30 uppercase tracking-widest"
                  >Estado</span
                >
                <span class="badge badge-warning badge-sm font-bold uppercase tracking-tighter"
                  >Requiere Ajuste</span
                >
              </div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Current Locations -->
          <div class="lg:col-span-2">
            <div class="card-racing rounded-xl">
              <div
                class="p-6 border-b border-base-content/5 flex items-center justify-between bg-base-300/20"
              >
                <h2 class="text-xl flex items-center gap-2 font-technical italic">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                  </svg>
                  Estanterias Ocupadas
                </h2>
                <span class="text-[10px] font-black opacity-30 uppercase tracking-widest"
                  >Telemetría de Redundancia</span
                >
              </div>
              <div class="overflow-x-auto">
                <table class="table w-full">
                  <thead
                    class="bg-base-300/30 text-[10px] uppercase tracking-widest font-black opacity-50 border-b border-base-content/5"
                  >
                    <tr>
                      <th class="py-4 px-6">Ubicación Actual</th>
                      <th class="text-center">Existencias</th>
                      <th class="text-right px-6">Comando</th>
                    </tr>
                  </thead>
                  <tbody class="table-telemetry">
                    @for (item of p.shelfItems; track item.id) {
                      <tr
                        class="hover:bg-base-content/5 transition-colors border-b border-base-content/5 last:border-0"
                      >
                        <td class="py-4 px-6">
                          <div class="flex items-center gap-2">
                            <div class="w-1.5 h-1.5 rounded-full bg-warning"></div>
                            <span class="font-bold text-base">{{ item.shelf.locationCode }}</span>
                          </div>
                        </td>
                        <td class="text-center">
                          <span class="text-xl font-black text-base-content">{{ item.quantity }}</span>
                          <span class="text-[10px] ml-1 opacity-40">UDS</span>
                        </td>
                        <td class="text-right px-6">
                          <button
                            class="btn btn-ghost btn-xs text-primary font-black uppercase tracking-tighter hover:bg-primary/10"
                            (click)="onOpenMove(item)"
                          >
                            Mover Todo
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Consolidation Sidebar -->
          <div class="space-y-4">
            <div class="card-racing rounded-xl relative overflow-hidden">
              <div class="racing-stripe absolute top-0 left-0 bg-accent"></div>
              <div class="card-body p-6 bg-accent/5">
                <h3
                  class="font-technical italic text-2xl text-accent uppercase mb-2 flex items-center gap-2"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2.5"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                  Consolidar
                </h3>
                <p class="text-xs opacity-60 leading-relaxed font-medium">
                  Procedimiento técnico para unificar las
                  <strong>{{ totalStock() }}</strong> unidades en una única estanteria.
                </p>

                <div class="form-control w-full mt-6">
                  <label class="label pt-0">
                    <span class="text-[10px] font-black uppercase tracking-[0.2em] opacity-40"
                      >Bahía Destino Recomenda</span
                    >
                  </label>
                  <select
                    class="select select-bordered w-full bg-base-200 border-base-content/10 font-technical text-lg uppercase tracking-wider"
                    [(ngModel)]="targetShelfId"
                  >
                    <option [value]="0" disabled selected>SELECCIONAR...</option>
                    @for (s of allShelves(); track s.id) {
                      <option [value]="s.id">{{ s.locationCode }}</option>
                    }
                  </select>
                </div>

                <div class="card-actions justify-end mt-6">
                  <button
                    class="btn btn-accent w-full btn-mechanical font-technical italic text-lg uppercase h-12 text-black"
                    [disabled]="!targetShelfId || consolidating()"
                    (click)="confirmConsolidate()"
                  >
                    @if (consolidating()) {
                      <span class="loading loading-spinner loading-xs"></span>
                    }
                    Ejecutar Unificación
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Move Dialog -->
    @if (selectedItem(); as item) {
      <app-move-stock-dialog
        [item]="item"
        [currentShelfId]="item.shelf.id"
        [shelves]="allShelves()"
        (confirm)="onMoveStock($event)"
        (cancel)="selectedItem.set(null)"
      />
    }
  `,
})
export class OptimizationDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(InventoryService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  readonly product = signal<Product | null>(null);
  readonly loading = signal(true);
  readonly allShelves = signal<ShelfWithItems[]>([]);
  readonly selectedItem = signal<ShelfItem | null>(null);
  readonly consolidating = signal(false);

  targetShelfId = 0;

  readonly totalStock = computed(() => {
    const p = this.product();
    return p?.shelfItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  });

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const id = +params['id'];
      if (id) {
        this.loadData(id);
      }
    });
  }

  loadData(productId: number) {
    this.loading.set(true);
    // Load product and shelves in parallel
    this.svc.getProducts().subscribe({
      next: (products) => {
        const found = products.find((p) => p.id === productId);
        this.product.set(found || null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.svc.getShelvesFlat().subscribe({
      next: (shelves) => this.allShelves.set(shelves),
    });
  }

  onOpenMove(item: any) {
    // Map product's shelfItem to full ShelfItem model for the dialog
    const shelfItem: ShelfItem = {
      ...item,
      productId: this.product()!.id,
      product: this.product()!,
      shelfId: item.shelf.id,
      shelf: item.shelf as Shelf,
    };
    this.selectedItem.set(shelfItem);
  }

  onMoveStock(request: MoveStockRequest) {
    this.svc.moveStock(request).subscribe({
      next: (res) => {
        this.notification.success(res.message);
        this.selectedItem.set(null);
        this.loadData(request.productId);
      },
      error: (err) => {
        // Error is handled by interceptor, but we might want to stop loading
      },
    });
  }

  confirmConsolidate() {
    const p = this.product();
    if (!p || !this.targetShelfId) return;

    this.consolidating.set(true);
    this.svc
      .consolidateProduct({
        productId: p.id,
        targetShelfId: +this.targetShelfId,
      })
      .subscribe({
        next: (res) => {
          this.notification.success(res.message);
          this.consolidating.set(false);
          this.router.navigate(['/product', p.id]);
        },
        error: () => this.consolidating.set(false),
      });
  }
}
