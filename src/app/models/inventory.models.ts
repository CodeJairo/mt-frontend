export interface Category {
  id: number;
  name: string;
  description: string | null;
  _count?: {
    products: number;
  };
}

export interface Product {
  id: number;
  name: string;
  sku: string | null;
  description: string | null;
  /** Decimal values from the API can be serialized as strings. */
  price?: number | string | null;
  categories?: Category[];
  shelfItems?: {
    id: number;
    quantity: number;
    shelf: { id: number; locationCode: string };
  }[];
}

export interface Shelf {
  id: number;
  locationCode: string;
  description: string | null;
  parentId: number | null;
}

export interface ShelfItem {
  id: number;
  shelfId: number;
  productId: number;
  quantity: number;
  product: Product;
  shelf: Shelf;
}

export interface ShelfWithItems extends Shelf {
  shelfItems: ShelfItem[];
  children?: ShelfWithItems[];
  parent?: { id: number; locationCode: string } | null;
}

export interface ShelfTotals {
  totalProducts: number;
  totalUnits: number;
}

export interface BreadcrumbItem {
  id: number;
  locationCode: string;
}

export interface MoveStockRequest {
  productId: number;
  sourceShelfId: number;
  targetShelfId: number;
  amount: number;
}

export interface MoveStockResponse {
  message: string;
  moved: number;
  productId: number;
  sourceShelfId: number;
  targetShelfId: number;
}

export interface MoveStockBatchItemRequest {
  productId: number;
  amount: number;
}

export interface MoveStockBatchRequest {
  sourceShelfId: number;
  targetShelfId: number;
  items: MoveStockBatchItemRequest[];
}

export interface MoveStockBatchResponse {
  message: string;
  movedCount: number;
  items: { productId: number; amount: number }[];
  sourceShelfId: number;
  targetShelfId: number;
}

export interface ConsolidationSuggestion {
  productId: number;
  productName: string;
  sku: string | null;
  totalQuantity: number;
  locations: {
    shelfId: number;
    locationCode: string;
    quantity: number;
  }[];
  message: string;
}

export interface AddStockRequest {
  shelfId: number;
  productId: number;
  quantity: number;
}

export interface ConsolidateProductRequest {
  productId: number;
  targetShelfId: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
