import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryService } from '../../services/inventory.service';
import { NotificationService } from '../../services/notification.service';
import { OptimizationAlertComponent } from '../optimization-alert/optimization-alert.component';
import { ShelfWithItems, Product } from '../../models/inventory.models';

@Component({
  selector: 'app-inventory-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, OptimizationAlertComponent, ReactiveFormsModule],
  templateUrl: './inventory-dashboard.component.html',
})
export class InventoryDashboardComponent implements OnInit {
  private readonly svc = inject(InventoryService);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);

  readonly shelves = signal<ShelfWithItems[]>([]);
  readonly productList = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly filterQuery = signal('');
  private readonly searchSubject = new Subject<string>();

  // Pagination State
  readonly page = signal(1);
  readonly limit = signal(12);

  readonly showCreateShelf = signal(false);
  readonly savingShelf = signal(false);
  readonly shelfToDelete = signal<ShelfWithItems | null>(null);
  readonly deletingShelf = signal(false);

  readonly shelfForm = this.fb.nonNullable.group({
    locationCode: ['', Validators.required],
    description: [''],
  });

  readonly totalShelves = computed(() => this.shelves().length);
  readonly totalItems = computed(() =>
    this.shelves().reduce((s, sh) => s + this.countUnitsRecursive(sh), 0),
  );

  /** Recursively count all units in a shelf and its children */
  private countUnitsRecursive(shelf: ShelfWithItems): number {
    let total = shelf.shelfItems.reduce((a, i) => a + i.quantity, 0);
    if (shelf.children) {
      for (const child of shelf.children) {
        total += this.countUnitsRecursive(child);
      }
    }
    return total;
  }

  /** Recursively count all products in a shelf and its children */
  countProductsRecursive(shelf: ShelfWithItems): number {
    let total = shelf.shelfItems.length;
    if (shelf.children) {
      for (const child of shelf.children) {
        total += this.countProductsRecursive(child);
      }
    }
    return total;
  }

  /** Recursively collect all ShelfItems from a shelf and its children */
  collectAllItems(shelf: ShelfWithItems): ShelfWithItems['shelfItems'] {
    let items = [...shelf.shelfItems];
    if (shelf.children) {
      for (const child of shelf.children) {
        items = items.concat(this.collectAllItems(child));
      }
    }
    return items;
  }

  readonly filteredShelves = computed(() => {
    const q = this.filterQuery().toLowerCase().trim();
    if (!q) return this.shelves();
    return this.shelves().filter((sh) => this.shelfMatchesQuery(sh, q));
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredShelves().length / this.limit())),
  );

  readonly paginatedShelves = computed(() => {
    const start = (this.page() - 1) * this.limit();
    return this.filteredShelves().slice(start, start + this.limit());
  });

  /** Recursively check if a shelf or any of its children match the query */
  private shelfMatchesQuery(shelf: ShelfWithItems, q: string): boolean {
    // Match on shelf name or description
    if (shelf.locationCode.toLowerCase().includes(q)) return true;
    if (shelf.description && shelf.description.toLowerCase().includes(q)) return true;
    // Match on direct products
    if (shelf.shelfItems.some((i) => i.product.name.toLowerCase().includes(q))) return true;
    // Match recursively in children
    if (shelf.children) {
      return shelf.children.some((child) => this.shelfMatchesQuery(child, q));
    }
    return false;
  }

  constructor() {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((query) => {
        this.filterQuery.set(query);
        this.page.set(1);
      });
  }

  ngOnInit(): void {
    this.loadAll();
  }

  onFilterChange(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
    }
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
    }
  }

  onCreateShelf(): void {
    if (this.shelfForm.invalid) return;
    this.savingShelf.set(true);
    this.svc.createShelf(this.shelfForm.getRawValue()).subscribe({
      next: () => {
        this.notificationService.success('Estantería creada');
        this.shelfForm.reset();
        this.showCreateShelf.set(false);
        this.savingShelf.set(false);
        this.loadAll();
      },
      error: () => this.savingShelf.set(false),
    });
  }

  onDeleteShelf(shelf: ShelfWithItems): void {
    this.shelfToDelete.set(shelf);
  }

  confirmDeleteShelf(): void {
    const s = this.shelfToDelete();
    if (!s) return;
    this.deletingShelf.set(true);
    this.svc.deleteShelf(s.id).subscribe({
      next: () => {
        this.notificationService.success(`"${s.locationCode}" eliminada`);
        this.shelfToDelete.set(null);
        this.deletingShelf.set(false);
        this.loadAll();
      },
      error: () => this.deletingShelf.set(false),
    });
  }

  private loadAll(): void {
    this.loading.set(true);
    this.svc.getShelves().subscribe({
      next: (sh) => {
        this.shelves.set(sh);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.svc.getProducts().subscribe({
      next: (p) => this.productList.set(p),
    });
  }
}
