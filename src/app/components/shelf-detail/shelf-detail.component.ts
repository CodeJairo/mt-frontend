import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  effect,
  input,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { InventoryService } from '../../services/inventory.service';
import { NotificationService } from '../../services/notification.service';
import { ExportService } from '../../services/export.service';
import { MoveStockDialogComponent } from '../move-stock-dialog/move-stock-dialog.component';
import { MoveStockBatchDialogComponent } from '../move-stock-batch-dialog/move-stock-batch-dialog.component';
import {
  ShelfWithItems,
  ShelfItem,
  MoveStockRequest,
  MoveStockBatchRequest,
  Product,
  Category,
  BreadcrumbItem,
  ShelfTotals,
} from '../../models/inventory.models';

@Component({
  selector: 'app-shelf-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MoveStockDialogComponent,
    MoveStockBatchDialogComponent,
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './shelf-detail.component.html',
})
export class ShelfDetailComponent {
  readonly id = input.required<string>();

  private readonly svc = inject(InventoryService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);
  private readonly exportSvc = inject(ExportService);

  readonly shelf = signal<ShelfWithItems | null>(null);
  readonly allShelves = signal<ShelfWithItems[]>([]);
  readonly allProducts = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly selectedItem = signal<ShelfItem | null>(null);
  readonly showAddProduct = signal(false);
  readonly addingProduct = signal(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly showEditShelf = signal(false);
  readonly savingShelf = signal(false);
  readonly confirmingDelete = signal(false);
  readonly deletingShelf = signal(false);
  readonly editingItemId = signal(0);
  readonly editQty = signal(0);
  readonly itemToRemove = signal<ShelfItem | null>(null);
  readonly newProductName = signal('');

  readonly showEditProduct = signal(false);
  readonly editingProduct = signal(false);
  readonly selectedItemToEdit = signal<ShelfItem | null>(null);
  readonly categories = signal<Category[]>([]);

  readonly searchTerm = signal('');
  readonly sortBy = signal<'name_asc' | 'name_desc' | 'qty_desc' | 'qty_asc' | 'sku_asc'>(
    'name_asc',
  );

  readonly filteredItems = computed(() => {
    const s = this.shelf();
    if (!s) return [];

    let items = s.shelfItems;
    const term = this.searchTerm().toLowerCase();

    if (term) {
      items = items.filter(
        (i) =>
          i.product.name.toLowerCase().includes(term) ||
          (i.product.sku && i.product.sku.toLowerCase().includes(term)),
      );
    }

    const sort = this.sortBy();
    return [...items].sort((a, b) => {
      switch (sort) {
        case 'name_asc':
          return a.product.name.localeCompare(b.product.name);
        case 'name_desc':
          return b.product.name.localeCompare(a.product.name);
        case 'qty_desc':
          return b.quantity - a.quantity;
        case 'qty_asc':
          return a.quantity - b.quantity;
        case 'sku_asc':
          return (a.product.sku || '').localeCompare(b.product.sku || '');
        default:
          return 0;
      }
    });
  });
  readonly selectedBatchItems = signal<Set<number>>(new Set());
  readonly showBatchMoveDialog = signal(false);
  readonly showBatchCategoryDialog = signal(false);
  readonly batchCategoryIds = signal<number[]>([]);
  readonly savingBatchCategories = signal(false);
  readonly breadcrumbs = signal<BreadcrumbItem[]>([]);
  readonly recursiveTotals = signal<ShelfTotals>({ totalProducts: 0, totalUnits: 0 });
  readonly showCreateSubShelf = signal(false);
  readonly creatingSubShelf = signal(false);
  readonly currentDepth = signal(1);
  readonly isDragging = signal(false);
  readonly subShelfToDelete = signal<ShelfWithItems | null>(null);
  readonly deletingSubShelf = signal(false);

  readonly createProductForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    sku: [''],
    description: [''],
    price: [null as number | null, [Validators.min(0), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
  });

  readonly editProductForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    sku: [''],
    description: [''],
    price: [null as number | null, [Validators.min(0), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    categoryIds: [[] as number[]],
  });

  readonly editShelfForm = this.fb.nonNullable.group({
    locationCode: ['', Validators.required],
    description: [''],
  });

  readonly subShelfForm = this.fb.nonNullable.group({
    locationCode: ['', Validators.required],
    description: [''],
  });

  readonly nameSuggestions = computed(() => {
    const q = this.newProductName().toLowerCase().trim();
    if (!q || q.length < 2 || this.selectedProduct()) return [];
    return this.allProducts()
      .filter((p) => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)))
      .slice(0, 8);
  });

  readonly canCreateSubShelf = computed(() => this.currentDepth() < 4);

  /** Route for the back button: parent shelf (from breadcrumbs) or dashboard */
  readonly parentRoute = computed(() => {
    const bc = this.breadcrumbs();
    if (bc.length > 1) {
      // second-to-last breadcrumb is the parent shelf
      return ['/shelf', bc[bc.length - 2].id];
    }
    return ['/'];
  });

  /**
   * CRITICAL FIX: Use effect() to react to route param changes.
   * ngOnInit only fires once, but when navigating from /shelf/1 to /shelf/2
   * (same component), the input signal updates but ngOnInit doesn't re-fire.
   */
  constructor() {
    effect(() => {
      const currentId = this.id();
      if (currentId) {
        this.loadData();
      }
    });
  }

  // ── Recursive product count (for sub-shelf badges) ──
  countRecursiveProducts(shelf: ShelfWithItems): number {
    let total = shelf.shelfItems.length;
    if (shelf.children) {
      for (const child of shelf.children) {
        total += this.countRecursiveProducts(child);
      }
    }
    return total;
  }

  // ── Drag & Drop ──
  onDragStart(event: DragEvent, item: ShelfItem): void {
    this.isDragging.set(true);

    // Check if item is selected — if so, drag ALL selected items
    const selectedIds = this.selectedBatchItems();
    const isSelected = selectedIds.has(item.id);
    const itemsToDrag: ShelfItem[] = isSelected
      ? this.shelf()!.shelfItems.filter((i) => selectedIds.has(i.id))
      : [item];

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(
        'text/plain',
        JSON.stringify({
          items: itemsToDrag.map((i) => ({
            shelfItemId: i.id,
            productId: i.productId,
            sourceShelfId: i.shelfId,
            quantity: i.quantity,
            productName: i.product.name,
          })),
          count: itemsToDrag.length,
        }),
      );
    }
    const el = event.target as HTMLElement;
    el.classList.add('opacity-40');
  }

  onDragEnd(event: DragEvent): void {
    this.isDragging.set(false);
    const el = event.target as HTMLElement;
    el.classList.remove('opacity-40');
  }

  onChildDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    const el = event.currentTarget as HTMLElement;
    el.classList.add('border-primary', 'border-2', 'bg-primary/5');
  }

  onChildDragLeave(event: DragEvent): void {
    const el = event.currentTarget as HTMLElement;
    el.classList.remove('border-primary', 'border-2', 'bg-primary/5');
  }

  onChildDrop(event: DragEvent, targetChild: ShelfWithItems): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    const el = event.currentTarget as HTMLElement;
    el.classList.remove('border-primary', 'border-2', 'bg-primary/5');

    if (!event.dataTransfer) return;
    try {
      const data = JSON.parse(event.dataTransfer.getData('text/plain'));
      const items: {
        shelfItemId: number;
        productId: number;
        sourceShelfId: number;
        quantity: number;
        productName: string;
      }[] = data.items;

      if (!items || items.length === 0) return;

      // Check: cannot drop to same shelf
      if (items[0].sourceShelfId === targetChild.id) {
        this.notificationService.error('Los productos ya están en ese cajón.');
        return;
      }

      if (items.length === 1) {
        // Single item move
        const item = items[0];
        this.svc
          .moveStock({
            productId: item.productId,
            sourceShelfId: item.sourceShelfId,
            targetShelfId: targetChild.id,
            amount: item.quantity,
          })
          .subscribe({
            next: () => {
              this.notificationService.success(
                `"${item.productName}" movido a ${targetChild.locationCode}`,
              );
              this.selectedBatchItems.set(new Set());
              this.loadData();
            },
          });
      } else {
        // Batch move
        this.svc
          .moveStockBatch({
            sourceShelfId: items[0].sourceShelfId,
            targetShelfId: targetChild.id,
            items: items.map((i) => ({ productId: i.productId, amount: i.quantity })),
          })
          .subscribe({
            next: (res) => {
              this.notificationService.success(
                `${items.length} productos movidos a ${targetChild.locationCode}`,
              );
              this.selectedBatchItems.set(new Set());
              this.loadData();
            },
          });
      }
    } catch {
      // Invalid drag data
    }
  }

  // ── Delete sub-shelf ──
  onDeleteSubShelf(child: ShelfWithItems): void {
    this.subShelfToDelete.set(child);
  }

  confirmDeleteSubShelf(action: 'delete' | 'reassign'): void {
    const child = this.subShelfToDelete();
    if (!child) return;
    this.deletingSubShelf.set(true);

    if (action === 'reassign') {
      this.svc.deleteShelfAndReassign(child.id).subscribe({
        next: (res) => {
          this.notificationService.success(res.message);
          this.subShelfToDelete.set(null);
          this.deletingSubShelf.set(false);
          this.loadData();
        },
        error: () => this.deletingSubShelf.set(false),
      });
    } else {
      this.svc.deleteShelf(child.id).subscribe({
        next: () => {
          this.notificationService.success(`"${child.locationCode}" eliminado`);
          this.subShelfToDelete.set(null);
          this.deletingSubShelf.set(false);
          this.loadData();
        },
        error: () => this.deletingSubShelf.set(false),
      });
    }
  }

  // ── Create sub-shelf ──
  onCreateSubShelf(): void {
    if (this.subShelfForm.invalid || !this.shelf()) return;
    this.creatingSubShelf.set(true);
    const val = this.subShelfForm.getRawValue();
    this.svc
      .createShelf({
        locationCode: val.locationCode,
        description: val.description || undefined,
        parentId: this.shelf()!.id,
      })
      .subscribe({
        next: () => {
          this.notificationService.success('Cajón creado');
          this.subShelfForm.reset({ locationCode: '', description: '' });
          this.showCreateSubShelf.set(false);
          this.creatingSubShelf.set(false);
          this.loadData();
        },
        error: () => this.creatingSubShelf.set(false),
      });
  }

  // ── Edit quantity in-situ ──
  startEditQty(item: ShelfItem): void {
    this.editingItemId.set(item.id);
    this.editQty.set(item.quantity);
  }

  saveEditQty(item: ShelfItem): void {
    const qty = this.editQty();
    if (qty < 1) return;
    this.svc.updateStock(item.id, qty).subscribe({
      next: (res) => {
        this.notificationService.success(res.message);
        this.editingItemId.set(0);
        this.loadData();
      },
    });
  }

  // ── Remove item from shelf ──
  onRemoveItem(item: ShelfItem): void {
    this.itemToRemove.set(item);
  }

  confirmRemoveItem(): void {
    const item = this.itemToRemove();
    if (!item) return;
    this.svc.removeStock(item.id).subscribe({
      next: (res) => {
        this.notificationService.success(res.message);
        this.itemToRemove.set(null);
        this.loadData();
      },
    });
  }

  // ── Batch selection ──
  toggleItemSelection(itemId: number): void {
    this.selectedBatchItems.update((current) => {
      const newSet = new Set(current);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      return newSet;
    });
  }

  isItemSelected(itemId: number): boolean {
    return this.selectedBatchItems().has(itemId);
  }

  toggleAllSelection(checked: boolean): void {
    const s = this.shelf();
    if (!s) return;
    this.selectedBatchItems.set(checked ? new Set(s.shelfItems.map((i) => i.id)) : new Set());
  }

  get allSelected(): boolean {
    const s = this.shelf();
    return s
      ? s.shelfItems.length > 0 && this.selectedBatchItems().size === s.shelfItems.length
      : false;
  }

  get indeterminate(): boolean {
    const s = this.shelf();
    const size = this.selectedBatchItems().size;
    return s ? size > 0 && size < s.shelfItems.length : false;
  }

  openBatchMoveDialog(): void {
    if (this.selectedBatchItems().size === 0) return;
    this.showBatchMoveDialog.set(true);
  }

  openBatchCategoryDialog(): void {
    if (this.selectedBatchItems().size === 0) return;
    this.batchCategoryIds.set([]);
    this.showBatchCategoryDialog.set(true);
  }

  closeBatchCategoryDialog(): void {
    this.showBatchCategoryDialog.set(false);
    this.batchCategoryIds.set([]);
    this.savingBatchCategories.set(false);
  }

  toggleBatchCategory(categoryId: number): void {
    this.batchCategoryIds.update((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  isBatchCategorySelected(categoryId: number): boolean {
    return this.batchCategoryIds().includes(categoryId);
  }

  saveBatchCategories(): void {
    const items = this.getSelectedItems();
    if (items.length === 0) return;

    this.savingBatchCategories.set(true);
    const categoryIds = this.batchCategoryIds();
    const productIds = [...new Set(items.map((item) => item.productId))];

    forkJoin(productIds.map((id) => this.svc.updateProduct(id, { categoryIds }))).subscribe({
      next: () => {
        this.notificationService.success(
          `Categorías actualizadas para ${productIds.length} ${productIds.length === 1 ? 'producto' : 'productos'}`,
        );
        this.closeBatchCategoryDialog();
        this.selectedBatchItems.set(new Set());
        this.loadData();
      },
      error: () => this.savingBatchCategories.set(false),
    });
  }

  closeBatchMoveDialog(): void {
    this.showBatchMoveDialog.set(false);
  }

  onBatchMoveConfirmed(req: MoveStockBatchRequest): void {
    this.svc.moveStockBatch(req).subscribe({
      next: (res) => {
        this.notificationService.success(res.message);
        this.closeBatchMoveDialog();
        this.selectedBatchItems.set(new Set());
        this.loadData();
      },
    });
  }

  getSelectedItems(): ShelfItem[] {
    const s = this.shelf();
    if (!s) return [];
    return s.shelfItems.filter((i) => this.selectedBatchItems().has(i.id));
  }

  // ── Edit shelf ──
  openEditShelf(): void {
    const s = this.shelf();
    if (!s) return;
    this.editShelfForm.patchValue({
      locationCode: s.locationCode,
      description: s.description ?? '',
    });
    this.showEditShelf.set(true);
  }

  onSaveEditShelf(): void {
    if (this.editShelfForm.invalid || !this.shelf()) return;
    this.savingShelf.set(true);
    this.svc.updateShelf(this.shelf()!.id, this.editShelfForm.getRawValue()).subscribe({
      next: () => {
        this.notificationService.success('Estantería actualizada');
        this.showEditShelf.set(false);
        this.savingShelf.set(false);
        this.loadData();
      },
      error: () => this.savingShelf.set(false),
    });
  }

  // ── Move stock ──
  openMoveDialog(item: ShelfItem): void {
    this.selectedItem.set(item);
  }
  closeMoveDialog(): void {
    this.selectedItem.set(null);
  }

  onMoveConfirmed(request: MoveStockRequest): void {
    this.svc.moveStock(request).subscribe({
      next: (res) => {
        this.notificationService.success(res.message);
        this.closeMoveDialog();
        this.loadData();
      },
    });
  }

  // ── Unified add product ──
  onUnifiedAddProduct(): void {
    if (this.createProductForm.invalid || !this.shelf()) return;
    this.addingProduct.set(true);
    const { name, sku, description, price, quantity } = this.createProductForm.getRawValue();
    const selected = this.selectedProduct();

    if (selected) {
      // Existing product — just add stock
      this.svc.addStock({ shelfId: this.shelf()!.id, productId: selected.id, quantity }).subscribe({
        next: (res) => {
          this.notificationService.success(res.message);
          this.resetAddDialog();
          this.loadData();
        },
        error: () => this.addingProduct.set(false),
      });
    } else {
      // New product — create then add stock
      this.svc.createProduct({ name, sku, description, price }).subscribe({
        next: (product) => {
          this.svc
            .addStock({ shelfId: this.shelf()!.id, productId: product.id, quantity })
            .subscribe({
              next: () => {
                this.notificationService.success(`"${name}" creado y agregado (${quantity} uds)`);
                this.resetAddDialog();
                this.loadData();
              },
              error: () => this.addingProduct.set(false),
            });
        },
        error: () => this.addingProduct.set(false),
      });
    }
  }

  selectSuggestion(product: Product): void {
    this.selectedProduct.set(product);
    this.newProductName.set(product.name);
    this.createProductForm.patchValue({ name: product.name });
  }

  clearSelection(): void {
    this.selectedProduct.set(null);
    this.newProductName.set('');
    this.createProductForm.patchValue({ name: '' });
  }

  resetAddDialog(): void {
    this.createProductForm.reset({ name: '', sku: '', description: '', price: null, quantity: 1 });
    this.selectedProduct.set(null);
    this.newProductName.set('');
    this.showAddProduct.set(false);
    this.addingProduct.set(false);
  }

  // ── Edit product ──
  openEditProduct(item: ShelfItem): void {
    this.selectedItemToEdit.set(item);
    this.editProductForm.patchValue({
      name: item.product.name,
      sku: item.product.sku || '',
      description: item.product.description || '',
      price: item.product.price == null ? null : Number(item.product.price),
      categoryIds: item.product.categories?.map((category) => category.id) ?? [],
    });
    this.showEditProduct.set(true);
  }

  closeEditProduct(): void {
    this.showEditProduct.set(false);
    this.editingProduct.set(false);
    this.selectedItemToEdit.set(null);
    this.editProductForm.reset();
  }

  onEditProductSubmit(): void {
    const item = this.selectedItemToEdit();
    if (!item || this.editProductForm.invalid) return;

    this.editingProduct.set(true);
    const val = this.editProductForm.getRawValue();

    this.svc.updateProduct(item.productId, val).subscribe({
      next: () => {
        this.notificationService.success('Producto actualizado');
        this.closeEditProduct();
        this.loadData();
      },
      error: () => this.editingProduct.set(false),
    });
  }

  toggleEditProductCategory(categoryId: number): void {
    const control = this.editProductForm.controls.categoryIds;
    const current = control.value;
    control.setValue(
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  isEditProductCategorySelected(categoryId: number): boolean {
    return this.editProductForm.controls.categoryIds.value.includes(categoryId);
  }

  formatPrice(price: Product['price']): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2,
    }).format(Number(price));
  }

  formatPriceInput(price: number | null): string {
    if (price == null) return '';
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(price);
  }

  onPriceInput(event: Event, control: FormControl<number | null>): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value;
    const normalized = raw.replace(/\./g, '').replace(/[^\d,]/g, '');

    if (!normalized) {
      control.setValue(null);
      input.value = '';
      return;
    }

    const [integerPart, ...decimalParts] = normalized.split(',');
    const decimals = decimalParts.join('').slice(0, 2);
    const integer = integerPart.replace(/^0+(?=\d)/, '') || '0';
    control.setValue(Number(`${integer}${decimalParts.length ? `.${decimals}` : ''}`));

    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    input.value = decimalParts.length ? `${grouped},${decimals}` : grouped;
  }

  // ── Delete shelf ──
  onDeleteShelf(): void {
    this.confirmingDelete.set(true);
  }

  confirmDeleteShelf(): void {
    const s = this.shelf();
    if (!s) return;
    this.deletingShelf.set(true);
    const parentId = s.parentId;
    this.svc.deleteShelf(s.id).subscribe({
      next: () => {
        this.deletingShelf.set(false);
        if (parentId) {
          this.router.navigate(['/shelf', parentId]);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: () => this.deletingShelf.set(false),
    });
  }

  confirmDeleteShelfWithReassign(): void {
    const s = this.shelf();
    if (!s) return;
    this.deletingShelf.set(true);
    const parentId = s.parentId;
    this.svc.deleteShelfAndReassign(s.id).subscribe({
      next: (res) => {
        this.notificationService.success(res.message);
        this.deletingShelf.set(false);
        this.confirmingDelete.set(false);
        if (parentId) {
          this.router.navigate(['/shelf', parentId]);
        } else {
          this.router.navigate(['/']);
        }
      },
      error: () => this.deletingShelf.set(false),
    });
  }

  exportPDF(): void {
    const s = this.shelf();
    if (s) {
      this.exportSvc.exportShelfPdf(s.id);
    }
  }

  private loadData(): void {
    this.loading.set(true);
    this.selectedBatchItems.set(new Set());
    const shelfId = Number(this.id());

    this.svc.getShelfDetail(shelfId).subscribe({
      next: (sh) => {
        this.shelf.set(sh);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.svc.getShelvesFlat().subscribe({ next: (sh) => this.allShelves.set(sh) });
    this.svc.getProducts().subscribe({ next: (p) => this.allProducts.set(p) });
    this.svc.getCategories().subscribe({ next: (categories) => this.categories.set(categories) });

    this.svc.getShelfBreadcrumbs(shelfId).subscribe({
      next: (bc) => {
        this.breadcrumbs.set(bc);
        this.currentDepth.set(bc.length);
      },
    });

    this.svc.getShelfTotals(shelfId).subscribe({
      next: (totals) => this.recursiveTotals.set(totals),
    });
  }
}
