import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { read, utils } from 'xlsx';
import { DatabaseService, Producto } from '../../services/database.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IconComponent],
  templateUrl: './stock.component.html',
  styleUrls: ['./stock.component.scss']
})
export class StockComponent implements OnInit, OnDestroy {
  productos: Producto[] = [];
  filtroGeneral = '';
  ordenCampo: 'codigo' | 'nombre' | 'categoria' | 'proveedor' | 'precio' | 'stock' = 'nombre';
  ordenAsc = true;
  categorias: string[] = [];
  categoriaFiltro: string = '';
  private sub?: Subscription;
  private subCategorias?: Subscription;
  productoDetalle: Producto | null = null;
  productoAEliminar: Producto | null = null;
  mostrarCargaExcel = false;
  archivoExcel: File | null = null;
  resumenCarga = '';
  ultimaImportacionIds: number[] = [];
  resumenValidaciones = '';

  showMassPrice = false;
  porcentaje = 0;
  seleccionados = new Set<number>();
  categoriaAumento = '';
  massActionMode: 'precio' | 'stock' = 'precio';
  cantidadStock = 0;
  codigosDuplicados: string[] = [];
  // Paginación
  page = 1;
  pageSize = 10;

  constructor(private db: DatabaseService, private toast: ToastService) {}

