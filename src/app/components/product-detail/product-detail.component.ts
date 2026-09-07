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
  Shelf,
  MoveStockRequest,
} from '../../models/inventory.models';
import { FormsModule } from '@angular/forms';
import { MoveStockDialogComponent } from '../move-stock-dialog/move-stock-dialog.component';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MoveStockDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-6">
      <!-- Breadcrumbs -->
      <div class="text-sm breadcrumbs opacity-50 uppercase font-bold tracking-widest">
        <ul>
          <li><a routerLink="/products">Almacén</a></li>
          <li class="text-primary">{{ product()?.name || 'Cargando...' }}</li>
        </ul>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-20">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
      } @else if (product(); as p) {
        <!-- Header Card -->
        <div class="card-racing rounded-2xl relative">
          <div class="racing-stripe absolute top-0 left-0"></div>
          <div class="card-body p-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div class="flex items-center gap-4">
                <div class="bg-primary p-3 rounded-xl shadow-lg shadow-primary/20">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-primary-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <h1 class="text-4xl font-black tracking-tighter italic uppercase font-technical text-base-content">{{ p.name }}</h1>
                  <p class="text-xs uppercase tracking-[0.3em] font-bold text-primary mt-1">
                    SKU: {{ p.sku || 'SERIAL-PENDIENTE' }}
                  </p>
                  @if (p.price != null) {
                    <p class="text-sm font-bold text-success mt-2">Precio: {{ formatPrice(p.price) }}</p>
                  }
                </div>
              </div>
              
              <div class="bg-base-300/50 p-4 rounded-xl border border-base-content/5 min-w-[150px] text-center">
                <p class="text-[10px] uppercase tracking-widest font-black opacity-40 mb-1">Stock Disponible</p>
                <p class="text-4xl font-black text-accent font-technical leading-none">{{ totalStock() }}</p>
                <p class="text-[10px] uppercase tracking-widest font-bold opacity-40 mt-1">Unidades</p>
              </div>
            </div>

            @if (p.description) {
              <div class="mt-6 p-4 bg-base-content/5 rounded-lg border border-base-content/5">
                <p class="text-sm opacity-70 leading-relaxed italic">"{{ p.description }}"</p>
              </div>
            }
          </div>
        </div>

        <!-- Locations Breakdown -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 space-y-6">
            <div class="card-racing rounded-xl">
              <div class="p-6 border-b border-base-content/5 flex items-center justify-between bg-base-300/20">
                <h2 class="text-xl flex items-center gap-2 font-technical italic">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  Distribución en Bahías
                </h2>
                <span class="text-[10px] font-black opacity-30 uppercase tracking-widest">Telemetría de Ubicación</span>
              </div>

              <div class="overflow-x-auto">
                <table class="table w-full">
                  <thead class="bg-base-300/30 text-[10px] uppercase tracking-widest font-black opacity-50 border-b border-base-content/5">
                    <tr>
                      <th class="py-4">Estantería / Código</th>
                      <th class="text-center">Carga</th>
                      <th class="text-right px-6">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="table-telemetry">
                    @for (item of p.shelfItems; track item.id) {
                      <tr class="hover:bg-base-content/5 transition-colors border-b border-base-content/5 last:border-0">
                        <td class="py-4">
                          <a [routerLink]="['/shelf', item.shelf.id]" class="flex items-center gap-3 group">
                             <div class="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                             <span class="font-bold text-base group-hover:text-primary transition-colors">{{ item.shelf.locationCode }}</span>
                          </a>
                        </td>
                        <td class="text-center">
                          <span class="text-xl font-black text-base-content">{{ item.quantity }}</span>
                          <span class="text-[10px] ml-1 opacity-40">UDS</span>
                        </td>
                        <td class="text-right px-6">
                          <div class="flex justify-end gap-2">
                            <button class="btn btn-ghost btn-xs text-primary font-bold uppercase tracking-tighter" (click)="onOpenMove(item)">
                              Mover
                            </button>
                            <button class="btn btn-ghost btn-xs text-error/50 hover:text-error font-bold uppercase tracking-tighter" (click)="onRemoveStock(item.id)">
                              Purgar
                            </button>
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="3" class="text-center py-12 opacity-20 italic uppercase tracking-[0.2em] font-black">
                          Sin registros de ubicación activos
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Sidebar Actions -->
          <div class="space-y-4">
            <div class="card-racing rounded-xl">
              <div class="card-body p-6">
                <h3 class="text-lg mb-6 font-technical italic text-base-content flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Operaciones Rápidas
                </h3>
                <div class="flex flex-col gap-3">
                  <button class="btn btn-primary w-full btn-mechanical font-technical italic text-lg uppercase h-12" (click)="showAddStock = true">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Ingresar Stock
                  </button>
                  
                  @if (p.shelfItems && p.shelfItems.length > 1) {
                    <a [routerLink]="['/optimization', p.id]" class="btn btn-warning w-full btn-mechanical font-technical italic text-lg uppercase h-12">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Optimizar
                    </a>

                    <button class="btn btn-secondary w-full btn-mechanical font-technical italic text-lg uppercase h-12" (click)="onOpenConsolidate()">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Consolidar
                    </button>
                  }
                </div>
              </div>
            </div>
            
            <div class="card-racing rounded-xl bg-base-300/20">
               <div class="p-4 flex items-center gap-3">
                  <div class="w-1 h-10 bg-primary rounded-full"></div>
                  <div class="text-[10px] uppercase font-black opacity-40 leading-tight">
                    El sistema MotoStock garantiza precisión milimétrica en la ubicación de cada componente.
                  </div>
               </div>
            </div>
          </div>
        </div>
      } @else {
        <div class="alert alert-error card-racing border-error/20">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span class="font-technical uppercase tracking-widest">Error de Telemetría: Producto no identificado</span>
        </div>
      }
    </div>

    <!-- Consolidate Modal -->
    @if (showConsolidateModal()) {
      <div class="modal modal-open">
        <div class="modal-box">
          <h3 class="font-bold text-xl">Consolidar Stock</h3>
          <p class="py-4">
            El producto <strong>{{ product()?.name }}</strong> está repartido en {{ product()?.shelfItems?.length }} estanterías.
            Selecciona la estantería donde quieres juntar todas las unidades (<strong>{{ totalStock() }}</strong> uds).
          </p>
          
          <div class="form-control w-full mt-2">
            <label class="label"><span class="label-text font-medium">Ubicación Destino</span></label>
            <select class="select select-bordered w-full" [(ngModel)]="targetShelfId">
              <option [value]="0" disabled selected>Selecciona estantería...</option>
              @for (item of product()?.shelfItems; track item.id) {
                <option [value]="item.shelf.id">{{ item.shelf.locationCode }} (Tiene {{ item.quantity }} uds)</option>
              }
              <option disabled>── Otras Estanterías ──</option>
              @for (shelf of allShelves(); track shelf.id) {
                @if (!isAlreadyInShelf(shelf.id)) {
                  <option [value]="shelf.id">{{ shelf.locationCode }}</option>
                }
              }
            </select>
          </div>

          <div class="modal-action">
            <button class="btn btn-ghost" (click)="showConsolidateModal.set(false)">Cancelar</button>
            <button 
              class="btn btn-secondary" 
              [disabled]="!targetShelfId || consolidating()"
              (click)="confirmConsolidate()"
            >
              @if (consolidating()) { <span class="loading loading-spinner"></span> }
              Consolidar Ahora
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Add Stock Modal -->
    @if (showAddStock) {
      <div class="modal modal-open">
        <div class="modal-box">
          <h3 class="font-bold text-xl">Añadir Stock</h3>
          <div class="space-y-4 mt-4">
            <div class="form-control">
              <label class="label"><span class="label-text">Estantería</span></label>
              <select class="select select-bordered" [(ngModel)]="addStockShelfId">
                <option [value]="0" disabled>Selecciona...</option>
                @for (s of allShelves(); track s.id) {
                  <option [value]="s.id">{{ s.locationCode }}</option>
                }
              </select>
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Cantidad</span></label>
              <input type="number" class="input input-bordered" [(ngModel)]="addStockQty" min="1" />
            </div>
          </div>
          <div class="modal-action">
            <button class="btn btn-ghost" (click)="showAddStock = false">Cancelar</button>
            <button class="btn btn-primary" (click)="confirmAddStock()" [disabled]="!addStockShelfId || addStockQty < 1">Añadir</button>
          </div>
        </div>
      </div>
    }

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
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(InventoryService);
  private readonly notification = inject(NotificationService);
  private readonly router = inject(Router);

  readonly product = signal<Product | null>(null);
  readonly loading = signal(true);
  readonly totalStock = computed(() => {
    const p = this.product();
    return p?.shelfItems?.reduce((sum, item) => sum + item.quantity, 0) || 0;
  });

  readonly allShelves = signal<ShelfWithItems[]>([]);
  readonly showConsolidateModal = signal(false);
  readonly consolidating = signal(false);
  readonly selectedItem = signal<ShelfItem | null>(null);
  targetShelfId = 0;

  showAddStock = false;
  addStockShelfId = 0;
  addStockQty = 1;

  ngOnInit() {
    this.route.params.subscribe((params) => {
      const id = +params['id'];
      if (id) {
        this.loadProduct(id);
      }
    });
    this.svc.getShelvesFlat().subscribe((s) => this.allShelves.set(s));
  }

  loadProduct(id: number) {
    this.loading.set(true);
    this.svc.getProducts().subscribe({
      next: (products) => {
        const found = products.find((p) => p.id === id);
        this.product.set(found || null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  isAlreadyInShelf(shelfId: number): boolean {
    return this.product()?.shelfItems?.some((i) => i.shelf.id === shelfId) || false;
  }

  formatPrice(price: Product['price']): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2,
    }).format(Number(price));
  }

  onOpenConsolidate() {
    this.targetShelfId = 0;
    this.showConsolidateModal.set(true);
  }

  confirmConsolidate() {
    const p = this.product();
    if (!p || !this.targetShelfId) return;

    this.consolidating.set(true);
    this.svc.consolidateProduct({ productId: p.id, targetShelfId: +this.targetShelfId }).subscribe({
      next: (res) => {
        this.notification.success(res.message);
        this.showConsolidateModal.set(false);
        this.consolidating.set(false);
        this.loadProduct(p.id);
      },
      error: () => this.consolidating.set(false),
    });
  }

  onRemoveStock(shelfItemId: number) {
    if (confirm('¿Estás seguro de que quieres eliminar este producto de este estante?')) {
      this.svc.removeStock(shelfItemId).subscribe(() => {
        this.notification.success('Ubicación eliminada');
        this.loadProduct(this.product()!.id);
      });
    }
  }

  confirmAddStock() {
    const p = this.product();
    if (!p || !this.addStockShelfId) return;

    this.svc
      .addStock({
        productId: p.id,
        shelfId: +this.addStockShelfId,
        quantity: this.addStockQty,
      })
      .subscribe(() => {
        this.notification.success('Stock añadido');
        this.showAddStock = false;
        this.loadProduct(p.id);
      });
  }

  onOpenMove(item: any) {
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
        this.loadProduct(request.productId);
      },
      error: () => {
        this.selectedItem.set(null);
      },
    });
  }
}
