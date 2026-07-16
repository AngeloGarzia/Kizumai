import { useCallback, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import multiMonthPlugin from '@fullcalendar/multimonth';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { useAuth } from '../context/AuthContext.jsx';
import AppShell from '../components/AppShell.jsx';
import {
  plannerService,
  EVENT_KINDS,
  EVENT_STATUSES,
  kindColor,
} from '../services/plannerService.js';

const EMPTY_FORM = {
  id: null,
  title: '',
  kind: 'task',
  status: 'todo',
  allDay: false,
  startAt: '',
  endAt: '',
  location: '',
  description: '',
};

// Convertit une Date en valeur pour <input type="datetime-local"> (heure locale).
function toLocalInput(date, dateOnly = false) {
  if (!date) return '';
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return dateOnly ? base : `${base}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toEvent(e) {
  const color = e.color || kindColor(e.kind);
  return {
    id: String(e.id),
    title: e.title,
    start: e.startAt,
    end: e.endAt || undefined,
    allDay: e.allDay,
    backgroundColor: color,
    borderColor: color,
    classNames: e.status === 'done' ? ['fc-event-done'] : [],
    extendedProps: {
      kind: e.kind,
      status: e.status,
      location: e.location,
      description: e.description,
    },
  };
}

export default function Planner() {
  const { logout } = useAuth();
  const calendarRef = useRef(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadRange = useCallback(async (from, to) => {
    try {
      const data = await plannerService.list({ from, to });
      setEvents(data.map(toEvent));
      setError('');
    } catch (err) {
      setError(err.message || 'Impossible de charger le planning');
    }
  }, []);

  const handleDatesSet = useCallback(
    (arg) => {
      loadRange(arg.start.toISOString(), arg.end.toISOString());
    },
    [loadRange]
  );

  const openCreate = (startAt = '', endAt = '', allDay = false) => {
    setForm({ ...EMPTY_FORM, startAt, endAt, allDay });
    setModalOpen(true);
  };

  const openEdit = (event) => {
    const p = event.extendedProps;
    setForm({
      id: event.id,
      title: event.title,
      kind: p.kind || 'task',
      status: p.status || 'todo',
      allDay: event.allDay,
      startAt: toLocalInput(event.start, event.allDay),
      endAt: toLocalInput(event.end, event.allDay),
      location: p.location || '',
      description: p.description || '',
    });
    setModalOpen(true);
  };

  const handleDateClick = (arg) => {
    openCreate(toLocalInput(arg.date, arg.allDay), '', arg.allDay);
  };

  const handleSelect = (arg) => {
    openCreate(toLocalInput(arg.start, arg.allDay), toLocalInput(arg.end, arg.allDay), arg.allDay);
  };

  // Glisser-déposer / redimensionnement : on persiste les nouvelles dates.
  const persistMove = async (arg) => {
    const { event } = arg;
    try {
      await plannerService.update(event.id, {
        startAt: event.start?.toISOString(),
        endAt: event.end ? event.end.toISOString() : null,
        allDay: event.allDay,
      });
    } catch (err) {
      setError(err.message || 'Déplacement impossible');
      arg.revert();
    }
  };

  const reloadCurrent = () => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    loadRange(api.view.activeStart.toISOString(), api.view.activeEnd.toISOString());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Le titre est requis');
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      kind: form.kind,
      status: form.status,
      allDay: form.allDay,
      startAt: form.startAt || null,
      endAt: form.endAt || null,
      location: form.location || null,
      description: form.description || null,
    };
    try {
      if (form.id) {
        await plannerService.update(form.id, payload);
      } else {
        await plannerService.create(payload);
      }
      setModalOpen(false);
      reloadCurrent();
    } catch (err) {
      setError(err.message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!form.id) return;
    setSaving(true);
    try {
      await plannerService.remove(form.id);
      setModalOpen(false);
      reloadCurrent();
    } catch (err) {
      setError(err.message || 'Suppression impossible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell onLogout={logout}>
      <div className="card p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-medium text-prune-600 uppercase tracking-wide">Planner</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-prune-900">Mon calendrier</h2>
          </div>
          <button type="button" onClick={() => openCreate()} className="btn-primary w-auto">
            + Nouvel événement
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          {EVENT_KINDS.map((k) => (
            <span key={k.value} className="inline-flex items-center gap-1.5 text-xs text-prune-600">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: k.color }} />
              {k.label}
            </span>
          ))}
        </div>

        {error && <p className="alert-error mb-3">{error}</p>}

        <div className="planner-calendar">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={frLocale}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'timeGridWeek,dayGridMonth,multiMonthYear',
            }}
            buttonText={{
              today: "Aujourd'hui",
              week: 'Semaine',
              month: 'Mois',
              year: 'Année',
            }}
            views={{
              multiMonthYear: { type: 'multiMonth', duration: { years: 1 } },
            }}
            firstDay={1}
            height="auto"
            nowIndicator
            editable
            selectable
            selectMirror
            dayMaxEvents
            events={events}
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            select={handleSelect}
            eventClick={(arg) => openEdit(arg.event)}
            eventDrop={persistMove}
            eventResize={persistMove}
          />
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-prune-900/50 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-prune-900 mb-4">
              {form.id ? "Modifier l'événement" : 'Nouvel événement'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-prune-700 mb-1">Titre</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="input-field"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-prune-700 mb-1">Type</label>
                  <select
                    value={form.kind}
                    onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                    className="input-field"
                  >
                    {EVENT_KINDS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-prune-700 mb-1">Statut</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="input-field"
                  >
                    {EVENT_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-prune-700">
                <input
                  type="checkbox"
                  checked={form.allDay}
                  onChange={(e) => setForm((f) => ({ ...f, allDay: e.target.checked }))}
                />
                Journée entière
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-prune-700 mb-1">Début</label>
                  <input
                    type={form.allDay ? 'date' : 'datetime-local'}
                    value={form.startAt}
                    onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-prune-700 mb-1">Fin</label>
                  <input
                    type={form.allDay ? 'date' : 'datetime-local'}
                    value={form.endAt}
                    onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-prune-700 mb-1">Lieu</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  className="input-field"
                  placeholder="Optionnel"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-prune-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="input-field min-h-20"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                {form.id ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="text-sm font-medium text-red-600 hover:text-red-700"
                  >
                    Supprimer
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="btn-secondary w-auto"
                  >
                    Annuler
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary w-auto">
                    {saving ? '...' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
