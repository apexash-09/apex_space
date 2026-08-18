/**
 * Personal Timetable Module
 * Editable weekly matrix (Mon - Sun, 08:00 AM to 10:00 PM time slots).
 */

class TimetableModule {
  constructor() {
    this.days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    this.hours = [
      '08:00', '09:00', '10:00', '11:00', '12:00', 
      '13:00', '14:00', '15:00', '16:00', '17:00', 
      '18:00', '19:00', '20:00', '21:00', '22:00'
    ];

    this.tableBody = document.getElementById('timetable-body');
    this.modal = document.getElementById('modal-timetable');
    this.form = document.getElementById('form-timetable');
    this.slotIdInput = document.getElementById('slot-id');
    this.slotLabel = document.getElementById('slot-label');
    this.slotTextInput = document.getElementById('slot-text');
    this.btnClearSlot = document.getElementById('btn-clear-slot');

    this.init();
  }

  init() {
    if (!this.tableBody) return;

    // Modal Close
    document.querySelectorAll('[data-close="modal-timetable"]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    // Form Submit
    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveSlot();
      });
    }

    // Clear Slot
    if (this.btnClearSlot) {
      this.btnClearSlot.addEventListener('click', () => this.clearSlot());
    }

    this.renderGrid();
  }

  openModal(slotId, day, time) {
    this.slotIdInput.value = slotId;
    this.slotLabel.innerText = `Editing ${day} at ${time}`;
    
    // Load existing slot data
    window.db.get('timetable', slotId).then(slot => {
      this.slotTextInput.value = slot ? slot.text : '';
    });

    if (this.modal) this.modal.classList.add('active');
  }

  closeModal() {
    if (this.modal) this.modal.classList.remove('active');
    if (this.form) this.form.reset();
  }

  async saveSlot() {
    const slotId = this.slotIdInput.value;
    const text = this.slotTextInput.value.trim();

    if (!text) {
      await this.clearSlot();
      return;
    }

    const slotObj = {
      slotId: slotId,
      text: text,
      updatedAt: new Date().toISOString()
    };

    try {
      await window.db.put('timetable', slotObj);
      this.closeModal();
      this.renderGrid();
    } catch (err) {
      console.error('Failed to save timetable slot:', err);
    }
  }

  async clearSlot() {
    const slotId = this.slotIdInput.value;
    try {
      await window.db.delete('timetable', slotId);
      this.closeModal();
      this.renderGrid();
    } catch (err) {
      console.error('Failed to clear slot:', err);
    }
  }

  async renderGrid() {
    try {
      const allSlots = await window.db.getAll('timetable');
      const slotsMap = {};
      allSlots.forEach(s => slotsMap[s.slotId] = s);

      this.tableBody.innerHTML = '';

      for (const time of this.hours) {
        const tr = document.createElement('tr');

        // Time Header Cell
        const tdTime = document.createElement('td');
        tdTime.style.fontSize = '12px';
        tdTime.style.color = 'var(--text-muted)';
        tdTime.style.padding = '8px 4px';
        tdTime.innerText = time;
        tr.appendChild(tdTime);

        // Days Cells
        for (const day of this.days) {
          const slotId = `${day}-${time}`;
          const slotData = slotsMap[slotId];

          const td = document.createElement('td');
          const div = document.createElement('div');
          div.className = `timetable-cell ${slotData ? 'filled' : ''}`;
          
          if (slotData) {
            div.innerHTML = `<span style="font-weight: 600; color: #fff;">${this.escapeHtml(slotData.text)}</span>`;
          } else {
            div.innerHTML = `<span style="color: var(--text-dim); font-size: 11px;">+ Add</span>`;
          }

          div.addEventListener('click', () => {
            this.openModal(slotId, day, time);
          });

          td.appendChild(div);
          tr.appendChild(td);
        }

        this.tableBody.appendChild(tr);
      }
    } catch (err) {
      console.error('Error rendering timetable grid:', err);
    }
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

window.timetableModule = new TimetableModule();
