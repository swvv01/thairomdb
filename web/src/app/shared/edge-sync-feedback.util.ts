import { StatusMessageService } from './status-message.service';

export function showEdgeSyncFeedback(
  status: StatusMessageService,
  successMessage: string,
  edgeSynced: boolean
): void {
  if (edgeSynced) {
    status.show(successMessage, 'success');
  } else {
    status.show(`${successMessage} แต่ซิงค์ Edge ไม่สำเร็จ กรุณากดปุ่ม 'ซิงค์ข้อมูล Edge' ที่แถบเมนูด้านข้าง`, 'info');
  }
}
