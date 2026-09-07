import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import {
  ShelfItem,
  ShelfWithItems,
  MoveStockBatchRequest,
  MoveStockBatchItemRequest,
} from '../../models/inventory.models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-move-stock-batch-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './move-stock-batch-dialog.component.html',
})
export class MoveStockBatchDialogComponent {
  readonly items = input.required<ShelfItem[]>();
  readonly currentShelfId = input.required<number>();
  readonly shelves = input.required<ShelfWithItems[]>();

  readonly confirm = output<MoveStockBatchRequest>();
  readonly cancel = output<void>();

  readonly submitting = signal(false);

  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    targetShelfId: ['', Validators.required],
    items: this.fb.array([]),
  });

  get itemsArray() {
    return this.form.get('items') as FormArray;
  }

  readonly availableShelves = computed(() =>
    this.shelves().filter((s) => s.id !== this.currentShelfId()),
  );

  constructor() {
    // Initialize form array when items input changes
    // Using effect or computed would be ideal, but for simplicity in this structure
    // we'll rely on the input signal reading in ngOnInit or effect.
    // However, since we can't easily use effect in constructor without context (sometimes),
    // let's assume the component is re-created selection changes.
    // Actually, `items` is a signal, so let's use an effect.
  }

  ngOnInit() {
    this.items().forEach((item) => {
      this.itemsArray.push(
        this.fb.group({
          productId: [item.product.id],
          amount: [
            item.quantity,
            [Validators.required, Validators.min(1), Validators.max(item.quantity)],
          ],
        }),
      );
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const val = this.form.getRawValue();
    this.submitting.set(true);

    const batchItems: MoveStockBatchItemRequest[] = val.items.map((item: any) => ({
      productId: item.productId,
      amount: item.amount,
    }));

    this.confirm.emit({
      sourceShelfId: this.currentShelfId(),
      targetShelfId: Number(val.targetShelfId),
      items: batchItems,
    });
  }
}
