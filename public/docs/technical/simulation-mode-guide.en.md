# Simulation Mode and Process Execution Guide

Language: English  
Updated: 2026-06-07

## 1. Three related settings

FlowSim has several settings that are easy to confuse:

| Level | Setting | Impact |
| --- | --- | --- |
| Global Simulation Mode | Realistic / Worst-Case | Controls stochastic behavior and stress-test perspective |
| Process Simulation Type | Resource Mode / Time Delay | Controls whether a step uses capacity and queues |
| Process Execution Mode | 1 resource / item, Team per item, 1 resource / many items | Controls how Capacity is consumed |

Start with Realistic for a baseline, then use Worst-Case for conservative capacity checks.

---

## 2. Realistic vs Worst-Case

| Mode | Meaning | Use case |
| --- | --- | --- |
| Realistic | Runs according to configured randomness, probabilities, and variability | Daily prediction, average performance, scenario comparison |
| Worst-Case | Stresses the model with a more conservative perspective | Peak validation, SLA safety margin, capacity floor |

Workflow:

1. Calibrate the model in Realistic mode.
2. Record Avg, P90, Queue, Utilization, and Throughput.
3. Switch to Worst-Case and check whether queues explode under pressure.
4. If P90 or Queue is too high, increase capacity, reduce duration, or adjust arrival policies.

---

## 3. Process Simulation Type

### Resource Mode

Resource Mode means the step needs limited resources. If all resources are busy, new items queue.

Best for support agents, manual review, counters, machines, and clinicians. Key metrics: Queue, Oldest Queue, Queue Wait, Resource Utilization.

### Time Delay

Time Delay does not consume Capacity and does not queue for resources. After an item arrives, timing starts from the current time if the step calendar is open; if the step calendar is closed, timing is pushed to the next working window.

Best for transport, cooling, curing, system delay, and external waiting. It increases Cycle Time but is usually not a resource bottleneck.

---

## 4. Execution Mode

### 1 resource / item

The standard queueing model. One item consumes one resource. Capacity = 3 means up to three items can be processed at once.

### Team per item

One item requires multiple resources at the same time.

| Sub-mode | Meaning |
| --- | --- |
| Auto teams | Builds teams automatically from Capacity and default team size |
| Explicit teams | Manually defines team names and sizes; total resources must equal Capacity |

Example: Capacity = 6 and team size = 2 allows at most 3 concurrent items. Larger teams may be faster but reduce concurrency.

### 1 resource / many items

One resource can work on several items at once.

| Parameter | Meaning |
| --- | --- |
| Max concurrent items / resource | Maximum simultaneous items for each resource |
| Speed multiplier by concurrent load | Per-item speed under different concurrent loads |

Best for AI assistants, batch systems, automation, and monitoring multiple tasks.

---

## 5. Processing duration

| Mode | Parameters | Meaning |
| --- | --- | --- |
| Fixed | Base Time + Variance | Varies around a base duration |
| Range | Min / Max Duration | Samples within a range |

If P90 is much higher than Avg, inspect duration variability, item profile Time Factor, rework links, and demand peaks.

---

## 6. Selection guide

| Business situation | Recommended setting |
| --- | --- |
| One person handles one item | Resource Mode + 1 resource / item |
| Several people collaborate on one item | Resource Mode + Team per item |
| One system handles many items concurrently | Resource Mode + 1 resource / many items |
| Waiting without consuming people or machines | Time Delay |
| Normal forecast | Realistic |
| Conservative stress test | Worst-Case |

---

## 7. Troubleshooting

| Symptom | Check |
| --- | --- |
| Long Queue, high Utilization | Capacity too low, duration too long, too much rework |
| Long Queue, low Utilization | Business Hours closed, Calendar Override, routing issue |
| Team mode cannot save | Explicit team total must equal Capacity |
| Multitask has little effect | Max concurrent, speed multipliers, arrival volume |
| Worst-Case looks too bad | Check whether assumptions are too conservative, then assess safety margin |