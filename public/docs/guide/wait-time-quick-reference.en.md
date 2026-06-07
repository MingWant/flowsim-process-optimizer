# Wait Time Mode Quick Reference

Language: English  
Updated: 2026-06-07

## 1. Five-minute decision table

| Question | Mode | Focus |
| --- | --- | --- |
| How long did customers really wait? | Calendar Time | Queue Wait, Avg Calendar, P90 |
| Is the queue congested during working hours? | Working Time | Queue Wait, Resource Util., Throughput |
| First diagnosis, unsure why | Both | Calendar vs Working gap, Diagnostic Working Wait |
| Should capacity be added? | Working Time | Working Wait, Capacity, Oldest Queue |
| Are business hours too short? | Both | Calendar Wait - Working Wait, Non-working Delay |
| Which step is the bottleneck? | Both | Diagnostic Working Wait, Step Utilization |

---

## 2. One-line summary

- **Both**: most complete; best for diagnosis and explaining differences.
- **Calendar Time**: customer view; includes nights and weekends.
- **Working Time**: operations view; counts only working-time queue waiting.

Location: Sidebar → Simulation Settings → **Wait Time Calculation**.

---

## 3. Quick example

An item enters the queue Friday 17:00 and starts processing Monday 09:00:

| Metric | Result | Interpretation |
| --- | --- | --- |
| Calendar Wait | About 64 hours | The customer waited through the weekend |
| Working Wait | May be 0 hours | There was no working-time congestion |
| Diagnostic Working Wait | Step-level average | Helps identify which Process may be blocked |

Conclusion: if only Calendar Wait is high, adding capacity may not help. Review business hours, SLA wording, or off-hours arrival policy.

---

## 4. Reading shortcuts

| Symptom | Meaning | Action |
| --- | --- | --- |
| Calendar high, Working low | Waiting caused by closed time | Check Business Hours |
| Calendar high, Working high | Congestion while open | Check Capacity and duration |
| P90 much higher than Avg | Tail experience problem | Check complex items, peaks, rework |
| High Util., long Queue | Resources are overloaded | Add capacity or reduce duration |
| Low Util., long Queue | Calendar or routing issue | Check calendar, connections, override |

---

## 5. Minimal workflow

1. Start with **Both**.
2. Run until enough items have finished.
3. Compare Calendar Wait and Working Wait.
4. Check whether P90 is much higher than Avg.
5. Find the Process with high Diagnostic Working Wait and Resource Utilization.
6. Switch mode based on reporting audience.

---

## 6. Common choices

- Customer report: Calendar Time.
- Staffing review: Working Time.
- Management review: Both.
- Configuration comparison: Both or Working Time.
- Fast troubleshooting: Both.