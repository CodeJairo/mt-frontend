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
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { InventoryService } from '../../services/inventory.service';
import { NotificationService } from '../../services/notification.service';
import { ExportService } from '../../services/export.service';
import { Product, Category } from '../../models/inventory.models';

@Component({
  selector: 'app-product-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './product-manager.component.html',
})
export class ProductManagerComponent implements OnInit {
  private readonly svc = inject(InventoryService);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);
  private readonly exportService = inject(ExportService);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly deleting = signal(false);
  readonly showForm = signal(false);
  readonly searchTerm = signal('');
  readonly selectedCategoryId = signal<number | null>(null);
  private readonly searchSubject = new Subject<string>();

  // Category Management
  readonly showCategoryManager = signal(false);
  readonly showCategoryExport = signal(false);
  readonly categorySaving = signal(false);
  readonly categoryToEdit = signal<Category | null>(null);
  readonly categoryToDelete = signal<Category | null>(null);

  // Inline Category Creation
  readonly showInlineCategoryForm = signal(false);
  readonly inlineCategoryName = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly savingInlineCategory = signal(false);

  // Pagination State
  readonly page = signal(1);
  readonly limit = signal(20);
  readonly totalProducts = signal(0);
  readonly totalPages = signal(1);

  readonly sortBy = signal<'name_asc' | 'name_desc' | 'qty_desc' | 'qty_asc' | 'sku_asc'>(
    'name_asc',
  );
  readonly productToDelete = signal<Product | null>(null);
  readonly productToEdit = signal<Product | null>(null);
  readonly savingEdit = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    sku: [''],
    description: [''],
    price: [null as number | null, [Validators.min(0), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    categoryIds: [[] as number[]],
  });

  readonly editForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    sku: [''],
    description: [''],
    price: [null as number | null, [Validators.min(0), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    categoryIds: [[] as number[]],
  });

  readonly categoryForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  readonly filteredProducts = computed(() => {
    let result = this.products();

    const sort = this.sortBy();
    return [...result].sort((a, b) => {
      switch (sort) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'qty_desc':
          return this.getTotalStock(b) - this.getTotalStock(a);
        case 'qty_asc':
          return this.getTotalStock(a) - this.getTotalStock(b);
        case 'sku_asc':
          return (a.sku || '').localeCompare(b.sku || '');
        default:
          return 0;
      }
    });
  });

  constructor() {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((query) => {
        this.searchTerm.set(query);
        this.page.set(1);
        this.load();
        this.loadCategories();
      });
  }

  ngOnInit(): void {
    this.load();
    this.loadCategories();
  }

  onSearch(e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onCategoryFilterChange(e: Event): void {
    const val = (e.target as HTMLSelectElement).value;
    this.selectedCategoryId.set(val ? parseInt(val, 10) : null);
    this.page.set(1);
    this.load();
  }

  // ── Category Management ──
  loadCategories(): void {
    this.svc.getCategories().subscribe((cats) => this.categories.set(cats));
  }

  createInlineCategory(isEdit: boolean): void {
    if (this.inlineCategoryName.invalid) return;
    this.savingInlineCategory.set(true);
    this.svc.createCategory({ name: this.inlineCategoryName.value }).subscribe({
      next: (newCat) => {
        this.notificationService.success(`Categoría "${newCat.name}" creada`);
        
        // Add to local list immediately and sort
        this.categories.update((cats) =>
          [...cats, newCat].sort((a, b) => a.name.localeCompare(b.name)),
        );

        // Auto-select
        const form = isEdit ? this.editForm : this.form;
        const current = form.get('categoryIds')?.value || [];
        form.get('categoryIds')?.setValue([...current, newCat.id]);

        this.inlineCategoryName.reset();
        this.showInlineCategoryForm.set(false);
        this.savingInlineCategory.set(false);
      },
      error: () => this.savingInlineCategory.set(false),
    });
  }

  onSaveCategory(): void {
    if (this.categoryForm.invalid) return;
    this.categorySaving.set(true);
    const data = this.categoryForm.getRawValue();
    const edit = this.categoryToEdit();

    const obs = edit
      ? this.svc.updateCategory(edit.id, data)
      : this.svc.createCategory(data);

    obs.subscribe({
      next: () => {
        this.notificationService.success(edit ? 'Categoría actualizada' : 'Categoría creada');
        this.categoryForm.reset();
        this.categoryToEdit.set(null);
        this.categorySaving.set(false);
        this.loadCategories();
        this.load();
      },
      error: () => this.categorySaving.set(false),
    });
  }

  editCategory(c: Category): void {
    this.categoryToEdit.set(c);
    this.categoryForm.patchValue({
      name: c.name,
      description: c.description ?? '',
    });
  }

  deleteCategory(c: Category): void {
    this.categoryToDelete.set(c);
  }

  confirmDeleteCategory(): void {
    const c = this.categoryToDelete();
    if (!c) return;
    this.svc.deleteCategory(c.id).subscribe({
      next: () => {
        this.notificationService.success(`Categoría "${c.name}" eliminada`);
        this.categoryToDelete.set(null);
        this.loadCategories();
        this.load();
      },
    });
  }

  exportByCategory(id: number): void {
    this.exportService.exportCategoryPdf(id);
    this.showCategoryExport.set(false);
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.load();
    }
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.load();
    }
  }

  getTotalStock(p: Product): number {
    return p.shelfItems?.reduce((s, si) => s + si.quantity, 0) ?? 0;
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

  onCreate(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.svc.createProduct(this.form.getRawValue()).subscribe({
      next: () => {
        this.notificationService.success('Producto creado');
        this.form.reset();
        this.showForm.set(false);
        this.showInlineCategoryForm.set(false);
        this.inlineCategoryName.reset();
        this.saving.set(false);
        this.load();
        this.loadCategories();
      },
      error: () => this.saving.set(false),
    });
  }

  onEdit(p: Product): void {
    this.showInlineCategoryForm.set(false);
    this.inlineCategoryName.reset();
    this.editForm.patchValue({
      name: p.name,
      sku: p.sku ?? '',
      description: p.description ?? '',
      price: p.price == null ? null : Number(p.price),
      categoryIds: p.categories?.map((c) => c.id) || [],
    });
    this.productToEdit.set(p);
  }

  onSaveEdit(): void {
    const p = this.productToEdit();
    if (!p || this.editForm.invalid) return;
    this.savingEdit.set(true);
    this.svc.updateProduct(p.id, this.editForm.getRawValue()).subscribe({
      next: () => {
        this.notificationService.success('Producto actualizado');
        this.productToEdit.set(null);
        this.showInlineCategoryForm.set(false);
        this.inlineCategoryName.reset();
        this.savingEdit.set(false);
        this.load();
        this.loadCategories();
      },
      error: () => this.savingEdit.set(false),
    });
  }

  toggleCategory(isEdit: boolean, categoryId: number): void {
    const form = isEdit ? this.editForm : this.form;
    const control = form.get('categoryIds');
    if (!control) return;

    const current = control.value as number[];
    if (current.includes(categoryId)) {
      control.setValue(current.filter((id) => id !== categoryId));
    } else {
      control.setValue([...current, categoryId]);
    }
  }

  isCategorySelected(isEdit: boolean, categoryId: number): boolean {
    const form = isEdit ? this.editForm : this.form;
    return form.get('categoryIds')?.value?.includes(categoryId) ?? false;
  }

  onDelete(p: Product): void {
    this.productToDelete.set(p);
  }

  confirmDelete(): void {
    const p = this.productToDelete();
    if (!p) return;
    this.deleting.set(true);
    this.svc.deleteProduct(p.id).subscribe({
      next: () => {
        this.notificationService.success(`"${p.name}" eliminado`);
        this.productToDelete.set(null);
        this.deleting.set(false);
        this.load();
        this.loadCategories();
      },
      error: () => this.deleting.set(false),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.svc
      .getProductsPaginated(
        this.page(),
        this.limit(),
        this.searchTerm(),
        this.selectedCategoryId() || undefined,
      )
      .subscribe({
        next: (res) => {
          this.products.set(res.data);
          this.totalProducts.set(res.meta.total);
          this.totalPages.set(res.meta.totalPages);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
