import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.HomeComponent),
  },
  {
    path: 'marker-demo',
    loadComponent: () => import('./features/marker-demo/marker-demo').then(m => m.MarkerDemoComponent),
  },
  {
    path: 'image-target-demo',
    loadComponent: () =>
      import('./features/image-target-demo/image-target-demo').then(
        m => m.ImageTargetDemoComponent,
      ),
  },
];
