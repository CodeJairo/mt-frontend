import { Injectable, inject, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Product,
  Category,
  ShelfWithItems,
  MoveStockRequest,
  MoveStockResponse,
  MoveStockBatchRequest,
  MoveStockBatchResponse,
  ConsolidationSuggestion,
  AddStockRequest,
  ConsolidateProductRequest,
  ShelfTotals,
  BreadcrumbItem,
  PaginatedResult,
} from '../models/inventory.models';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = isDevMode()
    ? 'http://localhost:3000/api'
    : 'https://mt-backend-production-71b2.up.railway.app/api';

  // ── Shelves ──

  /** Root shelves with nested children */
  getShelves(): Observable<ShelfWithItems[]> {
    return this.http.get<ShelfWithItems[]>(`${this.apiUrl}/shelves`);
  }

  getShelvesPaginated(
    page: number,
    limit: number,
    search?: string,
  ): Observable<PaginatedResult<ShelfWithItems>> {
    let url = `${this.apiUrl}/shelves?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return this.http.get<PaginatedResult<ShelfWithItems>>(url);
  }

  /** All shelves as flat list (for move-stock target selection) */
  getShelvesFlat(): Observable<ShelfWithItems[]> {
    return this.http.get<ShelfWithItems[]>(`${this.apiUrl}/shelves/flat`);
  }

  getShelvesFlatPaginated(
    page: number,
    limit: number,
    search?: string,
  ): Observable<PaginatedResult<ShelfWithItems>> {
    let url = `${this.apiUrl}/shelves/flat?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return this.http.get<PaginatedResult<ShelfWithItems>>(url);
  }

  getShelfDetail(id: number): Observable<ShelfWithItems> {
    return this.http.get<ShelfWithItems>(`${this.apiUrl}/shelves/${id}`);
  }

  getShelfChildren(id: number): Observable<ShelfWithItems[]> {
    return this.http.get<ShelfWithItems[]>(`${this.apiUrl}/shelves/${id}/children`);
  }

  getShelfTotals(id: number): Observable<ShelfTotals> {
    return this.http.get<ShelfTotals>(`${this.apiUrl}/shelves/${id}/totals`);
  }

  getShelfBreadcrumbs(id: number): Observable<BreadcrumbItem[]> {
    return this.http.get<BreadcrumbItem[]>(`${this.apiUrl}/shelves/${id}/breadcrumbs`);
  }

  createShelf(data: {
    locationCode: string;
    description?: string;
    parentId?: number;
  }): Observable<ShelfWithItems> {
    return this.http.post<ShelfWithItems>(`${this.apiUrl}/shelves`, data);
  }

  updateShelf(
    id: number,
    data: { locationCode?: string; description?: string },
  ): Observable<ShelfWithItems> {
    return this.http.patch<ShelfWithItems>(`${this.apiUrl}/shelves/${id}`, data);
  }

  deleteShelf(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/shelves/${id}`);
  }

  /** Delete shelf but move all its products (and descendants') to parent */
  deleteShelfAndReassign(id: number): Observable<{ message: string; movedItems: number }> {
    return this.http.delete<{ message: string; movedItems: number }>(
      `${this.apiUrl}/shelves/${id}/reassign`,
    );
  }

  // ── Products ──
  getProducts(categoryId?: number): Observable<Product[]> {
    let url = `${this.apiUrl}/products`;
    if (categoryId) url += `?categoryId=${categoryId}`;
    return this.http.get<Product[]>(url);
  }

  getProductsPaginated(
    page: number,
    limit: number,
    search?: string,
    categoryId?: number,
  ): Observable<PaginatedResult<Product>> {
    let url = `${this.apiUrl}/products?page=${page}&limit=${limit}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (categoryId) url += `&categoryId=${categoryId}`;
    return this.http.get<PaginatedResult<Product>>(url);
  }

  createProduct(data: {
    name: string;
    sku?: string;
    description?: string;
    price?: number | null;
    categoryIds?: number[];
  }): Observable<Product> {
    return this.http.post<Product>(`${this.apiUrl}/products`, data);
  }

  updateProduct(
    id: number,
    data: {
      name?: string;
      sku?: string;
      description?: string;
      price?: number | null;
      categoryIds?: number[];
    },
  ): Observable<Product> {
    return this.http.patch<Product>(`${this.apiUrl}/products/${id}`, data);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/products/${id}`);
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/products/${id}`);
  }

  // ── Inventory ──
  moveStock(request: MoveStockRequest): Observable<MoveStockResponse> {
    return this.http.post<MoveStockResponse>(`${this.apiUrl}/inventory/move`, request);
  }

  moveStockBatch(request: MoveStockBatchRequest): Observable<MoveStockBatchResponse> {
    return this.http.post<MoveStockBatchResponse>(`${this.apiUrl}/inventory/move-batch`, request);
  }

  addStock(request: AddStockRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/inventory/add-stock`, request);
  }

  updateStock(shelfItemId: number, newQuantity: number): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(`${this.apiUrl}/inventory/update-stock`, {
      shelfItemId,
      newQuantity,
    });
  }

  removeStock(shelfItemId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/inventory/remove-stock/${shelfItemId}`,
    );
  }

  getConsolidationSuggestions(): Observable<ConsolidationSuggestion[]> {
    return this.http.get<ConsolidationSuggestion[]>(
      `${this.apiUrl}/inventory/consolidation-suggestions`,
    );
  }

  consolidateProduct(request: ConsolidateProductRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/inventory/consolidate`, request);
  }

  // ── Categories ──
  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiUrl}/categories`);
  }

  createCategory(data: { name: string; description?: string }): Observable<Category> {
    return this.http.post<Category>(`${this.apiUrl}/categories`, data);
  }

  updateCategory(id: number, data: { name?: string; description?: string }): Observable<Category> {
    return this.http.patch<Category>(`${this.apiUrl}/categories/${id}`, data);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/categories/${id}`);
  }
}
