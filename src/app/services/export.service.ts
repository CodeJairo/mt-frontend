import { Injectable, inject } from '@angular/core';
import { forkJoin } from 'rxjs';
import { InventoryService } from './inventory.service';
import { Product, ShelfWithItems } from '../models/inventory.models';

// Using dynamic imports or basic imports for jspdf
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private readonly svc = inject(InventoryService);

  // ── Global PDF ──
  exportGlobalInventoryPdf(): void {
    forkJoin({
      shelves: this.svc.getShelves(),
      products: this.svc.getProducts(),
    }).subscribe(({ products }) => {
      const doc = new jsPDF('landscape');
      this.addDocumentHeader(doc, 'Reporte Global de Inventario');

      const columns = ['SKU', 'PRODUCTO', 'ESTANTES', 'STOCK TOTAL', 'DETALLE DE UBICACIONES'];
      const rows: (string | number)[][] = [];

      let totalUnits = 0;

      // Sort products by total stock (descending)
      const sorted = [...products].sort((a, b) => {
        const stockA = a.shelfItems?.reduce((s, si) => s + si.quantity, 0) ?? 0;
        const stockB = b.shelfItems?.reduce((s, si) => s + si.quantity, 0) ?? 0;
        return stockB - stockA;
      });

      for (const p of sorted) {
        const items = p.shelfItems ?? [];
        const stock = items.reduce((s, si) => s + si.quantity, 0);
        totalUnits += stock;
        
        const detail = items
          .map((si) => `${si.shelf.locationCode} (${si.quantity})`)
          .join(', ');

        rows.push([
          p.sku || 'N/A',
          p.name,
          items.length,
          stock,
          detail || 'Sin stock',
        ]);
      }

      // Add a total row at the end
      rows.push(['', 'TOTAL GENERAL', '', totalUnits.toString(), '']);

      this.generateAutoTable(doc, columns, rows);

      const fileName = `MotoStock_Global_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
    });
  }

  // ── Category Specific PDF ──
  exportCategoryPdf(categoryId: number): void {
    forkJoin({
      categories: this.svc.getCategories(),
      products: this.svc.getProducts(categoryId),
    }).subscribe(({ categories, products }) => {
      const category = categories.find((c) => c.id === categoryId);
      const categoryName = category ? category.name : 'Categoría Desconocida';

      const doc = new jsPDF('landscape');
      this.addDocumentHeader(doc, `Reporte por Categoría: ${categoryName}`);

      const columns = ['SKU', 'PRODUCTO', 'ESTANTES', 'STOCK TOTAL', 'DETALLE DE UBICACIONES'];
      const rows: (string | number)[][] = [];
      let totalUnits = 0;

      const sorted = [...products].sort((a, b) => {
        const stockA = a.shelfItems?.reduce((s, si) => s + si.quantity, 0) ?? 0;
        const stockB = b.shelfItems?.reduce((s, si) => s + si.quantity, 0) ?? 0;
        return stockB - stockA;
      });

      for (const p of sorted) {
        const items = p.shelfItems ?? [];
        const stock = items.reduce((s, si) => s + si.quantity, 0);
        totalUnits += stock;
        const detail = items.map((si) => `${si.shelf.locationCode} (${si.quantity})`).join(', ');

        rows.push([
          p.sku || 'N/A',
          p.name,
          items.length,
          stock,
          detail || 'Sin stock',
        ]);
      }

      rows.push(['', 'TOTAL CATEGORÍA', '', totalUnits.toString(), '']);
      this.generateAutoTable(doc, columns, rows);

      const fileName = `MotoStock_${categoryName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
    });
  }

  // ── Specific Shelf PDF ──
  exportShelfPdf(shelfId: number): void {
    this.svc.getShelfDetail(shelfId).subscribe((shelf) => {
      const doc = new jsPDF('portrait');
      this.addDocumentHeader(doc, `Reporte de Ubicación: ${shelf.locationCode}`);

      // Optional subtitle for shelf description
      if (shelf.description) {
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(shelf.description.toUpperCase(), 14, 28);
      }

      const columns = ['RUTA EXACTA', 'SKU', 'PRODUCTO', 'CANTIDAD'];
      const rows: (string | number)[][] = [];
      let totalUnits = 0;

      // Helper to recursively get all items with their path
      const extractItems = (s: ShelfWithItems, path: string) => {
        const currentPath = path ? `${path} > ${s.locationCode}` : s.locationCode;
        
        for (const item of s.shelfItems) {
          rows.push([
            currentPath,
            item.product.sku || 'N/A',
            item.product.name,
            item.quantity,
          ]);
          totalUnits += item.quantity;
        }

        if (s.children) {
          for (const child of s.children) {
            extractItems(child as ShelfWithItems, currentPath);
          }
        }
      };

      extractItems(shelf, '');

      if (rows.length === 0) {
        rows.push(['-', '-', 'Estante Vacío', 0]);
      } else {
        rows.push(['', '', 'TOTAL', totalUnits]);
      }

      this.generateAutoTable(doc, columns, rows, 35); // Start table slightly lower to account for description

      const fileName = `MotoStock_${shelf.locationCode}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
    });
  }

  // ── PDF Helpers ──

  private addDocumentHeader(doc: jsPDF, subtitle: string): void {
    // MotoStock Racing Theme Colors
    doc.setFillColor(255, 102, 0); // Primary orange
    doc.rect(0, 0, doc.internal.pageSize.width, 4, 'F'); // Top accent bar

    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20); // Dark text
    doc.text('MOTOSTOCK', 14, 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('RACING INVENTORY', 68, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(subtitle, 14, 28);

    // Date right aligned
    const dateStr = new Date().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.setFontSize(9);
    doc.text(`Generado: ${dateStr}`, doc.internal.pageSize.width - 14, 20, { align: 'right' });
  }

  private generateAutoTable(doc: jsPDF, head: string[], body: (string | number)[][], startY: number = 35): void {
    autoTable(doc, {
      startY,
      head: [head],
      body: body,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 4,
        textColor: [40, 40, 40],
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [30, 30, 30], // Dark header matching "base-content/80"
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 248, 248], // Slight zebra striping
      },
      willDrawCell: (data) => {
        // Highlight TOTAL row
        if (data.row.raw && Array.isArray(data.row.raw) && (data.row.raw[1] === 'TOTAL GENERAL' || data.row.raw[2] === 'TOTAL')) {
          doc.setFillColor(255, 102, 0); // MotoStock Orange
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
        }
      }
    });
  }
}
