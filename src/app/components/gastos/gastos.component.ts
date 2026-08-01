import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DatabaseService, Gasto } from '../../services/database.service';
import { ToastService } from '../../services/toast.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './gastos.component.html',
  styleUrls: ['./gastos.component.scss']
})
export class GastosComponent implements OnInit, OnDestroy {
  db = inject(DatabaseService);
  private toast = inject(ToastService);

  readonly meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  gastos: Gasto[] = [];
  categoriasGasto: string[] = [];
  anio = new Date().getFullYear();
  mes = new Date().getMonth();
  diaFiltro: string | null = null;
  busqueda = '';

  mostrarFormulario = false;
  mostrarModalCategorias = false;
  editId: number | null = null;
  nuevaCategoriaNombre = '';

  form = {
    fecha: this.fechaHoyInput(),
    descripcion: '',
    categoria: '',
    monto: null as number | null,
  };

  page = 1;
  pageSize = 5;

  private sub?: Subscription;
  private subCats?: Subscription;

  ngOnInit(): void {
    this.sub = this.db.getGastos().subscribe(() => this.refrescarVista());
    this.subCats = this.db.getCategoriasGasto().subscribe(cats => {
      this.categoriasGasto = cats;
    });
    this.refrescarVista();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.subCats?.unsubscribe();
  }

