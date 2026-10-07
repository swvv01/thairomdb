import { Routes } from '@angular/router';

import { AdminPatchPageComponent } from './pages/admin-patch-page.component';
import { BrowsePageComponent } from './pages/browse-page.component';
import { adminGuard } from './guards/admin.guard';
import { maintenanceGuard } from './guards/maintenance.guard';
import { AdminRedirectComponent } from './pages/admin-redirect.component';
import { LogoutPageComponent } from './pages/logout-page.component';
import { AdminSystemsPageComponent } from './pages/admin-systems-page.component';
import { AdminTranslatorsPageComponent } from './pages/admin-translators-page.component';
import { AdminTagsPageComponent } from './pages/admin-tags-page.component';
import { AdminFirestoreDataPageComponent } from './pages/admin-firestore-data-page.component';
import { DonatePageComponent } from './pages/donate-page.component';
import { AdminServerCostPageComponent } from './pages/admin-server-cost-page.component';
import { ArticlesPageComponent } from './pages/articles-page.component';
import { ArticlePageComponent } from './pages/article-page.component';
import { AdminArticlesPageComponent } from './pages/admin-articles-page.component';
import { AdminSidebarLinksPageComponent } from './pages/admin-sidebar-links-page.component';
import { AdminSamplePageComponent } from './pages/admin-sample-page.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: BrowsePageComponent,
    canActivate: [maintenanceGuard]
  },
  { path: 'page', component: BrowsePageComponent, data: { pageMode: true }, canActivate: [maintenanceGuard] },
  { path: 'today', component: BrowsePageComponent, data: { browseKind: 'today' }, canActivate: [maintenanceGuard] },
  { path: 'new', component: BrowsePageComponent, data: { browseKind: 'week' }, canActivate: [maintenanceGuard] },
  { path: 'system', component: BrowsePageComponent, data: { browseKind: 'system' }, canActivate: [maintenanceGuard] },
  { path: 'translator', component: BrowsePageComponent, data: { browseKind: 'translator' }, canActivate: [maintenanceGuard] },
  { path: 'system/:slug', component: BrowsePageComponent, data: { browseKind: 'system', legacyBrowseRoute: true }, canActivate: [maintenanceGuard] },
  { path: 'translator/:slug', component: BrowsePageComponent, data: { browseKind: 'translator', legacyBrowseRoute: true }, canActivate: [maintenanceGuard] },
  { path: 'tag/:slug', component: BrowsePageComponent, data: { browseKind: 'tag' }, canActivate: [maintenanceGuard] },
  { path: 'rom', component: BrowsePageComponent, data: { browseKind: 'rom' }, canActivate: [maintenanceGuard] },
  { path: 'port', component: BrowsePageComponent, data: { browseKind: 'port' }, canActivate: [maintenanceGuard] },
  { path: 'walkthrough', component: BrowsePageComponent, data: { browseKind: 'walkthrough' }, canActivate: [maintenanceGuard] },
  { path: 'guide', redirectTo: 'walkthrough', pathMatch: 'full' },
  { path: 'library', component: BrowsePageComponent, data: { browseKind: 'library' }, canActivate: [maintenanceGuard] },
  { path: 'maintenance', loadComponent: () => import('./pages/maintenance-page.component').then(m => m.MaintenancePageComponent) },
  { path: 'donate', component: DonatePageComponent },
  { path: 'donations', loadComponent: () => import('./pages/donations-page.component').then(m => m.DonationsPageComponent) },
  { path: 'articles', component: ArticlesPageComponent },
  { path: 'article/:slug', component: ArticlePageComponent, data: { includeDrafts: false, backLink: true } },
  { path: 'other/:slug', component: ArticlePageComponent, data: { includeDrafts: true, backLink: false } },
  { 
    path: 'redeem', 
    loadComponent: () => import('./pages/redeem-page.component').then(m => m.RedeemPageComponent)
  },
  { 
    path: 'admin/manage-redeem', 
    loadComponent: () => import('./pages/admin-manage-redeem-page.component').then(m => m.AdminManageRedeemPageComponent), 
    canActivate: [adminGuard] 
  },
  { path: 'admin/articles', component: AdminArticlesPageComponent, canActivate: [adminGuard] },
  { path: 'admin/sidebar-links', component: AdminSidebarLinksPageComponent, canActivate: [adminGuard] },
  { path: 'admin/sample', component: AdminSamplePageComponent, canActivate: [adminGuard] },
  { path: 'admin/articles/edit/new', component: AdminArticlesPageComponent, canActivate: [adminGuard] },
  { path: 'admin/articles/edit/:id', component: AdminArticlesPageComponent, canActivate: [adminGuard] },
  { path: 'admin/server-cost', component: AdminServerCostPageComponent, canActivate: [adminGuard] },
  { path: 'admin/maintenance', loadComponent: () => import('./pages/admin-maintenance-page.component').then(m => m.AdminMaintenancePageComponent), canActivate: [adminGuard] },
  {
    path: 'add',
    component: AdminPatchPageComponent,
    canDeactivate: [(component: AdminPatchPageComponent) => component.canDeactivate()]
  },
  {
    path: 'add/:id',
    component: AdminPatchPageComponent,
    canDeactivate: [(component: AdminPatchPageComponent) => component.canDeactivate()]
  },
  {
    path: 'admin/systems',
    component: AdminSystemsPageComponent,
    canActivate: [adminGuard]
  },
  { path: 'admin/translators', component: AdminTranslatorsPageComponent, canActivate: [adminGuard] },
  { path: 'admin/tags', component: AdminTagsPageComponent, canActivate: [adminGuard] },
  { path: 'admin/firestore-data', component: AdminFirestoreDataPageComponent, canActivate: [adminGuard] },
  {
    path: 'login',
    pathMatch: 'full',
    component: AdminRedirectComponent
  },
  {
    path: 'logout',
    pathMatch: 'full',
    component: LogoutPageComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];
