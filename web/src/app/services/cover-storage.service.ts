import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Auth } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { RepositoryError } from '../repositories/repository-error';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CoverStorageService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  private readonly workerUrl = environment.r2?.workerUrl;

  async upload(patchId: string, blob: Blob, filename: string): Promise<string> {
    if (!patchId || blob.type !== 'image/png' || !filename.match(/^cover_max250px_[0-9]+\.png$/)) throw new RepositoryError('ไฟล์ปกไม่ถูกต้อง', 'create');
    
    if (!this.workerUrl) {
      throw new RepositoryError('ระบบอัปโหลดรูปภาพยังไม่ได้ตั้งค่า', 'create');
    }

    try {
      const user = this.auth.currentUser;
      if (!user) throw new RepositoryError('ต้องเข้าสู่ระบบก่อนอัปโหลด', 'create');
      const token = await user.getIdToken();

      const formData = new FormData();
      formData.append('file', blob, filename);
      formData.append('patchId', patchId);

      const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

      const res = await firstValueFrom(
        this.http.post<{ url: string }>(`${this.workerUrl}/upload`, formData, { headers })
      );
      
      if (!res?.url) throw new Error('No URL returned from worker');
      return res.url;
    } catch (e) {
      console.error('Upload failed:', e);
      throw new RepositoryError('ไม่สามารถอัปโหลดรูปปกได้', 'create');
    }
  }

  async remove(downloadUrl: string): Promise<void> {
    if (!downloadUrl) return;

    if (this.belongsToR2(downloadUrl)) {
      if (!this.workerUrl) return;

      try {
        const user = this.auth.currentUser;
        if (!user) throw new RepositoryError('ต้องเข้าสู่ระบบก่อนลบ', 'update');
        const token = await user.getIdToken();

        const cleanUrl = downloadUrl.split('?')[0];
        const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
        await firstValueFrom(
          this.http.delete(`${this.workerUrl}/delete`, { 
            headers,
            body: { url: cleanUrl } 
          })
        );
      } catch (e) {
        console.error('Delete from R2 failed:', e);
        throw new RepositoryError('ไม่สามารถลบรูปปกเก่าได้', 'update');
      }
    }
  }

  private belongsToR2(downloadUrl: string): boolean {
    try {
      const url = new URL(downloadUrl);
      const r2PublicUrl = environment.r2?.publicUrl;
      if (!r2PublicUrl) return false;
      
      const r2UrlObj = new URL(r2PublicUrl);
      return url.hostname === r2UrlObj.hostname;
    } catch {
      return false;
    }
  }
}