  get aniosDisponibles(): number[] {
    const actual = new Date().getFullYear();
    const years = new Set<number>([actual - 2, actual - 1, actual, actual + 1]);
    for (const g of this.db.getGastosActuales()) {
      years.add(new Date(g.fecha).getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }

  get etiquetaMes(): string {
    return `${this.meses[this.mes]} ${this.anio}`;
  }

  get gastosFiltrados(): Gasto[] {
    const { inicio, fin } = this.db.getInicioFinMes(this.anio, this.mes);
    let lista = this.db.getGastosEnRango(inicio, fin);

    if (this.diaFiltro) {
      const [y, m, d] = this.diaFiltro.split('-').map(Number);
      const dia = this.db.getInicioFinDia(y, m - 1, d);
      lista = this.db.getGastosEnRango(dia.inicio, dia.fin);
    }

    const term = (this.busqueda || '').trim().toLowerCase();
    if (term) {
      lista = lista.filter(g =>
        g.descripcion.toLowerCase().includes(term) ||
        g.categoria.toLowerCase().includes(term)
      );
    }

    return lista
      .slice()
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  get totalMes(): number {
    const { inicio, fin } = this.db.getInicioFinMes(this.anio, this.mes);
    return this.db.getTotalGastosEnRango(inicio, fin);
  }

  get totalDia(): number {
    if (!this.diaFiltro) return 0;
    const [y, m, d] = this.diaFiltro.split('-').map(Number);
    const dia = this.db.getInicioFinDia(y, m - 1, d);
    return this.db.getTotalGastosEnRango(dia.inicio, dia.fin);
  }

  get categoriasParaSelect(): string[] {
    const actual = (this.form.categoria || '').trim();
    if (!actual) return this.categoriasGasto;
    const existe = this.categoriasGasto.some(c => c.toLowerCase() === actual.toLowerCase());
    return existe ? this.categoriasGasto : [actual, ...this.categoriasGasto];
  }

  get gastosPaginados(): Gasto[] {
    const arr = this.gastosFiltrados;
    const total = arr.length;
    const maxPage = Math.max(1, Math.ceil(total / this.pageSize));
    if (this.page > maxPage) this.page = maxPage;
    const start = (this.page - 1) * this.pageSize;
    return arr.slice(start, start + this.pageSize);
  }

  get totalGastosFiltrados(): number {
    return this.gastosFiltrados.length;
  }

  get paginaDesde(): number {
    if (this.totalGastosFiltrados === 0) return 0;
    return (this.page - 1) * this.pageSize + 1;
  }

  get paginaHasta(): number {
    const fin = this.page * this.pageSize;
    return fin > this.totalGastosFiltrados ? this.totalGastosFiltrados : fin;
  }

  goToPage(p: number): void {
    const max = Math.max(1, Math.ceil(this.totalGastosFiltrados / this.pageSize));
    this.page = Math.max(1, Math.min(max, Math.trunc(p)));
  }

  private refrescarVista(): void {
    this.gastos = this.gastosFiltrados;
    this.page = 1;
  }

  private fechaHoyInput(): string {
    const h = new Date();
    return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
  }

  mesAnterior(): void {
    if (this.mes === 0) {
      this.mes = 11;
      this.anio--;
    } else {
      this.mes--;
    }
    this.page = 1;
    this.refrescarVista();
  }

  mesSiguiente(): void {
    if (this.mes === 11) {
      this.mes = 0;
      this.anio++;
    } else {
      this.mes++;
    }
    this.page = 1;
    this.refrescarVista();
  }

  onMesChange(val: string): void {
    this.mes = Number(val);
    this.page = 1;
    this.refrescarVista();
  }

  onAnioChange(val: string): void {
    this.anio = Number(val);
    this.page = 1;
    this.refrescarVista();
  }

  onDiaFiltroChange(val: string): void {
    this.diaFiltro = val || null;
    if (this.diaFiltro) {
      const [y, m] = this.diaFiltro.split('-').map(Number);
      this.anio = y;
      this.mes = m - 1;
    }
    this.page = 1;
    this.refrescarVista();
  }

  limpiarDiaFiltro(): void {
    this.diaFiltro = null;
    this.page = 1;
    this.refrescarVista();
  }

  onBusquedaChange(): void {
    this.page = 1;
    this.refrescarVista();
  }

  abrirNuevo(): void {
    this.editId = null;
    this.form = {
      fecha: this.diaFiltro || this.fechaHoyInput(),
      descripcion: '',
      categoria: '',
      monto: null,
    };
    this.mostrarFormulario = true;
  }

  abrirEditar(g: Gasto): void {
    const f = new Date(g.fecha);
    this.editId = g.id ?? null;
    this.form = {
      fecha: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`,
      descripcion: g.descripcion,
      categoria: g.categoria,
      monto: g.monto,
    };
    this.mostrarFormulario = true;
  }

  cerrarFormulario(): void {
    this.mostrarFormulario = false;
    this.editId = null;
  }

  guardarGasto(): void {
    if (!this.form.descripcion.trim()) {
      this.toast.show('Ingresá una descripción.', 'error');
      return;
    }
    if (!this.form.categoria.trim()) {
      this.toast.show('Seleccioná una categoría.', 'error');
      return;
    }
    if (this.form.monto == null || this.form.monto <= 0) {
      this.toast.show('Ingresá un monto válido.', 'error');
      return;
    }

    const [y, m, d] = this.form.fecha.split('-').map(Number);
    const gasto: Gasto = {
      descripcion: this.form.descripcion.trim(),
      categoria: this.form.categoria.trim(),
      monto: Number(this.form.monto),
      fecha: new Date(y, m - 1, d, 12, 0, 0, 0),
    };

    if (this.editId) {
      gasto.id = this.editId;
      this.db.actualizarGasto(gasto);
      this.toast.show('Gasto actualizado', 'success');
    } else {
      this.db.agregarGasto(gasto);
      this.toast.show('Gasto registrado', 'success');
    }

    const fechaGasto = gasto.fecha;
    this.anio = fechaGasto.getFullYear();
    this.mes = fechaGasto.getMonth();
    this.cerrarFormulario();
    this.refrescarVista();
  }

  async eliminarGasto(g: Gasto): Promise<void> {
    if (!g.id) return;
    const ok = await this.toast.confirm(`¿Eliminar el gasto "${g.descripcion}"?`, 'warning');
    if (!ok) return;
    this.db.eliminarGasto(g.id);
    this.toast.show('Gasto eliminado', 'info');
    this.refrescarVista();
  }

  abrirModalCategorias(): void {
    this.nuevaCategoriaNombre = '';
    this.mostrarModalCategorias = true;
  }

  cerrarModalCategorias(): void {
    this.mostrarModalCategorias = false;
  }

  agregarCategoriaDesdeModal(): void {
    const nombre = (this.nuevaCategoriaNombre || '').trim();
    if (!nombre) return;
    this.db.agregarCategoriaGasto(nombre);
    this.form.categoria = nombre;
    this.nuevaCategoriaNombre = '';
    this.toast.show('Categoría agregada', 'success');
  }

  async eliminarCategoriaDesdeModal(nombre: string): Promise<void> {
    const n = (nombre || '').trim();
    if (!n) return;
    const cantidad = this.db.countGastosPorCategoria(n);
    const mensaje = cantidad > 0
      ? `¿Eliminar la categoría "${n}"?\n\nHay ${cantidad} gasto(s) con esta categoría. No se borrarán: solo se quita de la lista.`
      : `¿Eliminar la categoría "${n}"?`;
    const ok = await this.toast.confirm(mensaje, 'warning');
    if (!ok) return;
    this.db.eliminarCategoriaGasto(n);
    if (this.form.categoria.toLowerCase() === n.toLowerCase()) {
      this.form.categoria = '';
    }
    this.toast.show('Categoría eliminada', 'info');
  }
}
