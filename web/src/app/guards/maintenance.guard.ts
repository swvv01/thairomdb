import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SettingsRepository } from '../repositories/settings.repository';
import { StatusMessageService } from '../shared/status-message.service';

export const maintenanceGuard: CanActivateFn = async () => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true; // เมื่อออฟไลน์ อนุญาตให้อ่านข้อมูลจากแคชได้ทันที
  }

  const settingsRepo = inject(SettingsRepository);
  const authService = inject(AuthService);
  const router = inject(Router);
  const status = inject(StatusMessageService);

  const isMaintenanceMode = await settingsRepo.getMaintenanceMode();

  if (!isMaintenanceMode) {
    return true; // อนุญาตให้ผ่านถ้าไม่ได้เปิดโหมดปิดปรับปรุง
  }

  status.show('ระบบอยู่ในโหมดปิดปรับปรุง กำลังตรวจสอบสิทธิ์เข้าใช้งาน...');
  
  await authService.waitForAdminCheck();
  await authService.waitForVipCheck();
  
  status.clear();

  if (authService.isAdmin() || authService.isVip()) {
    return true; // Admin และ VIP เข้าได้
  }

  return router.parseUrl('/maintenance'); // ถ้าไม่มีสิทธิ์ให้ไปหน้าแจ้งเตือน
};
