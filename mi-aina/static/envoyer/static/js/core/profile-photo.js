/* Aperçu de la photo de profil et glisser-déposer, sans toucher à l’envoi Django. */
(() => {
  const input = document.getElementById('id_photo');
  const dropzone = document.querySelector('.profile-dropzone');
  const preview = document.getElementById('profilePhotoPreview');
  const image = document.getElementById('profilePhotoPreviewImage');
  const filename = document.getElementById('profilePhotoFileName');
  const clear = document.getElementById('profilePhotoClear');
  if (!input || !dropzone || !preview || !image || !filename) return;

  let previewUrl = '';
  const showError = message => {
    let alert = document.querySelector('.profile-upload-error');
    if (!alert) {
      alert = document.createElement('p');
      alert.className = 'profile-form-error profile-upload-error';
      alert.setAttribute('role', 'alert');
      dropzone.after(alert);
    }
    alert.innerHTML = '<i data-lucide="circle-alert"></i><span></span>';
    alert.querySelector('span').textContent = message;
    window.MI?.refreshIcons();
  };
  const clearError = () => document.querySelector('.profile-upload-error')?.remove();
  const resetPreview = () => {
    input.value = '';
    preview.hidden = true;
    image.removeAttribute('src');
    filename.textContent = '';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    clearError();
  };
  const displayFile = file => {
    clearError();
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      resetPreview();
      showError('Choisissez un fichier image (JPG, PNG ou WebP).');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    image.src = previewUrl;
    filename.textContent = file.name;
    preview.hidden = false;
  };

  input.addEventListener('change', () => displayFile(input.files?.[0]));
  clear?.addEventListener('click', resetPreview);
  dropzone.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });
  ['dragenter', 'dragover'].forEach(type => dropzone.addEventListener(type, event => {
    event.preventDefault();
    dropzone.classList.add('is-dragover');
  }));
  ['dragleave', 'drop'].forEach(type => dropzone.addEventListener(type, event => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
  }));
  dropzone.addEventListener('drop', event => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    try {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      input.files = transfer.files;
    } catch (_) { /* l’aperçu reste possible même si DataTransfer est bloqué */ }
    displayFile(file);
  });
})();
