import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DatabaseService, Producto } from '../../services/database.service';
import { ToastService } from '../../services/toast.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-producto-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './producto-form.component.html',
  styleUrls: ['./producto-form.component.scss']
})
export class ProductoFormComponent implements OnInit, OnDestroy {
  private db = inject(DatabaseService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  categorias: string[] = [];
  nuevaCategoriaNombre = '';

  codigo = '';
  nombre = '';
  categoria = '';
  precio: number | null = null;
  descripcion = '';
  stock: number | null = null;
  stockMinimo: number | null = 0;
  proveedor = '';

  caracteristicas: Array<{ clave: string; valor: string }> = [];
  private productosSub?: Subscription;
  private datosCargados = false;

  categoriaDropdownAbierto = false;
  mostrarNuevaCategoria = false;

  editId: number | null = null;

  constructor() {
    this.db.getCategorias().subscribe(cats => {
      this.categorias = cats;
    });
  }

  ngOnInit(): void {
    this.establecerIdDesdeRuta(this.route.snapshot.paramMap.get('id'));

    this.route.paramMap.subscribe(pm => {
      this.establecerIdDesdeRuta(pm.get('id'));
      if (this.editId) {
        this.intentarCargarProducto(this.editId);
      }
    });

    if (this.editId) {
      this.intentarCargarProducto(this.editId);
    }

    this.productosSub = this.db.getProductos().subscribe(() => {
      if (this.editId && !this.datosCargados) {
        this.intentarCargarProducto(this.editId);
      }
    });
  }

  ngOnDestroy(): void {
    this.productosSub?.unsubscribe();
  }

  private intentarCargarProducto(id: number): void {
    const p = this.db.getProductoById(id);
    if (!p) {
      this.toast.show('Producto no encontrado', 'warning');
      this.router.navigate(['/stock']);
      return;
    }
    this.datosCargados = true;
    this.codigo = p.codigo;
    this.nombre = p.nombre;
    this.categoria = p.categoria;
    this.precio = p.precio;
    this.descripcion = p.descripcion;
    this.stock = p.stock;
    this.stockMinimo = p.stockMinimo;
    this.proveedor = p.proveedor;
    if (p.caracteristicas) {
      this.caracteristicas = Object.entries(p.caracteristicas).map(([clave, valor]) => ({ clave, valor }));
    } else {
      this.caracteristicas = [];
    }
  }

  private establecerIdDesdeRuta(idParam: string | null): void {
    const parsed = idParam ? Number(idParam) : null;
    this.editId = parsed && !Number.isNaN(parsed) ? parsed : null;
  }

  agregarCaracteristica(): void {
    this.caracteristicas.push({ clave: '', valor: '' });
  }

  eliminarCaracteristica(index: number): void {
    this.caracteristicas.splice(index, 1);
  }

  agregarCategoria(): void {
    const nombre = (this.nuevaCategoriaNombre || '').trim();
    if (!nombre) return;
    this.db.agregarCategoria(nombre);
    this.categoria = nombre;
    this.nuevaCategoriaNombre = '';
    this.mostrarNuevaCategoria = false;
    this.categoriaDropdownAbierto = false;
  }

  eliminarCategoriaSeleccionada(): void {
    const nombre = (this.categoria || '').trim();
    if (!nombre) return;
    const ok = this.db.eliminarCategoria(nombre);
    if (!ok) {
      this.toast.show('No se puede eliminar: hay productos con esta categoría', 'warning');
      return;
    }
    this.toast.show('Categoría eliminada', 'info');
    if (this.categoria === nombre) {
      this.categoria = '';
    }
  }

  eliminarCategoria(nombre: string): void {
    const n = (nombre || '').trim();
    if (!n) return;
    const ok = this.db.eliminarCategoria(n);
    if (!ok) {
      this.toast.show('No se puede eliminar: está en uso', 'warning');
      return;
    }
    this.toast.show('Categoría eliminada', 'info');
    if (this.categoria === n) {
      this.categoria = '';
    }
  }

  seleccionarCategoria(nombre: string): void {
    this.categoria = nombre;
    this.categoriaDropdownAbierto = false;
  }

  toggleDropdownCategorias(): void {
    this.categoriaDropdownAbierto = !this.categoriaDropdownAbierto;
  }

  toggleNuevaCategoria(): void {
    this.mostrarNuevaCategoria = !this.mostrarNuevaCategoria;
    if (this.mostrarNuevaCategoria) {
      setTimeout(() => {
        const el = document.getElementById('inputNuevaCategoria');
        el?.focus();
      }, 0);
    }
  }

  guardar(): void {
    if (!this.codigo || !this.nombre || !this.categoria || this.precio == null) {
      this.toast.show('No se cargaron los datos obligatorios: código, nombre, categoría y precio.', 'error');
      return;
    }

    const mapCaracteristicas: Record<string, string> = {};
    for (const c of this.caracteristicas) {
      const k = (c.clave || '').trim();
      if (k) {
        mapCaracteristicas[k] = c.valor ?? '';
      }
    }

    const producto: Producto = {
      codigo: this.codigo.trim(),
      nombre: this.nombre.trim(),
      descripcion: this.descripcion.trim(),
      precio: Number(this.precio),
      stock: Number(this.stock || 0),
      stockMinimo: Number(this.stockMinimo || 0),
      categoria: this.categoria.trim(),
      proveedor: this.proveedor.trim(),
      fechaCreacion: new Date(),
      caracteristicas: Object.keys(mapCaracteristicas).length ? mapCaracteristicas : undefined
    };

    if (this.editId) {
      producto.id = this.editId;
      const original = this.db.getProductoById(this.editId);
      if (original?.fechaCreacion) {
        producto.fechaCreacion = original.fechaCreacion;
      }
      this.db.actualizarProducto(producto);
      this.toast.show('Producto actualizado', 'success');
    } else {
      this.db.agregarProducto(producto);
      this.toast.show('Producto agregado', 'success');
    }
    this.router.navigate(['/stock']);
  }

  cancelar(): void {
    this.router.navigate(['/stock']);
  }
}

