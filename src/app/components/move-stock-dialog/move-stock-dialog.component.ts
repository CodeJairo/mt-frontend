import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ShelfItem, ShelfWithItems, MoveStockRequest } from '../../models/inventory.models';

@Component({
  selector: 'app-move-stock-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <dialog
      class="modal modal-open modal-bottom sm:modal-middle"
      role="dialog"
      aria-modal="true"
      aria-label="Mover Stock"
    >
      <div class="modal-box">
        <h3 class="text-base font-bold mb-1 sm:text-lg">Mover Stock</h3>
        <p class="text-sm text-base-content/60 mb-3">
          {{ item().product.name }}
          @if (item().product.sku) {
            <span class="badge badge-xs badge-outline font-mono ml-1">{{ item().product.sku }}</span>
          }
        </p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-3">
          <!-- Available -->
          <div class="flex items-center gap-2 bg-base-200 rounded-lg p-2.5 text-sm">
            <span class="text-base-content/60">Disponible:</span>
            <span class="font-bold text-primary">{{ item().quantity }} uds</span>
          </div>

          <!-- Target Shelf -->
          <div class="form-control w-full">
            <label class="label py-1" for="targetShelf">
              <span class="label-text text-sm font-medium">Estantería destino</span>
            </label>
            <select
              id="targetShelf"
              formControlName="targetShelfId"
              class="select select-bordered select-sm w-full sm:select-md"
            >
              <option value="" disabled>Selecciona estantería...</option>
              @for (shelf of availableShelves(); track shelf.id) {
                <option [value]="shelf.id">
                  {{ shelf.locationCode }} — {{ shelf.description }}
                </option>
              }
            </select>
          </div>

          <!-- Amount -->
          <div class="form-control w-full">
            <label class="label py-1" for="amount">
              <span class="label-text text-sm font-medium">Cantidad a mover</span>
            </label>
            <input
              id="amount"
              type="number"
              formControlName="amount"
              class="input input-bordered input-sm w-full sm:input-md"
              [attr.min]="1"
              [attr.max]="item().quantity"
              placeholder="Cantidad"
            />
            @if (form.controls.amount.touched && form.controls.amount.errors) {
              <label class="label py-0.5">
                <span class="label-text-alt text-error text-xs">
                  @if (form.controls.amount.errors['required']) {
                    Requerido
                  } @else if (form.controls.amount.errors['min']) {
                    Mínimo 1
                  } @else if (form.controls.amount.errors['max']) {
                    Máximo {{ item().quantity }}
                  }
                </span>
              </label>
            }
          </div>

          <!-- Actions -->
          <div class="modal-action mt-4">
            <button type="button" class="btn btn-ghost btn-sm" (click)="cancel.emit()">
              Cancelar
            </button>
            <button
              type="submit"
              class="btn btn-primary btn-sm"
              [disabled]="form.invalid || submitting()"
            >
              @if (submitting()) {
                <span class="loading loading-spinner loading-xs"></span>
              }
              Mover
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button (click)="cancel.emit()" title="Cerrar">close</button>
      </form>
    </dialog>
  `,
})
export class MoveStockDialogComponent {
  readonly item = input.required<ShelfItem>();
  readonly currentShelfId = input.required<number>();
  readonly shelves = input.required<ShelfWithItems[]>();

  readonly confirm = output<MoveStockRequest>();
  readonly cancel = output<void>();

  readonly submitting = signal(false);

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    targetShelfId: ['', Validators.required],
    amount: [1, [Validators.required, Validators.min(1)]],
  });

  readonly availableShelves = computed(() =>
    this.shelves().filter((s) => s.id !== this.currentShelfId()),
  );

  onSubmit(): void {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    this.submitting.set(true);
    this.confirm.emit({
      productId: this.item().productId,
      sourceShelfId: this.currentShelfId(),
      targetShelfId: Number(val.targetShelfId),
      amount: val.amount,
    });
  }
}
