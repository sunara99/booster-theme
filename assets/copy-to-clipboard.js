import { Component } from '@theme/component';

/**
 * Handles copying text to clipboard, from an event like a click.
 * Optionally, reveals a success message after copying.
 * @extends {Component}
 */
class CopyToClipboardComponent extends Component {
  copyToClipboard() {
    let copyContent = this.getAttribute('text-to-copy')?.trim();
    if (!copyContent) {
      const codeEl = this.querySelector('.email-popup__discount-code-text');
      copyContent = codeEl?.textContent?.trim() ?? '';
    }
    if (!copyContent) return;

    const showSuccess = () => {
      const copySuccessMessage = this.refs.copySuccessMessage;
      if (copySuccessMessage instanceof Element) {
        copySuccessMessage.classList.remove('visually-hidden');
        setTimeout(() => copySuccessMessage.classList.add('visually-hidden'), 2000);
      }
    };

    const execCommandCopy = () => {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = copyContent;
        textarea.setAttribute('readonly', '');
        textarea.style.cssText =
          'position:fixed;top:0;left:0;width:2em;height:2em;padding:0;border:none;outline:none;box-shadow:none;background:transparent;opacity:0.01;z-index:-1';
        this.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, copyContent.length);
        const success = document.execCommand('copy');
        this.removeChild(textarea);
        return success;
      } catch {
        return false;
      }
    };

    if (execCommandCopy()) {
      showSuccess();
      return;
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(copyContent).then(showSuccess).catch(() => {
        if (execCommandCopy()) showSuccess();
      });
    }
  }
}

if (!customElements.get('copy-to-clipboard-component')) {
  customElements.define('copy-to-clipboard-component', CopyToClipboardComponent);
}
