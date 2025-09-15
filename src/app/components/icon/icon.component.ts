import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icon.component.html',
  styleUrls: ['./icon.component.scss']
})
export class IconComponent {
  @Input() name:
    | 'plus'
    | 'info'
    | 'box'
    | 'cart'
    | 'chart'
    | 'grid'
    | 'users'
    | 'archive'
    | 'package'
    | 'menu'
    | 'search'
    | 'calendar'
    | 'bar-chart'
    | 'pie-chart'
    | 'alert-triangle'
    | 'dollar-sign'
    | 'credit-card'
    | 'shopping-cart'
    | 'edit'
    | 'trash'
    | 'user'
    | 'download'
    | 'x' = 'info';
  @Input() size = 22;
  @Input() color?: string;
}

