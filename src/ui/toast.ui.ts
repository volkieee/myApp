export type ToastType = 'info' | 'success' | 'warning' | 'danger';

export class ToastUI {
  private static container: HTMLElement | null = null;

  public static show(title: string, message: string, type: ToastType = 'info', duration: number = 4000): void {
    if (!this.container) {
      this.container = document.getElementById('toastContainer');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toastContainer';
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
      }
    }

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'warning') icon = 'fa-triangle-exclamation';
    if (type === 'danger') icon = 'fa-circle-xmark';

    toast.innerHTML = `
      <div class="toast-icon"><i class="fa-solid ${icon}"></i></div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
      });
    }

    this.container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
      }
    }, duration);
  }
}
