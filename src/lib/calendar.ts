import { BOOKING_OPENS, BOOKING_URL, FEST_NAME } from '../config';

const TITLE = `${FEST_NAME} bookings open`;
const DETAILS = `Passes for ${FEST_NAME}, the techfest, go live now. Grab yours before they're gone.`;

// 20261204T183000Z
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const end = () => new Date(BOOKING_OPENS.getTime() + 30 * 60 * 1000);

export function googleCalendarUrl(): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: TITLE,
    dates: `${stamp(BOOKING_OPENS)}/${stamp(end())}`,
    details: DETAILS,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function downloadIcs(): void {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Astrayuga//Countdown//EN',
    'BEGIN:VEVENT',
    `UID:bookings-${stamp(BOOKING_OPENS)}@astrayuga`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(BOOKING_OPENS)}`,
    `DTEND:${stamp(end())}`,
    `SUMMARY:${TITLE}`,
    `DESCRIPTION:${DETAILS}`,
    BOOKING_URL.startsWith('http') ? `URL:${BOOKING_URL}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${TITLE} in 15 minutes`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'astrayuga-bookings.ics';
  a.click();
  URL.revokeObjectURL(url);
}
