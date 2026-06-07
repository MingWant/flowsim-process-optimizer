# Dual Wait Time Metrics Technical Guide

Language: English  
Updated: 2026-06-07

## 1. Purpose

FlowSim keeps both Calendar Wait and Working Wait to avoid mixing two different questions:

- Customer view: how much real time passed before work started?
- Operations view: how much queue congestion happened while the organization was open?

Calendar Wait alone can make off-hours look like capacity failure. Working Wait alone can hide customer-experience problems. FlowSim therefore reports both, plus Diagnostic Working Wait for step-level bottleneck detection.

---

## 2. Metric definitions

| Metric | Definition | Aggregation | Main use |
| --- | --- | --- | --- |
| Queue Wait (Calendar) | Full calendar duration from entering a queue to starting processing | item-weighted | SLA, customer experience, external reporting |
| Queue Wait (Working) | Queue waiting during working periods | item-weighted | efficiency, staffing, capacity planning |
| Diagnostic Working Wait | Step-level average of working wait across Process steps | step average | bottleneck diagnosis |
| Non-working Delay | `Calendar Cycle - Global Working Cycle`, based on the global Business Calendar | item/flow statistic | business-hours policy review |

### Calendar Wait

Includes nights, weekends, lunch breaks, holidays, and all closed periods.

```text
Friday 17:00 queued → Monday 09:00 processing starts
Calendar Wait ≈ 64 hours
```

### Working Wait

Counts only queue waiting that happens during Business Hours.

```text
Friday 16:50 queued → 17:00 closed → Monday 09:00 processing starts
Working Wait ≈ 10 minutes
```

### Diagnostic Working Wait

Diagnostic Working Wait is a step diagnostic metric, not a customer average. It averages working wait across steps to highlight small but severe hotspots.

```text
Step A: 100 items, average Working Wait = 1 min
Step B: 1 item, average Working Wait = 100 min

Queue Wait (Working) ≈ 1.98 min
Diagnostic Working Wait = 50.5 min
```

This means Step B deserves inspection. It does not mean the average item waited 50.5 minutes.

---

## 3. Relationship with simulation logic

| Module | Impact on wait metrics |
| --- | --- |
| Start | Controls when items enter the system via Arrival Model, Batch, Item Mix, Demand Peaks |
| Process Resource Mode | Capacity shortages create queues; most wait metrics arise here |
| Process Time Delay | Uses no resource; usually does not create resource queue wait, but increases cycle time |
| Business Hours | Defines the counting window for Working Wait |
| Calendar Override | Lets one Start or Process node use a different calendar |
| Non-working arrivals | Controls whether off-hours arrivals queue, delay, or reject |
| Connections | Rework paths create repeated queues and longer cycles |
| Exceptions | Failures and cancellations affect which items enter finished-item statistics |

---

## 4. Typical interpretations

| Calendar Wait | Working Wait | Meaning |
| --- | --- | --- |
| High | Low | Strong off-hours effect; customers wait, but working-time congestion may be low |
| High | High | Congestion exists while open; capacity or duration may be insufficient |
| Low | High | Short but intense working-time peak |
| Low | Low | Low wait pressure |

Additional signals:

- High Resource Util. + high Working Wait: insufficient capacity or long processing duration.
- High P90 + normal Avg: poor tail experience; inspect complex items, peaks, rework.
- High Non-working Delay: business hours, lunch breaks, or weekends dominate.

---

## 5. Multi-step and rework flows

An item may enter multiple queues. Flow-level metrics aggregate the real item journey; step-level metrics show each Process queue separately.

Rework example:

```text
Preparation → Quality Check → 10% back to Preparation → Quality Check → Packaging
```

Rework increases total cycle time, number of queue visits, resource load, P90, and tail risk.

---

## 6. Reporting guidance

| Audience | Recommended metrics | Why |
| --- | --- | --- |
| Customers / external SLA | Calendar Wait, Avg Calendar, P90 | Matches perceived waiting |
| Operations / staffing | Working Wait, Resource Util., Throughput | Shows working-time congestion |
| Process improvement team | Both + Diagnostic | Combines experience, efficiency, and bottlenecks |
| Technical debugging | Step metrics + queue snapshots | Locates routing, calendar, or capacity issues |

---

## 7. Common pitfalls

- High Calendar Wait is not a bug and does not always mean insufficient capacity.
- Low Working Wait does not mean customers are happy; they may still wait overnight or over a weekend.
- Diagnostic Working Wait is not item-average experience.
- Switching Wait Time Calculation does not change simulation behavior.
- Scenario comparisons should use the same arrival logic and experiment boundary.