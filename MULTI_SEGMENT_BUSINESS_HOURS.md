# Multi-Segment Business Hours Implementation

## Status: ✅ Complete (Phase 1 + Phase 2)

### What's Implemented

#### Core Logic (100% Complete)
- ✅ **Type Definitions** - `WorkingHourSegment` and updated `BusinessCalendar` in `types.ts`
- ✅ **Data Migration** - Automatic migration from legacy `startHour/endHour` to `workingHours`
- ✅ **Simulation Logic** - `isWorkingTime()` and `getNextWorkingSimulationTime()` support multiple segments
- ✅ **Backward Compatibility** - Existing configurations continue to work without changes

#### UI Editor (100% Complete)
- ✅ Visual editor for multiple time segments
- ✅ Add/remove segments with buttons
- ✅ Real-time duration display for each segment
- ✅ Total working hours calculation
- ✅ Integrated into Global Business Calendar
- ✅ Integrated into Step-level Custom Calendar

---

## How to Use

### Visual Editor (Recommended - Works Now!)

#### Global Business Calendar
1. Open the **Settings** panel (gear icon)
2. Find the **Business Calendar** section
3. Toggle it **On**
4. You'll see the working hours editor with one default segment (9:00 - 17:00)
5. Click **"+ Add Segment"** to add more time periods
6. Adjust start/end times for each segment using the number inputs
7. Each segment shows its duration (e.g., "480min")
8. Remove unwanted segments with the trash icon (minimum 1 required)
9. Total hours per day is displayed at the bottom

#### Step-level Custom Calendar
1. Edit any **Start** or **Process** node
2. Find the **Calendar Mode** setting
3. Select **"Custom"** instead of "Inherit"
4. Same segment editor appears - configure it independently for this step

### Manual Configuration (Advanced)

You can manually edit your configuration file or use the browser's localStorage to set up multiple working hour segments:

```json
{
  "businessCalendar": {
    "enabled": true,
    "daysOfWeek": [1, 2, 3, 4, 5],
    "workingHours": [
      { "start": 9, "end": 12 },
      { "start": 13, "end": 18 }
    ],
    "nonWorkingArrivalPolicy": "queue"
  }
}
```

### Method 2: Legacy Format (Still Supported)

Old configurations are automatically migrated:

```json
{
  "businessCalendar": {
    "enabled": true,
    "daysOfWeek": [1, 2, 3, 4, 5],
    "startHour": 9,
    "endHour": 17,
    "nonWorkingArrivalPolicy": "queue"
  }
}
```

This will be internally converted to:
```json
{
  "workingHours": [{ "start": 9, "end": 17 }]
}
```

---

## Use Cases

### Office with Lunch Break
```json
{
  "workingHours": [
    { "start": 9, "end": 12 },     // Morning: 9:00 AM - 12:00 PM
    { "start": 13, "end": 18 }     // Afternoon: 1:00 PM - 6:00 PM
  ]
}
```

### Restaurant (Lunch & Dinner Service)
```json
{
  "workingHours": [
    { "start": 11, "end": 14 },    // Lunch: 11:00 AM - 2:00 PM
    { "start": 17, "end": 22 }     // Dinner: 5:00 PM - 10:00 PM
  ]
}
```

### 24/7 Operations
```json
{
  "workingHours": [
    { "start": 0, "end": 24 }      // Continuous
  ]
}
```

### Multiple Shifts
```json
{
  "workingHours": [
    { "start": 6, "end": 14 },     // Morning shift: 6:00 AM - 2:00 PM
    { "start": 14, "end": 22 },    // Afternoon shift: 2:00 PM - 10:00 PM
    { "start": 22, "end": 24 },    // Night shift part 1: 10:00 PM - 12:00 AM
    { "start": 0, "end": 6 }       // Night shift part 2: 12:00 AM - 6:00 AM
  ]
}
```

---

## Technical Details

### Migration Priority

1. **First Priority**: `workingHours` array (if present and valid)
2. **Second Priority**: Legacy `startHour`/`endHour` (auto-converted)
3. **Fallback**: Default `[{ start: 9, end: 17 }]`

### Validation Rules

- Each segment must have `start < end`
- Hours are clamped to `[0, 24]`
- Invalid segments are filtered out
- Segments are automatically sorted by start time
- Empty `workingHours` array falls back to legacy or default

### Files Modified

- `types.ts` - Added `WorkingHourSegment` interface, updated `BusinessCalendar`
- `services/simulationCalendar.ts` - Updated all calendar logic functions
- `constants.ts` - Updated default calendar to use `workingHours`

---

## Phase 2 Roadmap

### Planned UI Improvements

1. **Segment List Editor**
   - Add/remove segments with buttons
   - Visual timeline showing working hours
   - Drag-to-reorder segments

2. **Validation UI**
   - Highlight overlapping segments
   - Show total working hours per day
   - Warn about gaps in coverage

3. **Templates**
   - Quick preset buttons: "Office Hours", "Restaurant", "24/7", etc.
   - Save custom templates

---

## Testing

Run the simulation with different configurations to verify:

```javascript
// Test: Office with lunch break
const calendar = {
  enabled: true,
  daysOfWeek: [1, 2, 3, 4, 5],
  workingHours: [
    { start: 9, end: 12 },
    { start: 13, end: 18 }
  ]
};

// Items arriving at 12:30 PM should queue until 1:00 PM
// Items arriving at 11:00 AM should process immediately
```

---

## Migration Notes

### For Existing Users

No action required! Your existing configurations will continue to work. The system automatically migrates:

```
OLD: { startHour: 9, endHour: 17 }
  ↓
NEW: { workingHours: [{ start: 9, end: 17 }] }
```

### For New Features

To use multiple segments, directly edit the configuration JSON or wait for Phase 2 UI.

---

## Questions?

- Multiple working segments per day: ✅ Supported
- Break times (gaps between segments): ✅ Supported
- Different hours per day: Use `daysOfWeek` filter (existing feature)
- Overnight shifts: ✅ Supported (split into two segments)

