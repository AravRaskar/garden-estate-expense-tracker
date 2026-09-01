// ============================================
// Daily Timetable Module
// ============================================

import { fetchTimetables, saveTimetable, deleteTimetable } from './supabase.js';
import { formatDate, escapeHtml, showToast } from './utils.js';

export async function renderTimetable(container, year) {
    container.innerHTML = `
        <div class="page-enter">
            <div class="page-header">
                <h1><span class="header-icon">📅</span> Daily Event Timetable</h1>
                <button class="btn btn-primary" id="btn-add-timetable">+ Upload Timetable</button>
            </div>
            <div class="loading-spinner"><div class="spinner-ring"></div></div>
        </div>
    `;

    try {
        const items = await fetchTimetables(year);

        container.innerHTML = `
            <div class="page-enter">
                <div class="page-header">
                    <div>
                        <h1><span class="header-icon">📅</span> Daily Event Timetable</h1>
                        <p class="text-muted text-sm">Upload PNG/JPEG schedule images for festival / estate events</p>
                    </div>
                    <button class="btn btn-primary" id="btn-add-timetable">+ Upload Timetable Image</button>
                </div>

                ${items.length === 0 ? `
                    <div class="empty-state">
                        <div class="empty-icon">🖼️</div>
                        <h3>No timetables uploaded yet</h3>
                        <p>Upload PNG or JPEG schedule images for year ${year}.</p>
                    </div>
                ` : `
                    <div class="timetable-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 1rem;">
                        ${items.map(item => `
                            <div class="building-card" style="cursor: default; padding: 1.25rem;">
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                                    <div>
                                        <h3 style="font-size: 1.1rem; font-weight: 600;">${escapeHtml(item.title)}</h3>
                                        <span class="text-sm text-muted">📅 ${formatDate(item.event_date)}</span>
                                    </div>
                                    <button class="btn-edit btn-del-tt" data-id="${item.id}" style="background: var(--error-light); color: var(--error); border-color: var(--error-border);">🗑️</button>
                                </div>
                                <div style="border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--slate-200); max-height: 400px; background: var(--slate-900); display: flex; align-items: center; justify-content: center;">
                                    <img src="${item.image_url}" alt="${escapeHtml(item.title)}" style="max-width: 100%; max-height: 400px; object-fit: contain; cursor: pointer;" onclick="window.open('${item.image_url}', '_blank')">
                                </div>
                                <div style="margin-top: 0.5rem; text-align: right;">
                                    <small class="text-muted">Click image to view full size</small>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;

        document.getElementById('btn-add-timetable').onclick = () => openTimetableModal(year, () => renderTimetable(container, year));

        container.querySelectorAll('.btn-del-tt').forEach(btn => {
            btn.onclick = async () => {
                if (confirm('Delete this timetable image?')) {
                    try {
                        await deleteTimetable(btn.dataset.id);
                        showToast('Timetable removed');
                        renderTimetable(container, year);
                    } catch (err) {
                        showToast('Delete error: ' + err.message, 'error');
                    }
                }
            };
        });

    } catch (err) {
        console.error('Timetable error:', err);
        container.innerHTML = `<div class="empty-state"><h3>Failed to load timetables</h3><p>${escapeHtml(err.message)}</p></div>`;
    }
}

function openTimetableModal(year, onSave) {
    const overlay = document.getElementById('timetable-modal-overlay');
    document.getElementById('tt-title').value = '';
    document.getElementById('tt-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('tt-file-input').value = '';
    document.getElementById('tt-preview').style.display = 'none';

    let base64Image = '';

    overlay.classList.add('active');

    const fileInput = document.getElementById('tt-file-input');
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.match(/^image\/(png|jpeg|jpg)$/i)) {
                showToast('Please select a PNG or JPEG image', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                base64Image = event.target.result;
                const img = document.getElementById('tt-preview-img');
                img.src = base64Image;
                document.getElementById('tt-preview').style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    };

    const saveBtn = document.getElementById('tt-save-btn');
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);

    newBtn.onclick = async () => {
        const title = document.getElementById('tt-title').value.trim();
        const event_date = document.getElementById('tt-date').value;

        if (!title || !base64Image) {
            showToast('Please provide a title and select an image', 'error');
            return;
        }

        newBtn.disabled = true;
        try {
            await saveTimetable({
                year,
                title,
                image_url: base64Image,
                event_date
            });
            showToast('Timetable uploaded!');
            overlay.classList.remove('active');
            onSave();
        } catch (err) {
            showToast('Upload failed: ' + err.message, 'error');
        } finally {
            newBtn.disabled = false;
        }
    };

    const close = () => overlay.classList.remove('active');
    document.getElementById('tt-modal-close').onclick = close;
    document.getElementById('tt-cancel-btn').onclick = close;
}
