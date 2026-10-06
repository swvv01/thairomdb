import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { StatusMessageService } from './status-message.service';

describe('StatusMessageService', () => {
  let service: StatusMessageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [StatusMessageService]
    });
    service = TestBed.inject(StatusMessageService);
  });

  it('should auto-dismiss message after 5000ms by default', fakeAsync(() => {
    service.show('ทดสอบข้อความ', 'info');
    expect(service.message()).toEqual({ text: 'ทดสอบข้อความ', tone: 'info' });

    tick(4999);
    expect(service.message()).not.toBeNull();

    tick(1);
    expect(service.message()).toBeNull();
  }));

  it('should not auto-dismiss message when autoDismiss is false (boolean)', fakeAsync(() => {
    service.show('มีเวอร์ชันใหม่พร้อมใช้งาน', 'info', false);
    expect(service.message()).toEqual({ text: 'มีเวอร์ชันใหม่พร้อมใช้งาน', tone: 'info' });

    tick(10000);
    expect(service.message()).toEqual({ text: 'มีเวอร์ชันใหม่พร้อมใช้งาน', tone: 'info' });

    service.clear();
    expect(service.message()).toBeNull();
  }));

  it('should not auto-dismiss message when autoDismiss is false (options object)', fakeAsync(() => {
    service.show('ตัวอย่างในหน้า sample', 'success', { autoDismiss: false });
    expect(service.message()).toEqual({ text: 'ตัวอย่างในหน้า sample', tone: 'success' });

    tick(10000);
    expect(service.message()).toEqual({ text: 'ตัวอย่างในหน้า sample', tone: 'success' });

    service.clear();
    expect(service.message()).toBeNull();
  }));

  it('should clear timer when a new message is shown', fakeAsync(() => {
    service.show('ข้อความแรก', 'info');
    tick(3000);

    service.show('ข้อความที่สอง', 'error', false);
    expect(service.message()).toEqual({ text: 'ข้อความที่สอง', tone: 'error' });

    tick(3000);
    // original timer should have expired at 5000ms, but second message does not auto-dismiss
    expect(service.message()).toEqual({ text: 'ข้อความที่สอง', tone: 'error' });
  }));

  it('should support message action configuration', () => {
    const onClick = jasmine.createSpy('onClick');
    service.show('มีเวอร์ชันใหม่', 'info', {
      autoDismiss: false,
      action: { label: 'อัปเดต', onClick }
    });

    const current = service.message();
    expect(current?.text).toBe('มีเวอร์ชันใหม่');
    expect(current?.action?.label).toBe('อัปเดต');
    current?.action?.onClick?.();
    expect(onClick).toHaveBeenCalled();
  });
});
