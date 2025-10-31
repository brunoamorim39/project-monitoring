// Project Monitoring Feedback Widget

interface WidgetConfig {
  apiKey: string;
  apiUrl?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme?: 'light' | 'dark';
}

interface FeedbackData {
  type: 'bug' | 'feature' | 'question';
  title: string;
  description?: string;
  user?: {
    email?: string;
    name?: string;
  };
}

class MonitorWidget {
  private config: WidgetConfig;
  private isOpen: boolean = false;
  private button: HTMLElement | null = null;
  private modal: HTMLElement | null = null;

  constructor(config: WidgetConfig) {
    this.config = {
      apiUrl: 'https://your-worker-url.workers.dev',
      position: 'bottom-right',
      theme: 'light',
      ...config,
    };

    this.init();
  }

  private init() {
    this.injectStyles();
    this.createButton();
    this.createModal();
  }

  private injectStyles() {
    const styles = `
      .pm-widget-button {
        position: fixed;
        z-index: 9998;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .pm-widget-button:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }
      .pm-widget-button.pm-bottom-right {
        bottom: 20px;
        right: 20px;
      }
      .pm-widget-button.pm-bottom-left {
        bottom: 20px;
        left: 20px;
      }
      .pm-widget-button.pm-top-right {
        top: 20px;
        right: 20px;
      }
      .pm-widget-button.pm-top-left {
        top: 20px;
        left: 20px;
      }
      .pm-widget-modal {
        position: fixed;
        z-index: 9999;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.2s;
      }
      .pm-widget-modal.pm-open {
        display: flex;
      }
      .pm-widget-content {
        background: white;
        border-radius: 12px;
        width: 90%;
        max-width: 500px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s;
      }
      .pm-widget-header {
        padding: 20px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .pm-widget-header h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #111827;
      }
      .pm-widget-close {
        background: none;
        border: none;
        font-size: 24px;
        color: #6b7280;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: background 0.2s;
      }
      .pm-widget-close:hover {
        background: #f3f4f6;
      }
      .pm-widget-body {
        padding: 20px;
      }
      .pm-widget-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .pm-widget-form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .pm-widget-label {
        font-size: 14px;
        font-weight: 500;
        color: #374151;
      }
      .pm-widget-input,
      .pm-widget-select,
      .pm-widget-textarea {
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        font-family: inherit;
        transition: border-color 0.2s;
      }
      .pm-widget-input:focus,
      .pm-widget-select:focus,
      .pm-widget-textarea:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }
      .pm-widget-textarea {
        resize: vertical;
        min-height: 100px;
      }
      .pm-widget-submit {
        padding: 12px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .pm-widget-submit:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }
      .pm-widget-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }
      .pm-widget-success {
        padding: 12px;
        background: #d1fae5;
        color: #065f46;
        border-radius: 6px;
        font-size: 14px;
        text-align: center;
      }
      .pm-widget-error {
        padding: 12px;
        background: #fee2e2;
        color: #991b1b;
        border-radius: 6px;
        font-size: 14px;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  private createButton() {
    this.button = document.createElement('button');
    this.button.className = `pm-widget-button pm-${this.config.position}`;
    this.button.innerHTML = '💬';
    this.button.onclick = () => this.open();
    document.body.appendChild(this.button);
  }

  private createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'pm-widget-modal';
    this.modal.innerHTML = `
      <div class="pm-widget-content">
        <div class="pm-widget-header">
          <h3>Send Feedback</h3>
          <button class="pm-widget-close" type="button">&times;</button>
        </div>
        <div class="pm-widget-body">
          <form class="pm-widget-form">
            <div class="pm-widget-form-group">
              <label class="pm-widget-label">Type</label>
              <select name="type" class="pm-widget-select" required>
                <option value="bug">Bug Report</option>
                <option value="feature">Feature Request</option>
                <option value="question">Question</option>
              </select>
            </div>
            <div class="pm-widget-form-group">
              <label class="pm-widget-label">Title *</label>
              <input name="title" type="text" class="pm-widget-input" placeholder="Brief description" required />
            </div>
            <div class="pm-widget-form-group">
              <label class="pm-widget-label">Description</label>
              <textarea name="description" class="pm-widget-textarea" placeholder="Provide more details..."></textarea>
            </div>
            <div class="pm-widget-form-group">
              <label class="pm-widget-label">Your Name (optional)</label>
              <input name="name" type="text" class="pm-widget-input" placeholder="John Doe" />
            </div>
            <div class="pm-widget-form-group">
              <label class="pm-widget-label">Your Email (optional)</label>
              <input name="email" type="email" class="pm-widget-input" placeholder="john@example.com" />
            </div>
            <button type="submit" class="pm-widget-submit">Submit Feedback</button>
          </form>
          <div class="pm-widget-message" style="display: none; margin-top: 16px;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Event listeners
    this.modal.querySelector('.pm-widget-close')?.addEventListener('click', () => this.close());
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
    this.modal.querySelector('.pm-widget-form')?.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  private async handleSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const submitBtn = form.querySelector('.pm-widget-submit') as HTMLButtonElement;
    const messageEl = this.modal?.querySelector('.pm-widget-message') as HTMLElement;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    const data: FeedbackData = {
      type: formData.get('type') as 'bug' | 'feature' | 'question',
      title: formData.get('title') as string,
      description: formData.get('description') as string || undefined,
      user: {
        name: formData.get('name') as string || undefined,
        email: formData.get('email') as string || undefined,
      },
    };

    // Add metadata
    const payload = {
      ...data,
      metadata: {
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
    };

    try {
      const response = await fetch(`${this.config.apiUrl}/api/v1/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      messageEl.className = 'pm-widget-success';
      messageEl.textContent = 'Thank you! Your feedback has been submitted.';
      messageEl.style.display = 'block';
      form.reset();

      setTimeout(() => this.close(), 2000);
    } catch (error) {
      messageEl.className = 'pm-widget-error';
      messageEl.textContent = 'Failed to submit feedback. Please try again.';
      messageEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Feedback';
    }
  }

  private open() {
    this.isOpen = true;
    this.modal?.classList.add('pm-open');
  }

  private close() {
    this.isOpen = false;
    this.modal?.classList.remove('pm-open');
    const messageEl = this.modal?.querySelector('.pm-widget-message') as HTMLElement;
    if (messageEl) {
      messageEl.style.display = 'none';
    }
  }
}

// Global API
(window as any).MonitorWidget = {
  init: (config: WidgetConfig) => new MonitorWidget(config),
};

export default MonitorWidget;
