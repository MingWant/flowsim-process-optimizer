# Multi-Segment Business Hours Guide

Language: English  
Updated: 2026-06-07

## 1. Purpose

Business Hours defines when the system can process items. Multi-segment hours allow several open periods in one day, such as `09:00-12:00` and `13:00-18:00`. This supports lunch breaks, split shifts, retail hours, support shifts, and department-specific calendars.

---

## 2. Core settings

| Setting | Meaning | Example |
| --- | --- | --- |
| Enabled | Enables the working calendar | Closed periods affect processing |
| Calendar start | Maps simulation time zero to a date/time | 2026-01-05 09:00 |
| Working days | Which weekdays are open | Monday to Friday |
| Working hours | One or more daily segments | 9-12, 13-18 |
| Non-working arrivals | Off-hours arrival policy | queue, delay, reject |
| Calendar Override | Custom calendar for one Start or Process node | online orders 24/7, finance Mon-Fri 9-17 |

`workingDay` is always an 8-hour unit conversion. It does not automatically equal the configured daily open hours.

---

## 3. Off-hours arrival policies

| Policy | Behavior | Best for |
| --- | --- | --- |
| queue | Items may enter queues while closed and wait until open | Online orders or tickets accepted anytime |
| delay | Arrival is delayed until the next working segment | Walk-in services accepted only while open |
| reject | Off-hours arrivals do not create items and increment Cancelled | Strict service windows |

Metric impact:

- queue increases Calendar Wait, while Working Wait resumes only when open.
- delay changes the actual system entry time.
- reject does not create off-hours items and increments the Cancelled count.

---

## 4. Common configurations

### Office

- Working days: Mon-Fri.
- Working hours: 09:00-12:00, 13:00-18:00.
- Non-working arrivals: queue or delay.

### Restaurant

- Working days: All days.
- Working hours: 11:00-14:00, 17:00-22:00.
- Demand Peaks: lunch and dinner x2.

### 24/7 support

- Working days: All days.
- Working hours: 00:00-24:00.
- Non-working arrivals usually has no effect.

---

## 5. Relationship with wait metrics

| Symptom | Interpretation |
| --- | --- |
| Calendar Wait high, Working Wait low | Closed time drives customer waiting |
| Non-working Delay high | Business-hours policy strongly affects cycle time |
| Oldest Queue high before opening | queue policy lets off-hours items wait in line |
| Working Wait high | Resources cannot keep up while open |

Use Both mode when evaluating calendar-policy changes.

---

## 6. Start / Process Calendar Override

Some steps should not inherit the global calendar.

Example: online orders arrive 24/7; warehouse picking runs Mon-Sat 8-20; finance review runs Mon-Fri 9-17. Configure Calendar Override for those Start or Process nodes to avoid modeling the entire flow with one calendar.

---

## 7. Troubleshooting checklist

| Issue | Check |
| --- | --- |
| Items do not process | Business Time closed; Process has Calendar Override |
| Items enter queues while closed | Non-working arrivals is set to queue |
| Weekend behavior looks wrong | Working days include or exclude weekends correctly |
| Work continues during lunch | Working hours are split into separate segments |
| workingDay seems wrong | workingDay is fixed at 8 hours; it is not the calendar's daily length |