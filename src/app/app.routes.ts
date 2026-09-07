import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./components/lock-screen/lock-screen.component').then(
        (m) => m.LockScreenComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/inventory-dashboard/inventory-dashboard.component').then(
        (m) => m.InventoryDashboardComponent,
      ),
  },
  {
    path: 'shelf/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/shelf-detail/shelf-detail.component').then(
        (m) => m.ShelfDetailComponent,
      ),
  },
  {
    path: 'product/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/product-detail/product-detail.component').then(
        (m) => m.ProductDetailComponent,
      ),
  },
  {
    path: 'optimization/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/optimization-detail/optimization-detail.component').then(
        (m) => m.OptimizationDetailComponent,
      ),
  },
  {
    path: 'products',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/product-manager/product-manager.component').then(
        (m) => m.ProductManagerComponent,
      ),
  },
  { path: '**', redirectTo: '' },
];