  ngOnInit(): void {
    this.sub = this.db.getProductos().subscribe(items => {
      this.productos = items;
    });
    this.subCategorias = this.db.getCategorias().subscribe(list => {
      this.categorias = list;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.subCategorias?.unsubscribe();
  }

  trackByProducto(_idx: number, p: Producto): number | string {
    return p.id || p.codigo;
  }

  setOrden(campo: 'codigo' | 'nombre' | 'categoria' | 'proveedor' | 'precio' | 'stock'): void {
    if (this.ordenCampo === campo) {
      this.ordenAsc = !this.ordenAsc;
    } else {
      this.ordenCampo = campo;
      this.ordenAsc = true;
    }
  }

  get productosVista(): Producto[] {
    const term = (this.filtroGeneral || '').toLowerCase();
    let arr = this.productos.filter(p =>
      p.codigo.toLowerCase().includes(term) ||
      p.nombre.toLowerCase().includes(term) ||
      p.categoria.toLowerCase().includes(term) ||
      (p.proveedor || '').toLowerCase().includes(term)
    );

    if (this.categoriaFiltro) {
      arr = arr.filter(p => p.categoria === this.categoriaFiltro);
    }

    arr = arr.sort((a, b) => {
      const campo = this.ordenCampo;
      let va: any = (a as any)[campo];
      let vb: any = (b as any)[campo];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      const comp = va < vb ? -1 : va > vb ? 1 : 0;
      return this.ordenAsc ? comp : -comp;
    });

    // Paginación
    const total = arr.length;
    const maxPage = Math.max(1, Math.ceil(total / this.pageSize));
    if (this.page > maxPage) this.page = maxPage;
    const start = (this.page - 1) * this.pageSize;
    return arr.slice(start, start + this.pageSize);
  }

  get totalFiltrados(): number {
    const term = (this.filtroGeneral || '').toLowerCase();
    let arr = this.productos.filter(p =>
      p.codigo.toLowerCase().includes(term) ||
      p.nombre.toLowerCase().includes(term) ||
      p.categoria.toLowerCase().includes(term) ||
      (p.proveedor || '').toLowerCase().includes(term)
    );
    if (this.categoriaFiltro) arr = arr.filter(p => p.categoria === this.categoriaFiltro);
    return arr.length;
  }

  setPageSize(size: number): void {
    this.pageSize = Math.max(10, Math.min(500, Math.trunc(size)));
    this.page = 1;
  }

  goToPage(p: number): void {
    const max = Math.max(1, Math.ceil(this.totalFiltrados / this.pageSize));
    this.page = Math.max(1, Math.min(max, Math.trunc(p)));
  }

  // Getters para plantilla (evitar usar Math.* en HTML)
  get paginaDesde(): number {
    if (this.totalFiltrados === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }
  get paginaHasta(): number {
    const fin = this.page * this.pageSize;
    return fin > this.totalFiltrados ? this.totalFiltrados : fin;
  }

  solicitarEliminar(p: Producto): void {
    this.productoAEliminar = p;
  }

  cancelarEliminar(): void {
    this.productoAEliminar = null;
  }

  confirmarEliminar(): void {
    const p = this.productoAEliminar;
    if (!p || !p.id) { this.productoAEliminar = null; return; }
    this.db.eliminarProducto(p.id);
    this.productoAEliminar = null;
    this.toast.show('Producto eliminado', 'info');
  }

  abrirCargaExcel(): void {
    this.mostrarCargaExcel = true;
    this.archivoExcel = null;
    this.resumenCarga = '';
  }

  cancelarCargaExcel(): void {
    this.mostrarCargaExcel = false;
    this.archivoExcel = null;
    this.resumenCarga = '';
  }

  onArchivoExcelSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    this.archivoExcel = files && files.length ? files[0] : null;
  }

  async procesarExcel(): Promise<void> {
    if (!this.archivoExcel) return;
    try {
      const buffer = await this.archivoExcel.arrayBuffer();
      const wb = read(new Uint8Array(buffer), { type: 'array' });
      const productosCreados: number[] = [];
      let procesados = 0;
      const codigosVistos = new Set<string>();
      const duplicados: string[] = [];
      const updatesStockBatch: Record<string, number> = {};
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const rows: any[] = utils.sheet_to_json(ws, { defval: '' });
        for (const row of rows) {
          procesados++;
          // Normalizar para detectar columna de stock (si existe en el archivo)
          const normalized: Record<string, any> = {};
          for (const [k, v] of Object.entries(row)) normalized[String(k).trim().toLowerCase()] = v;
          const stockRaw = Object.entries(normalized).find(([kk]) => kk.includes('stock'))?.[1];
          const stockNum = Number(String(stockRaw ?? '').toString().replace(/[^0-9.-]/g, '').replace(',', '.'));

          const p = this.mapRowToProducto(row);
          if (!p) continue;
          const codigo = (p.codigo || '').trim();
          if (codigosVistos.has(codigo)) { duplicados.push(codigo); continue; }
          if (codigo) codigosVistos.add(codigo);

          const existente = this.db.getProductoByCodigo(p.codigo);
          if (existente) {
            // No modificar stock existente; solo actualizar otros campos si cambian
            const actualizado = {
              ...existente,
              nombre: p.nombre,
              categoria: p.categoria,
              proveedor: p.proveedor,
              descripcion: p.descripcion,
              precio: p.precio,
              caracteristicas: {
                ...(existente.caracteristicas || {}),
                ...(p.caracteristicas || {})
              }
            } as Producto;
            this.db.actualizarProducto(actualizado);
            // Importante: NO agregar a updatesStockBatch
          } else {
            // Producto nuevo: permitir cargar stock inicial si viene en el Excel
            if (!isNaN(stockNum)) {
              p.stock = Math.max(0, Math.trunc(stockNum));
            }
            this.db.agregarProducto(p);
            if (p.id) productosCreados.push(p.id);
          }
        }
      }
      // Aplicar batch de stock al final para eficiencia
      const batchRes = this.db.actualizarStocksPorCodigoBatch(updatesStockBatch);
      this.ultimaImportacionIds = productosCreados;
      this.codigosDuplicados = Array.from(new Set(duplicados));
      const dupTxt = this.codigosDuplicados.length ? ` • Duplicados: ${this.codigosDuplicados.join(', ')}` : '';
      const unknownTxt = (batchRes.unknown && batchRes.unknown.length) ? ` • Códigos sin match: ${batchRes.unknown.slice(0,10).join(', ')}${batchRes.unknown.length>10?'...':''}` : '';
      this.resumenCarga = `Procesados: ${procesados}. Nuevos: ${productosCreados.length}. Stocks actualizados: ${batchRes.updated}.${dupTxt}${unknownTxt}`;
      this.resumenValidaciones = `${this.codigosDuplicados.length ? ('Duplicados: ' + this.codigosDuplicados.join(', ')) : ''} ${batchRes.unknown.length ? ('Códigos sin match: ' + batchRes.unknown.length + '.') : ''}`.trim();
      this.toast.show(`Procesados: ${procesados}. Nuevos: ${productosCreados.length}. Stocks: ${batchRes.updated}.${this.codigosDuplicados.length?(' Duplicados: '+this.codigosDuplicados.length+'.'):''}${batchRes.unknown.length?(' Sin match: '+batchRes.unknown.length+'.'):''}`, 'success');
      this.mostrarCargaExcel = false;
    } catch (e) {
      this.toast.show('No se pudo leer el Excel. Verificá el formato.', 'error');
    }
  }

  async eliminarSeleccionados(): Promise<void> {
    if (!this.seleccionados.size) return;
    const ok = await this.toast.confirm(`¿Eliminar ${this.seleccionados.size} producto(s) seleccionados?`, 'warning');
    if (!ok) { this.toast.show('Operación cancelada', 'info'); return; }
    const ids = Array.from(this.seleccionados.values());
    for (const id of ids) {
      this.db.eliminarProducto(id);
    }
    this.seleccionados.clear();
    this.toast.show(`Eliminados ${ids.length} producto(s).`, 'info');
  }

  deshacerUltimaImportacion(): void {
    if (!this.ultimaImportacionIds.length) return;
    let count = 0;
    for (const id of this.ultimaImportacionIds) {
      this.db.eliminarProducto(id);
      count++;
    }
    this.ultimaImportacionIds = [];
    this.toast.show(`Se deshizo la última importación. Eliminados ${count}.`, 'info');
  }

  private mapRowToProducto(row: any): Producto | null {
    const get = (keys: string[]): string => {
      const normalized: Record<string, any> = {};
      for (const [k, v] of Object.entries(row)) {
        normalized[String(k).trim().toLowerCase()] = v;
      }
      for (const k of keys) {
        const key = k.toLowerCase();
        const entry = Object.entries(normalized).find(([kk]) => kk.includes(key));
        if (entry) return String(entry[1] ?? '').trim();
      }
      return '';
    };

    const codigo = get(['codigo']);
    const nombre = get(['nombre']);
    const categoria = get(['categoria']);
    const costoStr = get(['precio de costo','costo']);
    const pctStr = get(['porcentaje ganancia','% ganancia','ganancia']);
    const proveedor = get(['proveedor']);
    const descripcion = get(['descripcion','descripción']);
    if (!codigo && !nombre) return null;
    const costo = Number(String(costoStr).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
    const pct = Number(String(pctStr).replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
    const precio = Number((costo * (1 + pct / 100)).toFixed(2));
    const producto: Producto = {
      codigo: codigo || nombre,
      nombre: nombre || codigo,
      descripcion: descripcion || '',
      precio: precio,
      stock: 0,
      stockMinimo: 0,
      categoria: categoria || 'Sin categoría',
      proveedor: proveedor || '',
      fechaCreacion: new Date(),
      caracteristicas: {
        ...(costo ? { precioCosto: String(costo) } : {}),
        ...(pct ? { gananciaPct: String(pct) } : {})
      }
    };
    return producto;
  }

  private toNumber(v: any, def: number = 0): number {
    const n = Number(String(v ?? '').toString().replace(/[^0-9.,-]/g, '').replace(',', '.'));
    return isNaN(n) ? def : n;
  }

  getCosto(p: Producto): number {
    const attrs = p.caracteristicas || {};
    const costoAttr = this.toNumber((attrs as any).precioCosto, NaN);
    if (!isNaN(costoAttr)) return costoAttr;
    const pct = this.toNumber((attrs as any).gananciaPct, NaN);
    if (!isNaN(pct) && pct > -100) {
      const costo = p.precio / (1 + pct / 100);
      return Number(costo.toFixed(2));
    }
    return p.precio; // fallback: sin datos, igual a precio
  }

  getGananciaPct(p: Producto): number {
    const attrs = p.caracteristicas || {};
    const pct = this.toNumber((attrs as any).gananciaPct, NaN);
    if (!isNaN(pct)) return Number(pct.toFixed(2));
    const costoAttr = this.toNumber((attrs as any).precioCosto, NaN);
    if (!isNaN(costoAttr) && costoAttr > 0) {
      const calc = ((p.precio - costoAttr) / costoAttr) * 100;
      return Number(calc.toFixed(2));
    }
    return 0;
  }

  verInfo(p: Producto): void {
    this.productoDetalle = p;
  }

  cerrarInfo(): void {
    this.productoDetalle = null;
  }

  toggleSeleccion(id?: number): void {
    if (!id) return;
    if (this.seleccionados.has(id)) this.seleccionados.delete(id); else this.seleccionados.add(id);
  }

  seleccionarTodosVista(): void {
    for (const p of this.productosVista) {
      if (p.id) this.seleccionados.add(p.id);
    }
  }

  limpiarSeleccion(): void {
    this.seleccionados.clear();
  }

  aplicarAumento(): void {
    const porSeleccion = this.seleccionados.size > 0;
    const porCategoria = !!this.categoriaAumento;

    if (this.massActionMode === 'precio') {
      const pct = Number(this.porcentaje);
      if (isNaN(pct)) { this.toast.show('Porcentaje inválido', 'error'); return; }
      const factor = 1 + (pct / 100);
      const afectadas: Producto[] = [];
      for (const p of this.productos) {
        const matchSel = porSeleccion && p.id ? this.seleccionados.has(p.id) : false;
        const matchCat = porCategoria ? p.categoria === this.categoriaAumento : false;
        const aplicar = (porSeleccion && matchSel) || (porCategoria && matchCat) || (!porSeleccion && !porCategoria);
        if (aplicar) {
          const nuevo = { ...p, precio: Number((p.precio * factor).toFixed(2)) };
          afectadas.push(nuevo);
        }
      }
      if (!afectadas.length) { this.toast.show('No hay productos que coincidan con la selección.', 'warning'); return; }
      for (const prod of afectadas) { this.db.actualizarProducto(prod); }
      this.toast.show(`Precios actualizados (${pct}% sobre ${afectadas.length} productos).`);
      this.showMassPrice = false;
      this.limpiarSeleccion();
      return;
    }

    const cant = Math.trunc(Number(this.cantidadStock));
    if (!isFinite(cant) || cant === 0) { this.toast.show('Ingresá una cantidad de stock válida (entero distinto de 0).', 'error'); return; }
    const afectadas: Producto[] = [];
    for (const p of this.productos) {
      const matchSel = porSeleccion && p.id ? this.seleccionados.has(p.id) : false;
      const matchCat = porCategoria ? p.categoria === this.categoriaAumento : false;
      const aplicar = (porSeleccion && matchSel) || (porCategoria && matchCat) || (!porSeleccion && !porCategoria);
      if (aplicar) {
        const nuevoStock = Math.max(0, (p.stock || 0) + cant);
        const nuevo = { ...p, stock: nuevoStock };
        afectadas.push(nuevo);
      }
    }
    if (!afectadas.length) { this.toast.show('No hay productos que coincidan con la selección.', 'warning'); return; }
    for (const prod of afectadas) { this.db.actualizarProducto(prod); }
    const scopeTxt = porSeleccion ? 'seleccionados' : (porCategoria ? `categoría "${this.categoriaAumento}"` : 'todos los productos filtrados');
    this.toast.show(`Stock actualizado (±${cant} en ${afectadas.length} productos, ${scopeTxt}).`);
    this.showMassPrice = false;
    this.limpiarSeleccion();
  }

  onStockChange(p: Producto, value: any): void {
    const raw = String(value ?? '');
    const num = Number(raw.replace(/[^0-9.-]/g, '').replace(',', '.'));
    const entero = Math.max(0, Math.trunc(isNaN(num) ? 0 : num));
    p.stock = entero;
  }

  onStockBlur(p: Producto): void {
    const val = Math.max(0, Math.trunc(Number(p.stock || 0)));
    if (p.stock !== val) p.stock = val;
    this.db.actualizarProducto(p);
  }
}