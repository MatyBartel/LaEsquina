import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { VentasComponent } from './components/ventas/ventas.component';
import { StockComponent } from './components/stock/stock.component';
import { EstadisticasComponent } from './components/estadisticas/estadisticas.component';
import { ProveedoresComponent } from './components/proveedores/proveedores.component';
import { ProductoFormComponent } from './components/producto-form/producto-form.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'ventas', component: VentasComponent },
  { path: 'stock/editar/:id', component: ProductoFormComponent },
  { path: 'stock/agregar', component: ProductoFormComponent },
  { path: 'stock', component: StockComponent },
  { path: 'estadisticas', component: EstadisticasComponent },
  { path: 'proveedores', component: ProveedoresComponent },
  { path: '**', redirectTo: '' }
];
