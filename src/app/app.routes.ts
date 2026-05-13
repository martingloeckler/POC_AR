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
  {
    path: 'image-target-demo-8thwall',
    loadComponent: () =>
      import('./features/eighth-wall-demo/eighth-wall-demo').then(
        m => m.EighthWallDemoComponent,
      ),
  },
  {
    path: 'wichtel-animated-demo',
    loadComponent: () =>
      import('./features/wichtel-animated-demo/wichtel-animated-demo').then(
        m => m.WichtelAnimatedDemoComponent,
      ),
  },
  {
    path: 'world-tracking-demo',
    loadComponent: () =>
      import('./features/world-tracking-demo/world-tracking-demo').then(
        m => m.WorldTrackingDemoComponent,
      ),
  },
  {
    path: '8th-wall-demo',
    pathMatch: 'full',
    redirectTo: 'image-target-demo-8thwall',
  },
];
