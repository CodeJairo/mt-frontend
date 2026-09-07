import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InventoryService } from '../../services/inventory.service';
import { ConsolidationSuggestion } from '../../models/inventory.models';

@Component({
  selector: 'app-optimization-alert',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (suggestions().length > 0) {
      <div class="collapse collapse-arrow bg-warning/5 border border-warning/20 rounded-lg mb-4">
        <input type="checkbox" />
        <div class="collapse-title py-2 px-3 min-h-0 flex items-center gap-2 sm:py-3 sm:px-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-warning shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span class="font-semibold text-xs sm:text-sm">Optimización de Stock</span>
          <span class="badge badge-warning badge-xs">{{ suggestions().length }}</span>
        </div>
        <div class="collapse-content px-3 sm:px-4">
          <div class="space-y-2 pb-1">
            @for (s of suggestions(); track s.productId) {
              <div
                class="bg-base-100 rounded-lg p-2.5 border border-base-300/30 hover:border-warning/50 hover:bg-warning/5 transition-all group"
              >
                <!-- Product header row -->
                <div class="flex items-center justify-between">
                  <p class="font-semibold text-xs sm:text-sm group-hover:text-warning transition-colors">
                    {{ s.productName }}
                    @if (s.sku) {
                      <span class="badge badge-xs badge-outline font-mono ml-1">{{ s.sku }}</span>
                    }
                  </p>
                  <a
                    [routerLink]="['/optimization', s.productId]"
                    class="btn btn-ghost btn-xs text-warning hover:bg-warning/10 font-bold uppercase tracking-tighter gap-1"
                    title="Ver optimización completa"
                  >
                    Optimizar
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>

                <!-- Summary line -->
                <p class="text-[11px] text-base-content/60 mt-0.5 sm:text-xs">
                  Repartido en {{ s.locations.length }} estantes —
                  <span class="font-bold text-warning">{{ s.totalQuantity }} total</span>
                </p>

                <!-- Shelf breakdown -->
                <div class="flex flex-wrap gap-1.5 mt-2">
                  @for (loc of s.locations; track loc.shelfId) {
                    <a
                      [routerLink]="['/shelf', loc.shelfId]"
                      class="inline-flex items-center gap-1 bg-base-300/40 hover:bg-warning/15 border border-base-300/50 hover:border-warning/40 rounded-md px-2 py-0.5 text-[11px] font-bold transition-all cursor-pointer group/shelf"
                      title="Ir a estantería {{ loc.locationCode }}"
                    >
                      <span class="w-1.5 h-1.5 rounded-full bg-warning/70 group-hover/shelf:bg-warning shrink-0"></span>
                      <span class="group-hover/shelf:text-warning transition-colors">{{ loc.locationCode }}</span>
                      <span class="text-base-content/40 font-mono">({{ loc.quantity }})</span>
                    </a>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class OptimizationAlertComponent implements OnInit {
  private readonly svc = inject(InventoryService);
  readonly suggestions = signal<ConsolidationSuggestion[]>([]);

  ngOnInit(): void {
    this.svc.getConsolidationSuggestions().subscribe({
      next: (data) => this.suggestions.set(data),
    });
  }
}
