# Wait Time Calculation Mode Guide

Language: English  
Updated: 2026-06-07

## 1. Overview

Wait Time Calculation controls how StatsBoard presents waiting-time metrics. It **does not change simulation behavior, clear statistics, or recreate items**. It only changes the reporting perspective, so the same simulation run can support customer SLA reporting, internal efficiency analysis, and bottleneck diagnosis.

| Mode | Focus | Best audience |
| --- | --- | --- |
| Both | Calendar Wait, Working Wait, Diagnostic Working Wait | First diagnosis, operations review, scenario comparison |
| Calendar Time | Full customer-visible waiting | Customers, business owners, SLA reports |
| Working Time | Queue waiting during working hours | Operations, staffing, capacity planning |

Location: Sidebar → Simulation Settings → **Wait Time Calculation**.

---

## 2. The three modes

### 2.1 Both (recommended default)

Both shows two item-level waiting perspectives plus one step-level diagnostic metric.

| Metric | Meaning | Use |
| --- | --- | --- |
| Queue Wait (Calendar) | Full calendar wait from entering a queue to starting processing | Customer view |
| Queue Wait (Working) | Completed items' queue waiting during working hours | Operations view |
| Diagnostic Working Wait | Step-level average of working-time wait | Bottleneck detection |

Use it when building a model for the first time, explaining results, comparing configurations, or separating off-hours effects from actual working-time congestion.

### 2.2 Calendar Time

Calendar Time focuses on the wait customers experience. Nights, weekends, holidays, lunch breaks, and any closed periods are included.

Example: an item joins the queue Friday 17:00 and starts processing Monday 09:00.

- Calendar Wait is about 64 hours.
- Best for SLA, response-time promises, and customer-experience reports.

A high Calendar Wait does not automatically mean insufficient capacity. It may simply reflect the business calendar.

### 2.3 Working Time

Working Time only counts queue waiting that happens during working periods.

Using the same example:

- If Friday 17:00 is exactly closing time, Working Wait may be 0.
- If the item joins at Friday 16:50, closes at 17:00, and starts Monday 09:00, Working Wait is about 10 minutes.

Best for deciding whether to add agents, machines, capacity, or compare business-hour configurations.

---

## 3. Relationship with Business Hours

| Setting | Impact |
| --- | --- |
| Calendar start | Maps simulation time zero to a real calendar date/time |
| Working days | Defines which weekdays count as working time |
| Working hours | Defines which daily segments count as working time |
| Non-working arrivals = queue | Items may enter queues while closed; Calendar Wait grows, Working Wait resumes when open |
| Non-working arrivals = delay | Arrivals are delayed until the next working segment |
| Non-working arrivals = reject | Off-hours arrivals do not create items and increment Cancelled |
| Calendar Override | A specific Start or Process node can use its own calendar |

If Calendar Wait is high but Working Wait is low, inspect Business Hours and non-working arrival policy before adding capacity.

---

## 4. Decision workflow

1. Start with **Both** for the baseline.
2. Compare Calendar Wait and Working Wait.
3. Calendar high, Working low: usually a calendar, arrival-policy, or SLA-perspective issue.
4. Calendar high, Working high: usually capacity, processing duration, rework, or demand peak issue.
5. Use Diagnostic Working Wait to locate the likely bottleneck Process.
6. Switch presentation mode based on audience: Calendar for external reporting, Working for internal optimization.

---

## 5. Scenarios

### Customer support SLA report

Goal: answer how long customers wait before their ticket is handled.  
Recommended mode: Calendar Time, because customers do not subtract nights or weekends from their perceived wait.

### Internal staffing meeting

Goal: decide whether to add agents or change shifts.  
Recommended mode: Working Time, together with Resource Util., Oldest Queue, and Throughput.

### Business-hours policy review

Goal: compare 9-17, 9-20, and weekend coverage.  
Recommended mode: Both. Calendar Wait shows customer-experience improvement; Working Wait shows operational queue pressure.

### Bottleneck diagnosis

Goal: identify which step slows the process.  
Recommended mode: Both + Diagnostic Working Wait + step Resource Utilization.

---

## 6. Reading checklist

| Symptom | Likely cause | Next step |
| --- | --- | --- |
| Calendar high, Working low | Strong off-hours effect | Extend working hours, adjust arrival policy, explain SLA perspective |
| Calendar high, Working high | Congestion during working time | Check Capacity, duration, rework, demand peaks |
| Diagnostic high but Working not high | Step-level average highlights a small hotspot | Inspect that step's queue and utilization |
| P90 much higher than Avg | Poor tail experience | Check complex items, rework, variability, peaks |
| Low Resource Util. but long queue | Closed calendar, wrong connection, or Calendar Override | Check Business Hours, process calendar, connections |

---

## 7. FAQ

**Does switching mode change the simulation result?**  
No. It only changes StatsBoard presentation.

**Which mode is most accurate?**  
All three are accurate. They answer different questions: Calendar for customer wait, Working for working-time congestion, Diagnostic for step bottlenecks.

**Why is Diagnostic Working Wait different from Queue Wait (Working)?**  
Queue Wait (Working) aggregates completed item experiences. Diagnostic is a step-level average and is not item-weighted.

**Which mode should be used in reports?**  
Use Calendar Time externally, Working Time internally, and Both when unsure.