// ============================================================================
// EMA Schedule Builder - Vanilla JS Module
// ============================================================================

// LCG constants (Numerical Recipes values)
const LCG_A = "1664525";
const LCG_C = "1013904223";
const LCG_M = "4294967296";

// LCG as numbers for simulation
const LCG_A_NUM = 1664525;
const LCG_C_NUM = 1013904223;
const LCG_M_NUM = 4294967296;

// LCG function: returns next value in sequence
function lcgNext(current) {
  return (LCG_A_NUM * current + LCG_C_NUM) % LCG_M_NUM;
}

// Extract a random integer in [0, max) using upper bits of LCG output
// (Low bits of LCG have poor randomness - the classic LCG pitfall)
function lcgMod(rand, max) {
  return Math.floor((rand / LCG_M_NUM) * max);
}

// Run Monte Carlo simulation and return array of {time, windowIdx} objects
function runMonteCarloSimulation(numRuns = 10000) {
  const { windows, numDays, dayJitter } = state;
  if (windows.length === 0) return [];

  const jitterRange = dayJitter * 2;
  const allSamples = [];

  for (let run = 0; run < numRuns; run++) {
    // Start with a random seed for each run
    let rand = Math.floor(Math.random() * LCG_M_NUM);

    // Warm up the LCG (like the real implementation does with seed processing)
    rand = lcgNext(rand);
    rand = lcgNext(rand);
    rand = lcgNext(rand);

    for (let day = 0; day < numDays; day++) {
      // Generate day jitter offset (if jitter enabled)
      let dayJitterOffset = 0;
      if (dayJitter > 0) {
        rand = lcgNext(rand);
        dayJitterOffset = lcgMod(rand, jitterRange) - dayJitter;
      }

      // Generate sample time for each window
      windows.forEach((window, windowIdx) => {
        rand = lcgNext(rand);
        const windowStart = window.startHour * 60 + window.startMin;
        const sampleOffset = lcgMod(rand, window.duration);
        const sampleTime = windowStart + dayJitterOffset + sampleOffset;
        allSamples.push({ time: sampleTime, windowIdx });
      });
    }
  }

  return allSamples;
}

// Render histogram of sample times with stacked bars by window
function renderHistogram() {
  const container = document.getElementById("histogram-container");
  if (!container) return;

  if (state.windows.length === 0) {
    container.innerHTML = "";
    return;
  }

  const samples = runMonteCarloSimulation(10000);
  if (samples.length === 0) {
    container.innerHTML = "";
    return;
  }

  // Same color palette as timeline
  const colors = ["#4e79a7", "#59a14f", "#edc949", "#e15759", "#76b7b2", "#f28e2b"];

  // Histogram settings - use same dynamic bounds as timeline
  const binSize = 5; // 5-minute bins
  const { startMin: dayStartMin, endMin: dayEndMin, startHour: dayStartHour, endHour: dayEndHour } = getTimeBounds();

  // Create bins per window
  const numBins = Math.ceil((dayEndMin - dayStartMin) / binSize);
  const numWindows = state.windows.length;
  const binsByWindow = Array.from({ length: numWindows }, () => new Array(numBins).fill(0));

  // Fill bins by window
  for (const { time, windowIdx } of samples) {
    const binIdx = Math.floor((time - dayStartMin) / binSize);
    if (binIdx >= 0 && binIdx < numBins) {
      binsByWindow[windowIdx][binIdx]++;
    }
  }

  // Calculate total per bin for stacking
  const binTotals = new Array(numBins).fill(0);
  for (let b = 0; b < numBins; b++) {
    for (let w = 0; w < numWindows; w++) {
      binTotals[b] += binsByWindow[w][b];
    }
  }
  const maxCount = Math.max(...binTotals);

  // SVG dimensions
  const width = 700;
  const height = 100;
  const margin = { left: 45, right: 15, top: 15, bottom: 25 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const barWidth = chartWidth / numBins;

  // Build SVG
  let svg = `<svg width="100%" viewBox="0 0 ${width} ${height}" style="max-width: ${width}px; font-family: system-ui, sans-serif; font-size: 11px;">`;

  // Y-axis label
  svg += `<text x="12" y="${margin.top + chartHeight / 2}" text-anchor="middle" transform="rotate(-90, 12, ${margin.top + chartHeight / 2})" fill="#666" font-size="10">Frequency</text>`;

  // Stacked bars
  for (let b = 0; b < numBins; b++) {
    if (binTotals[b] === 0) continue;

    const x = margin.left + b * barWidth;
    let yOffset = 0;

    // Draw each window's contribution as a stacked segment
    for (let w = 0; w < numWindows; w++) {
      const count = binsByWindow[w][b];
      if (count === 0) continue;

      const segmentHeight = (count / maxCount) * chartHeight;
      const y = margin.top + chartHeight - yOffset - segmentHeight;
      const color = colors[w % colors.length];

      svg += `<rect x="${x}" y="${y}" width="${barWidth - 0.5}" height="${segmentHeight}" fill="${color}"/>`;
      yOffset += segmentHeight;
    }
  }

  // Time axis
  const axisY = margin.top + chartHeight + 15;
  for (let hour = dayStartHour; hour <= dayEndHour; hour += 2) {
    const x = margin.left + ((hour * 60 - dayStartMin) / (dayEndMin - dayStartMin)) * chartWidth;
    const label = formatHourLabel(hour);
    svg += `<line x1="${x}" y1="${margin.top + chartHeight}" x2="${x}" y2="${margin.top + chartHeight + 4}" stroke="#999"/>`;
    svg += `<text x="${x}" y="${axisY}" text-anchor="middle" fill="#666">${label}</text>`;
  }

  // Bottom border
  svg += `<line x1="${margin.left}" y1="${margin.top + chartHeight}" x2="${margin.left + chartWidth}" y2="${margin.top + chartHeight}" stroke="#ccc"/>`;

  svg += `</svg>`;

  container.innerHTML = `
    <div class="text-muted mb-1" style="font-size: 0.85em;">
      <strong>Simulated sample distribution</strong> (10,000 runs × ${state.numDays} days × ${state.windows.length} windows = ${samples.length.toLocaleString()} samples)
    </div>
    ${svg}
  `;
}

// ============================================================================
// STATE
// ============================================================================

const state = {
  // Schedule mode: "simple" or "advanced"
  scheduleMode: "simple",

  // Simple mode parameters
  simpleStartHour: 9,
  simpleStartMin: 0,
  simpleEndHour: 21,  // 9 PM
  simpleEndMin: 0,
  samplesPerDay: 4,
  minGap: 30,

  // Windows (generated from simple mode, or manually edited in advanced mode)
  windows: [],
  dayJitter: 15,  // ±15 minutes

  samples: [],
  parsedProject: null,

  // Form values (defaults)
  startField: "ema_start_at",
  configForm: "ema_setup",
  asiSurveyForm: "ema",
  eventPrefix: "ema",
  deliverAtPrefix: "ema_deliver_at",
  armNum: 1,
  randPrefix: "rand",
  seedField: "seed_input",
  enrollmentEvent: "enrollment",
  fieldNameA: "a",
  fieldNameC: "c",
  fieldNameM: "m",
  asiSender: "noreply@example.edu",
  asiLogic: '[email] <> ""',
  asiSubject: "EMA Survey: [event-name]",
  asiBody: "<p>Please complete your EMA survey:</p>\n<p>[survey-link]</p>",
  numDays: 7
};

// ============================================================================
// SIMPLE MODE HELPERS
// ============================================================================

// Generate windows and jitter from simple mode parameters
function generateWindowsFromSimple() {
  const { simpleStartHour, simpleStartMin, simpleEndHour, simpleEndMin, samplesPerDay, minGap } = state;

  // Jitter is half the gap (eliminates dead zones)
  const jitter = Math.floor(minGap / 2);

  // The user-specified start/end times are the OUTER bounds (no sample should arrive outside).
  // With jitter, the actual windows must be inset by the jitter amount:
  // - First window starts at (start + jitter) so earliest sample (with -jitter) lands at start
  // - Last window ends at (end - jitter) so latest sample (with +jitter) lands at end
  const outerStartMin = simpleStartHour * 60 + simpleStartMin;
  const outerEndMin = simpleEndHour * 60 + simpleEndMin;
  const innerStartMin = outerStartMin + jitter;
  const innerEndMin = outerEndMin - jitter;
  const totalSpan = innerEndMin - innerStartMin;

  if (samplesPerDay < 1 || totalSpan <= 0) {
    state.windows = [];
    state.dayJitter = 0;
    renderSimpleModeSummary(0);
    return;
  }

  // Calculate window duration:
  // totalSpan = (samplesPerDay * windowDuration) + ((samplesPerDay - 1) * minGap)
  // windowDuration = (totalSpan - (samplesPerDay - 1) * minGap) / samplesPerDay
  const totalGapTime = (samplesPerDay - 1) * minGap;
  const windowDuration = Math.floor((totalSpan - totalGapTime) / samplesPerDay);

  if (windowDuration <= 0) {
    state.windows = [];
    state.dayJitter = 0;
    renderSimpleModeSummary(0);
    return;
  }

  // Generate windows starting from the inset start time
  const windows = [];
  let currentStart = innerStartMin;

  for (let i = 0; i < samplesPerDay; i++) {
    const startHour = Math.floor(currentStart / 60);
    const startMinute = currentStart % 60;
    windows.push({
      id: i + 1,
      startHour: startHour,
      startMin: startMinute,
      duration: windowDuration
    });
    currentStart += windowDuration + minGap;
  }

  state.windows = windows;
  state.dayJitter = jitter;

  // Update summary display
  renderSimpleModeSummary(windowDuration);
}

function renderSimpleModeSummary(windowDuration) {
  const container = document.getElementById("simple-mode-summary");
  if (!container) return;

  if (state.windows.length === 0 || windowDuration <= 0) {
    container.innerHTML = `<span style="color: #dc3545;">⚠ Invalid configuration — windows don't fit. Try reducing samples or minimum gap.</span>`;
    return;
  }

  const hours = Math.floor(windowDuration / 60);
  const mins = windowDuration % 60;
  const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  // Show the effective window range (first window start to last window end)
  const firstWindow = state.windows[0];
  const lastWindow = state.windows[state.windows.length - 1];
  const firstStart = firstWindow.startHour * 60 + firstWindow.startMin;
  const lastEnd = lastWindow.startHour * 60 + lastWindow.startMin + lastWindow.duration;

  container.innerHTML = `→ ${state.windows.length} windows × ${durationStr} each, ±${state.dayJitter}min jitter (windows span ${formatTime(firstStart)}–${formatTime(lastEnd)})`;
}

// ============================================================================
// GENERATION FUNCTIONS
// ============================================================================

function generateDataDictionary() {
  const { samples, configForm, startField, randPrefix, seedField,
    deliverAtPrefix, fieldNameA, fieldNameC, fieldNameM, asiSurveyForm, dayJitter, numDays } = state;

  const headers = [
    "Variable / Field Name", "Form Name", "Section Header", "Field Type", "Field Label",
    "Choices, Calculations, OR Slider Labels", "Field Note", "Text Validation Type OR Show Slider Number",
    "Text Validation Min", "Text Validation Max", "Identifier?", "Branching Logic (Show field only if...)",
    "Required Field?", "Custom Alignment", "Question Number (surveys only)", "Matrix Group Name",
    "Matrix Ranking?", "Field Annotation"
  ];

  const rows = [headers];

  // Record ID field (required for new projects)
  rows.push(["record_id", configForm, "", "text", "Record ID", "", "", "", "", "", "", "", "", "", "", "", "", ""]);

  // Seed input field (defaults to record name)
  rows.push([seedField, configForm, "EMA Configuration", "text", "Seed input", "", "Initial seed for random number generator", "integer", "", "", "", "", "", "", "", "", "", `@DEFAULT='[record-name]' @HIDDEN`]);

  // Start date/time field
  rows.push([startField, configForm, "", "text", "EMA start date/time", "", "When EMA sampling begins", "datetime_seconds_ymd", "", "", "", "", "y", "", "", "", "", ""]);

  // LCG constants with hardcoded values
  rows.push([fieldNameA, configForm, "PRNG Constants", "text", "LCG multiplier (a)", "", "", "integer", "", "", "", "", "", "", "", "", "", `@DEFAULT='${LCG_A}' @HIDDEN`]);
  rows.push([fieldNameC, configForm, "", "text", "LCG increment (c)", "", "", "integer", "", "", "", "", "", "", "", "", "", `@DEFAULT='${LCG_C}' @HIDDEN`]);
  rows.push([fieldNameM, configForm, "", "text", "LCG modulus (m)", "", "", "integer", "", "", "", "", "", "", "", "", "", `@DEFAULT='${LCG_M}' @HIDDEN`]);

  // Seed processing field
  rows.push([
    "seed", configForm, "", "calc", "Seed (processed)",
    `mod((([${fieldNameA}] * mod((([${fieldNameA}] * mod((([${fieldNameA}] * [${seedField}]) + [${fieldNameC}]), [${fieldNameM}])) + [${fieldNameC}]), [${fieldNameM}])) + [${fieldNameC}]), [${fieldNameM}])`,
    "", "", "", "", "", "", "", "", "", "", "", "@HIDDEN"
  ]);

  // Track where random number chain starts from
  let lastRandField = "seed";

  // Day jitter fields (if jitter is enabled)
  // dayJitter is stored as ± value, so total range is 2 * dayJitter
  if (dayJitter > 0) {
    const jitterRange = dayJitter * 2;

    // Generate one jitter random number per day
    for (let day = 1; day <= numDays; day++) {
      const dayPadded = String(day).padStart(2, '0');
      const jitterRandField = `${randPrefix}_jitter_d${dayPadded}`;
      rows.push([
        jitterRandField, configForm, day === 1 ? "Day Jitter Random Numbers" : "", "calc",
        `Jitter Random Day ${dayPadded}`,
        `mod((([${fieldNameA}] * [${lastRandField}]) + [${fieldNameC}]), [${fieldNameM}])`,
        "", "", "", "", "", "", "", "", "", "", "", "@HIDDEN"
      ]);
      lastRandField = jitterRandField;
    }

    // Generate jitter offset calc fields (one per day)
    for (let day = 1; day <= numDays; day++) {
      const dayPadded = String(day).padStart(2, '0');
      const jitterRandField = `${randPrefix}_jitter_d${dayPadded}`;
      const jitterOffsetField = `jitter_offset_d${dayPadded}`;
      rows.push([
        jitterOffsetField, configForm, day === 1 ? "Day Jitter Offsets" : "", "calc",
        `Jitter Offset Day ${dayPadded}`,
        `mod([${jitterRandField}], ${jitterRange}) - ${dayJitter}`,
        "", "", "", "", "", "", "", "", "", "", "", "@HIDDEN"
      ]);
    }
  }

  // Random number fields for samples (chain continues from last jitter field or seed)
  samples.forEach((sample, idx) => {
    const randField = `${randPrefix}_${String(idx + 1).padStart(2, '0')}`;
    const prevField = idx === 0 ? lastRandField : `${randPrefix}_${String(idx).padStart(2, '0')}`;
    rows.push([
      randField, configForm, idx === 0 ? "Random Numbers" : "", "calc",
      `Random ${String(idx + 1).padStart(2, '0')}`,
      `mod((([${fieldNameA}] * [${prevField}]) + [${fieldNameC}]), [${fieldNameM}])`,
      "", "", "", "", "", "", "", "", "", "", "", "@HIDDEN"
    ]);
  });

  // Deliver-at fields
  samples.forEach((sample, idx) => {
    const dayPadded = String(sample.day).padStart(2, '0');
    const samplePadded = String(sample.sample).padStart(2, '0');
    const fieldName = `${deliverAtPrefix}_d${dayPadded}_s${samplePadded}`;
    const randField = `${randPrefix}_${String(idx + 1).padStart(2, '0')}`;
    const dayOffset = sample.day - 1;

    // Include jitter offset if enabled
    let calcAnnotation;
    if (dayJitter > 0) {
      const jitterOffsetField = `jitter_offset_d${dayPadded}`;
      calcAnnotation = `@CALCDATE([${startField}], (${dayOffset} * 1440) + ${sample.startMinutes} + [${jitterOffsetField}] + mod([${randField}], ${sample.duration}), 'm')`;
    } else {
      calcAnnotation = `@CALCDATE([${startField}], (${dayOffset} * 1440) + ${sample.startMinutes} + mod([${randField}], ${sample.duration}), 'm')`;
    }

    rows.push([
      fieldName, configForm, idx === 0 ? "EMA Schedule" : "", "text",
      `Day ${sample.day} Sample ${sample.sample}`, "", "", "datetime_seconds_ymd",
      "", "", "", "", "", "", "", "", "", calcAnnotation
    ]);
  });

  // Placeholder EMA survey form
  rows.push([`${asiSurveyForm}_placeholder`, asiSurveyForm, "", "descriptive", "<div class=\"rich-text-field-label\"><p>Add your EMA survey questions here.</p></div>", "", "", "", "", "", "", "", "", "", "", "", "", ""]);

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function generateEvents() {
  const { samples, eventPrefix, armNum, enrollmentEvent } = state;

  const headers = ["event_name", "arm_num", "unique_event_name", "custom_event_label"];
  const rows = [headers];
  rows.push([enrollmentEvent, armNum, `${enrollmentEvent}_arm_${armNum}`, ""]);

  const seenEvents = new Set();
  samples.forEach(sample => {
    const dayPadded = String(sample.day).padStart(2, '0');
    const samplePadded = String(sample.sample).padStart(2, '0');
    const eventName = `${eventPrefix}_d${dayPadded}_s${samplePadded}`;
    if (!seenEvents.has(eventName)) {
      seenEvents.add(eventName);
      rows.push([eventName, armNum, `${eventName}_arm_${armNum}`, ""]);
    }
  });

  return rows.map(row => row.join(",")).join("\n");
}

function generateEventMappings() {
  const { samples, eventPrefix, armNum, enrollmentEvent, configForm, asiSurveyForm } = state;

  const headers = ["arm_num", "unique_event_name", "form"];
  const rows = [headers];
  rows.push([armNum, `${enrollmentEvent}_arm_${armNum}`, configForm]);

  const seenEvents = new Set();
  samples.forEach(sample => {
    const dayPadded = String(sample.day).padStart(2, '0');
    const samplePadded = String(sample.sample).padStart(2, '0');
    const eventName = `${eventPrefix}_d${dayPadded}_s${samplePadded}`;
    if (!seenEvents.has(eventName)) {
      seenEvents.add(eventName);
      rows.push([armNum, `${eventName}_arm_${armNum}`, asiSurveyForm]);
    }
  });

  return rows.map(row => row.join(",")).join("\n");
}

function generateASIs() {
  const { samples, eventPrefix, armNum, enrollmentEvent, deliverAtPrefix,
    asiSurveyForm, asiLogic, asiSender, asiSubject, asiBody } = state;

  const headers = [
    "form_name", "event_name", "condition_surveycomplete_form_name", "condition_surveycomplete_event_name",
    "num_recurrence", "units_recurrence", "max_recurrence", "active", "email_subject", "email_content",
    "email_sender", "email_sender_display", "condition_andor", "condition_logic", "condition_send_time_option",
    "condition_send_time_lag_days", "condition_send_time_lag_hours", "condition_send_time_lag_minutes",
    "condition_send_time_lag_field", "condition_send_time_lag_field_after", "condition_send_next_day_type",
    "condition_send_next_time", "condition_send_time_exact", "delivery_type", "reminder_type",
    "reminder_timelag_days", "reminder_timelag_hours", "reminder_timelag_minutes", "reminder_nextday_type",
    "reminder_nexttime", "reminder_exact_time", "reminder_num", "reeval_before_send"
  ];

  const rows = [headers];
  const enrollEventName = `${enrollmentEvent}_arm_${armNum}`;

  samples.forEach(sample => {
    const dayPadded = String(sample.day).padStart(2, '0');
    const samplePadded = String(sample.sample).padStart(2, '0');
    const eventName = `${eventPrefix}_d${dayPadded}_s${samplePadded}_arm_${armNum}`;
    const deliverField = `[${enrollEventName}][${deliverAtPrefix}_d${dayPadded}_s${samplePadded}]`;

    // Add event prefix to logic if needed
    let logicWithEvent = asiLogic;
    if (asiLogic.includes("[") && !asiLogic.includes(`[${enrollEventName}]`)) {
      logicWithEvent = asiLogic.replace(/\[([^\]]+)\]/g, `[${enrollEventName}][$1]`);
    }

    rows.push([
      asiSurveyForm, eventName, "", "", "0", "DAYS", "", "1",
      asiSubject, asiBody, asiSender, "", "AND", logicWithEvent,
      "TIME_LAG", "0", "0", "0", deliverField, "after", "", "", "",
      "EMAIL", "", "", "", "", "", "", "", "0", "1"
    ]);
  });

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

// ============================================================================
// XML PARSING
// ============================================================================

function parseRedcapXml(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  const studyName = doc.querySelector("StudyName")?.textContent || "Unknown Project";

  const forms = [];
  doc.querySelectorAll("FormDef").forEach(form => {
    forms.push({
      oid: form.getAttribute("OID"),
      name: form.getAttribute("redcap:FormName") || form.getAttribute("Name"),
      label: form.getAttribute("Name")
    });
  });

  const events = [];
  doc.querySelectorAll("StudyEventDef").forEach(event => {
    events.push({
      oid: event.getAttribute("OID"),
      name: event.getAttribute("redcap:EventName"),
      uniqueName: event.getAttribute("redcap:UniqueEventName"),
      armNum: event.getAttribute("redcap:ArmNum")
    });
  });

  const fields = [];
  doc.querySelectorAll("ItemDef").forEach(item => {
    fields.push({
      name: item.getAttribute("redcap:Variable") || item.getAttribute("Name"),
      type: item.getAttribute("redcap:FieldType"),
      annotation: item.getAttribute("redcap:FieldAnnotation") || "",
      calculation: item.getAttribute("redcap:Calculation") || ""
    });
  });

  const emaFields = fields.filter(f =>
    f.annotation.includes("@CALCDATE") && f.name.match(/_d\d+_s\d+$/)
  );

  return { projectName: studyName, forms, events, fields, emaFields };
}

// ============================================================================
// UI HELPERS
// ============================================================================

function formatTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h}:${String(min).padStart(2, '0')} ${ampm}`;
}

function formatTimeFromHourMin(hour, min) {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h}:${String(min).padStart(2, '0')} ${ampm}`;
}

// ============================================================================
// UI RENDERING
// ============================================================================

// Format hour label, handling times past midnight
function formatHourLabel(hour) {
  // Normalize to 0-23 range (handles negative hours and hours >= 24)
  const normalizedHour = ((hour % 24) + 24) % 24;
  if (normalizedHour === 0) return "12a";
  if (normalizedHour === 12) return "12p";
  if (normalizedHour > 12) return `${normalizedHour - 12}p`;
  return `${normalizedHour}a`;
}

// Calculate dynamic time bounds based on windows (with ~1 hour padding, on hour boundaries)
function getTimeBounds() {
  const { windows, dayJitter } = state;
  if (windows.length === 0) return { startMin: 6 * 60, endMin: 23 * 60 };

  let earliest = Infinity;
  let latest = -Infinity;

  for (const w of windows) {
    const start = w.startHour * 60 + w.startMin;
    const end = start + w.duration;
    // Account for jitter
    earliest = Math.min(earliest, start - dayJitter);
    latest = Math.max(latest, end + dayJitter);
  }

  // Round to hour boundaries with ~1 hour padding
  const startHour = Math.floor(earliest / 60) - 1;
  const endHour = Math.ceil(latest / 60) + 1;

  return {
    startMin: startHour * 60,
    endMin: endHour * 60,
    startHour,
    endHour
  };
}

function renderTimeline() {
  const container = document.getElementById("timeline-container");
  if (!container) return;

  if (state.windows.length === 0) {
    container.innerHTML = "";
    return;
  }

  // Dynamic timeline bounds
  const { startMin: dayStartMin, endMin: dayEndMin, startHour: dayStartHour, endHour: dayEndHour } = getTimeBounds();
  const dayDuration = dayEndMin - dayStartMin;

  const width = 700;
  const height = 80;
  const margin = { left: 45, right: 15, top: 25, bottom: 25 };
  const trackHeight = 30;
  const trackY = margin.top;

  // Convert minutes to x position
  const minToX = (min) => {
    const clamped = Math.max(dayStartMin, Math.min(dayEndMin, min));
    return margin.left + ((clamped - dayStartMin) / dayDuration) * (width - margin.left - margin.right);
  };

  // Build window data with jitter
  const jitter = state.dayJitter;
  const windowData = state.windows.map((w, idx) => {
    const start = w.startHour * 60 + w.startMin;
    const end = start + w.duration;
    return {
      idx,
      start,
      end,
      jitterStart: start - jitter,
      jitterEnd: end + jitter
    };
  }).sort((a, b) => a.start - b.start);

  // Find dead zones and overlaps
  const issues = [];
  for (let i = 0; i < windowData.length - 1; i++) {
    const current = windowData[i];
    const next = windowData[i + 1];

    // Check for overlap (using jittered bounds)
    if (current.jitterEnd > next.jitterStart) {
      issues.push({
        type: "overlap",
        start: next.jitterStart,
        end: current.jitterEnd
      });
    }
    // Check for dead zone (gap not covered by jitter)
    else if (current.jitterEnd < next.jitterStart) {
      issues.push({
        type: "deadzone",
        start: current.jitterEnd,
        end: next.jitterStart
      });
    }
  }

  // Color palette for windows
  const colors = ["#4e79a7", "#59a14f", "#edc949", "#e15759", "#76b7b2", "#f28e2b"];

  // Build SVG
  let svg = `<svg width="100%" viewBox="0 0 ${width} ${height}" style="max-width: ${width}px; font-family: system-ui, sans-serif; font-size: 11px;">`;

  // Background track
  svg += `<rect x="${margin.left}" y="${trackY}" width="${width - margin.left - margin.right}" height="${trackHeight}" fill="#f0f0f0" rx="3"/>`;

  // Dead zones (red, behind windows)
  issues.filter(i => i.type === "deadzone").forEach(issue => {
    const x1 = minToX(issue.start);
    const x2 = minToX(issue.end);
    svg += `<rect x="${x1}" y="${trackY}" width="${x2 - x1}" height="${trackHeight}" fill="#ffcccc" stroke="#ff6666" stroke-width="1" stroke-dasharray="3,2"/>`;
  });

  // Jitter extensions (lighter, behind main windows)
  if (jitter > 0) {
    windowData.forEach((w, i) => {
      const color = colors[i % colors.length];
      // Left jitter extension
      const jx1 = minToX(w.jitterStart);
      const x1 = minToX(w.start);
      if (jx1 < x1) {
        svg += `<rect x="${jx1}" y="${trackY}" width="${x1 - jx1}" height="${trackHeight}" fill="${color}" opacity="0.25"/>`;
      }
      // Right jitter extension
      const x2 = minToX(w.end);
      const jx2 = minToX(w.jitterEnd);
      if (jx2 > x2) {
        svg += `<rect x="${x2}" y="${trackY}" width="${jx2 - x2}" height="${trackHeight}" fill="${color}" opacity="0.25"/>`;
      }
    });
  }

  // Main windows
  windowData.forEach((w, i) => {
    const x1 = minToX(w.start);
    const x2 = minToX(w.end);
    const color = colors[i % colors.length];
    svg += `<rect x="${x1}" y="${trackY}" width="${x2 - x1}" height="${trackHeight}" fill="${color}" rx="2"/>`;
    // Window number label
    const cx = (x1 + x2) / 2;
    svg += `<text x="${cx}" y="${trackY + trackHeight/2 + 4}" text-anchor="middle" fill="white" font-weight="bold">${w.idx + 1}</text>`;
  });

  // Overlap indicators (on top)
  issues.filter(i => i.type === "overlap").forEach(issue => {
    const x1 = minToX(issue.start);
    const x2 = minToX(issue.end);
    svg += `<rect x="${x1}" y="${trackY}" width="${x2 - x1}" height="${trackHeight}" fill="none" stroke="#cc0000" stroke-width="2"/>`;
    // Hatching pattern for overlap
    svg += `<pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6"><path d="M0,6 L6,0" stroke="#cc0000" stroke-width="1"/></pattern>`;
    svg += `<rect x="${x1}" y="${trackY}" width="${x2 - x1}" height="${trackHeight}" fill="url(#hatch)"/>`;
  });

  // Time axis
  const axisY = trackY + trackHeight + 15;
  for (let hour = dayStartHour; hour <= dayEndHour; hour += 2) {
    const x = minToX(hour * 60);
    const label = formatHourLabel(hour);
    svg += `<line x1="${x}" y1="${trackY + trackHeight}" x2="${x}" y2="${trackY + trackHeight + 4}" stroke="#999"/>`;
    svg += `<text x="${x}" y="${axisY}" text-anchor="middle" fill="#666">${label}</text>`;
  }

  // Legend
  let legendHtml = "";
  if (issues.some(i => i.type === "deadzone")) {
    legendHtml += `<span style="color: #cc4444; font-size: 0.85em;">⚠ Dead zone detected</span> `;
  }
  if (issues.some(i => i.type === "overlap")) {
    legendHtml += `<span style="color: #cc0000; font-size: 0.85em;">⚠ Overlap detected</span> `;
  }
  if (jitter > 0 && issues.length === 0) {
    legendHtml += `<span style="color: #666; font-size: 0.85em;">✓ Full coverage with jitter</span>`;
  }

  svg += `</svg>`;

  container.innerHTML = svg + (legendHtml ? `<div class="mt-1">${legendHtml}</div>` : "");
}

function renderWindows() {
  const container = document.getElementById("windows-container");
  if (!container) return;

  container.innerHTML = `
    <table class="table table-striped">
      <thead>
        <tr>
          <th>#</th>
          <th>Window Start</th>
          <th>Duration</th>
          <th>Window End</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="windows-tbody"></tbody>
    </table>
  `;

  const tbody = document.getElementById("windows-tbody");

  state.windows.forEach((window, idx) => {
    const startMinutes = window.startHour * 60 + window.startMin;
    const endMinutes = startMinutes + window.duration;
    const endHour = Math.floor(endMinutes / 60);
    const endMin = endMinutes % 60;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="text-muted">${idx + 1}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 4px;">
          <input type="number" class="form-control form-control-sm" style="width: 65px"
            value="${window.startHour}" min="0" max="23" data-idx="${idx}" data-field="startHour">
          <span>:</span>
          <input type="number" class="form-control form-control-sm" style="width: 65px"
            value="${window.startMin}" min="0" max="59" step="5" data-idx="${idx}" data-field="startMin">
        </div>
      </td>
      <td>
        <input type="number" class="form-control form-control-sm" style="width: 80px"
          value="${window.duration}" min="1" data-idx="${idx}" data-field="duration"> min
      </td>
      <td class="text-muted">${formatTimeFromHourMin(endHour, endMin)}</td>
      <td>
        <button class="btn btn-outline-danger btn-sm remove-window-btn" data-idx="${idx}" title="Remove window">&times;</button>
      </td>
    `;

    tbody.appendChild(row);
  });

  // Wire up event listeners for window inputs
  tbody.querySelectorAll("input").forEach(input => {
    input.addEventListener("change", () => {
      const idx = parseInt(input.dataset.idx);
      const field = input.dataset.field;
      state.windows[idx][field] = parseInt(input.value) || 0;
      renderWindows();
    });
  });

  // Wire up remove buttons
  tbody.querySelectorAll(".remove-window-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      state.windows.splice(idx, 1);
      renderWindows();
    });
  });

  // Update visualizations
  renderTimeline();
  renderHistogram();

  // Auto-generate samples when windows are defined
  autoGenerateSamples();
  renderFieldReference();
  renderDownloads();
}

function renderSamples() {
  const container = document.getElementById("samples-container");
  if (!container) return;

  if (state.samples.length === 0) {
    container.innerHTML = `<p class="text-muted">No samples defined yet. Click "Generate Schedule" above or import a project XML.</p>`;
    renderDownloads();
    return;
  }

  const totalDays = Math.max(...state.samples.map(s => s.day));
  const hasJitter = state.dayJitter > 0;

  let summaryHtml = `<p class="text-muted"><strong>${state.samples.length}</strong> samples across <strong>${totalDays}</strong> days</p>`;
  if (hasJitter) {
    summaryHtml += `<p class="text-muted">Day jitter: ±${state.dayJitter} minutes (windows shift randomly each day)</p>`;
  }

  container.innerHTML = `
    <table class="table table-sm table-hover">
      <thead>
        <tr>
          <th>Day</th>
          <th>Sample</th>
          <th>Field Name</th>
          <th>Window${hasJitter ? ' (base)' : ''}</th>
          ${hasJitter ? '<th>With Jitter</th>' : ''}
          <th></th>
        </tr>
      </thead>
      <tbody id="samples-tbody"></tbody>
    </table>
    ${summaryHtml}
  `;

  const tbody = document.getElementById("samples-tbody");

  state.samples.forEach((sample, idx) => {
    const dayPadded = String(sample.day).padStart(2, '0');
    const samplePadded = String(sample.sample).padStart(2, '0');
    const fieldName = `${state.deliverAtPrefix}_d${dayPadded}_s${samplePadded}`;
    const endMinutes = sample.startMinutes + sample.duration;

    let jitterCol = '';
    if (hasJitter) {
      const jitterStart = sample.startMinutes - state.dayJitter;
      const jitterEnd = endMinutes + state.dayJitter;
      jitterCol = `<td class="text-muted">${formatTime(jitterStart)} – ${formatTime(jitterEnd)}</td>`;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${sample.day}</td>
      <td>${sample.sample}</td>
      <td><code style="font-size: 0.85em;">${fieldName}</code></td>
      <td class="text-muted">${formatTime(sample.startMinutes)} – ${formatTime(endMinutes)}</td>
      ${jitterCol}
      <td>
        <button class="btn btn-outline-danger btn-sm remove-sample-btn" data-idx="${idx}" title="Remove sample">&times;</button>
      </td>
    `;

    tbody.appendChild(row);
  });

  // Wire up remove buttons
  tbody.querySelectorAll(".remove-sample-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      state.samples.splice(idx, 1);
      renderSamples();
    });
  });

  renderDownloads();
}

function renderFieldReference() {
  const container = document.getElementById("field-reference-container");
  if (!container) return;

  if (state.windows.length === 0) {
    container.innerHTML = `<p class="text-muted">Configure sampling windows to see field definitions.</p>`;
    return;
  }

  const { configForm, startField, randPrefix, seedField,
    deliverAtPrefix, fieldNameA, fieldNameC, fieldNameM, asiSurveyForm, dayJitter, numDays } = state;

  const fields = [];

  // Core setup fields
  fields.push({
    name: "record_id",
    description: "Record ID",
    type: "text",
    calculation: "",
    annotation: ""
  });

  fields.push({
    name: seedField,
    description: "Seed input",
    type: "text",
    calculation: "",
    annotation: "@DEFAULT='[record-name]' @HIDDEN"
  });

  fields.push({
    name: startField,
    description: "EMA start date/time",
    type: "text (datetime)",
    calculation: "",
    annotation: ""
  });

  // LCG constants
  fields.push({
    name: fieldNameA,
    description: "LCG multiplier (a)",
    type: "text",
    calculation: "",
    annotation: `@DEFAULT='${LCG_A}' @HIDDEN`
  });

  fields.push({
    name: fieldNameC,
    description: "LCG increment (c)",
    type: "text",
    calculation: "",
    annotation: `@DEFAULT='${LCG_C}' @HIDDEN`
  });

  fields.push({
    name: fieldNameM,
    description: "LCG modulus (m)",
    type: "text",
    calculation: "",
    annotation: `@DEFAULT='${LCG_M}' @HIDDEN`
  });

  // Processed seed
  fields.push({
    name: "seed",
    description: "Seed (processed)",
    type: "calc",
    calculation: `mod((a × mod((a × mod((a × ${seedField}) + c, m) + c, m) + c, m)`,
    annotation: "@HIDDEN"
  });

  // Day jitter fields (if enabled)
  if (dayJitter > 0) {
    fields.push({
      name: `${randPrefix}_jitter_d01...d${String(numDays).padStart(2, '0')}`,
      description: `Jitter random numbers (${numDays} fields)`,
      type: "calc",
      calculation: "mod((a × [prev_rand]) + c, m)",
      annotation: "@HIDDEN"
    });

    fields.push({
      name: `jitter_offset_d01...d${String(numDays).padStart(2, '0')}`,
      description: `Jitter offset in minutes (${numDays} fields)`,
      type: "calc",
      calculation: `mod([rand], ${dayJitter * 2}) - ${dayJitter}`,
      annotation: "@HIDDEN"
    });
  }

  // Random number fields for samples
  const totalSamples = numDays * state.windows.length;
  fields.push({
    name: `${randPrefix}_01...${String(totalSamples).padStart(2, '0')}`,
    description: `Sample random numbers (${totalSamples} fields)`,
    type: "calc",
    calculation: "mod((a × [prev_rand]) + c, m)",
    annotation: "@HIDDEN"
  });

  // Deliver-at fields
  const sampleDesc = state.windows.length > 1
    ? `s01...s${String(state.windows.length).padStart(2, '0')}`
    : "s01";
  fields.push({
    name: `${deliverAtPrefix}_d01_${sampleDesc}...d${String(numDays).padStart(2, '0')}_${sampleDesc}`,
    description: `Scheduled delivery times (${totalSamples} fields)`,
    type: "text (datetime)",
    calculation: dayJitter > 0
      ? "@CALCDATE([start], days + window_start + jitter + random_offset, 'm')"
      : "@CALCDATE([start], days + window_start + random_offset, 'm')",
    annotation: ""
  });

  // Survey placeholder
  fields.push({
    name: `${asiSurveyForm}_placeholder`,
    description: "Survey form placeholder",
    type: "descriptive",
    calculation: "",
    annotation: ""
  });

  // Render table
  let html = `
    <table class="table table-sm" style="font-size: 0.85em;">
      <thead>
        <tr>
          <th>Field Name</th>
          <th>Description</th>
          <th>Type</th>
          <th>Calculation</th>
          <th>Annotation</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const field of fields) {
    html += `
      <tr>
        <td><code>${escapeHtml(field.name)}</code></td>
        <td>${escapeHtml(field.description)}</td>
        <td>${escapeHtml(field.type)}</td>
        <td><code style="font-size: 0.9em;">${escapeHtml(field.calculation) || "—"}</code></td>
        <td><code style="font-size: 0.9em;">${escapeHtml(field.annotation) || "—"}</code></td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
    <p class="text-muted" style="font-size: 0.85em;">
      Total: <strong>${6 + (dayJitter > 0 ? numDays * 2 : 0) + totalSamples * 2 + 1}</strong> fields
      on form <code>${configForm}</code>, plus placeholder on <code>${asiSurveyForm}</code>
    </p>
  `;

  container.innerHTML = html;
}

function renderDownloads() {
  const container = document.getElementById("download-buttons");
  if (!container) return;

  if (state.samples.length === 0) {
    container.innerHTML = `<div class="alert alert-warning">Configure sampling windows in Step 3 to enable downloads.</div>`;
    renderPreview();
    return;
  }

  container.innerHTML = "";

  // ZIP button
  const zipBtn = document.createElement("button");
  zipBtn.className = "btn btn-primary me-2";
  zipBtn.innerHTML = "<strong>Download All (ZIP)</strong>";
  zipBtn.addEventListener("click", downloadZip);
  container.appendChild(zipBtn);

  // Individual file buttons
  const files = [
    { name: "Data Dictionary", filename: "data_dictionary.csv", generator: generateDataDictionary },
    { name: "Events", filename: "events.csv", generator: generateEvents },
    { name: "Event Mappings", filename: "event_mappings.csv", generator: generateEventMappings },
    { name: "ASIs", filename: "asi_list.csv", generator: generateASIs }
  ];

  files.forEach(file => {
    const btn = document.createElement("button");
    btn.className = "btn btn-outline-secondary me-2";
    btn.textContent = file.name;
    btn.addEventListener("click", () => downloadFile(file.filename, file.generator()));
    container.appendChild(btn);
  });

  renderPreview();
}

function renderPreview() {
  const container = document.getElementById("preview-container");
  if (!container) return;

  if (state.samples.length === 0) {
    container.innerHTML = "";
    return;
  }

  const selectedTab = document.querySelector('input[name="preview-tab"]:checked')?.value || "dictionary";

  const outputs = {
    "dictionary": { name: "Data Dictionary", data: generateDataDictionary() },
    "events": { name: "Events", data: generateEvents() },
    "mappings": { name: "Event Mappings", data: generateEventMappings() },
    "asis": { name: "ASIs", data: generateASIs() }
  };

  const content = outputs[selectedTab].data;
  const lines = content.split("\n");
  const lineCount = lines.length;

  container.innerHTML = `
    <div style="position: relative;">
      <div style="position: absolute; top: 8px; right: 8px; font-size: 0.8em; color: var(--bs-secondary);">
        ${lineCount} rows
      </div>
      <pre style="max-height: 400px; overflow: auto; background: var(--bs-light); padding: 1rem; border-radius: 8px; font-size: 0.75em; white-space: pre-wrap; word-break: break-all;">${escapeHtml(content)}</pre>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function renderProjectInfo() {
  const container = document.getElementById("project-info");
  if (!container) return;

  if (state.parsedProject) {
    container.innerHTML = `
      <div class="callout callout-tip">
        <strong>Loaded:</strong> ${escapeHtml(state.parsedProject.projectName)}<br>
        <small>${state.parsedProject.forms.length} forms, ${state.parsedProject.events.length} events, ${state.parsedProject.emaFields.length} existing EMA fields detected</small>
      </div>
    `;
  } else {
    container.innerHTML = "";
  }
}

// ============================================================================
// DOWNLOAD FUNCTIONS
// ============================================================================

function downloadFile(filename, content) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadZip() {
  const zip = new JSZip();
  zip.file("data_dictionary.csv", generateDataDictionary());
  zip.file("events.csv", generateEvents());
  zip.file("event_mappings.csv", generateEventMappings());
  zip.file("asi_list.csv", generateASIs());

  zip.generateAsync({ type: "blob" }).then(blob => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "ema_schedule.zip";
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function handleXmlImport(file) {
  if (!file) return;

  file.text().then(text => {
    const project = parseRedcapXml(text);
    state.parsedProject = project;

    // If we found EMA fields, parse them into samples
    if (project.emaFields.length > 0) {
      const parsedSamples = [];

      project.emaFields.forEach((field, idx) => {
        // Parse field name like "ema_deliver_at_d01_s02" or "deliver_at_d01_s02"
        const nameMatch = field.name.match(/_d(\d+)_s(\d+)$/);
        if (!nameMatch) return;

        const day = parseInt(nameMatch[1]);
        const sample = parseInt(nameMatch[2]);

        // Parse @CALCDATE annotation to extract timing
        // Pattern: @CALCDATE([field], (X * 1440) + START + mod([rand], DURATION), 'm')
        const calcMatch = field.annotation.match(/@CALCDATE\([^,]+,\s*\((\d+)\s*\*\s*1440\)\s*\+\s*(\d+)\s*\+\s*mod\([^,]+,\s*(\d+)\)/);

        let startMinutes = 540; // default 9 AM
        let duration = 90; // default 90 min

        if (calcMatch) {
          startMinutes = parseInt(calcMatch[2]);
          duration = parseInt(calcMatch[3]);
        }

        parsedSamples.push({
          id: idx + 1,
          day,
          sample,
          windowIdx: (sample - 1) % 10, // rough guess
          startMinutes,
          duration
        });
      });

      // Sort by day then sample
      parsedSamples.sort((a, b) => a.day - b.day || a.sample - b.sample);

      if (parsedSamples.length > 0) {
        state.samples = parsedSamples;
      }
    }

    renderProjectInfo();
    renderFieldReference();
    renderDownloads();
  });
}

function autoGenerateSamples() {
  if (state.windows.length === 0) {
    state.samples = [];
    return;
  }

  const newSamples = [];
  let sampleNum = 1;

  for (let day = 1; day <= state.numDays; day++) {
    // One sample per window
    state.windows.forEach((window, windowIdx) => {
      newSamples.push({
        id: sampleNum++,
        day: day,
        sample: windowIdx + 1,
        windowIdx: windowIdx,
        startMinutes: window.startHour * 60 + window.startMin,
        duration: window.duration
      });
    });
  }

  state.samples = newSamples;
}

function handleAddWindow() {
  const maxId = Math.max(0, ...state.windows.map(w => w.id));
  // Default to adding a window after the last one, or 9:00 if no windows
  const lastWindow = state.windows[state.windows.length - 1];
  let newStartHour = 9;
  let newStartMin = 0;
  if (lastWindow) {
    const lastEnd = lastWindow.startHour * 60 + lastWindow.startMin + lastWindow.duration + 30; // 30 min gap
    newStartHour = Math.floor(lastEnd / 60);
    newStartMin = lastEnd % 60;
  }
  state.windows.push({ id: maxId + 1, startHour: newStartHour, startMin: newStartMin, duration: 150 });
  renderWindows();
}

function handleModeSwitch(mode) {
  if (mode === state.scheduleMode) return;

  state.scheduleMode = mode;

  if (mode === "simple") {
    // Regenerate windows from simple params (discards any manual edits)
    generateWindowsFromSimple();
  }

  renderScheduleMode();
  renderWindows();
}

function handleSimpleParamChange() {
  generateWindowsFromSimple();
  renderWindows();
}

function renderScheduleMode() {
  const simpleSection = document.getElementById("simple-mode-section");
  const advancedSection = document.getElementById("advanced-mode-section");
  const simpleModeBtn = document.getElementById("simple-mode-btn");
  const advancedModeBtn = document.getElementById("advanced-mode-btn");

  if (!simpleSection || !advancedSection) return;

  if (state.scheduleMode === "simple") {
    simpleSection.style.display = "block";
    advancedSection.style.display = "none";
    simpleModeBtn?.classList.add("active");
    advancedModeBtn?.classList.remove("active");
  } else {
    simpleSection.style.display = "none";
    advancedSection.style.display = "block";
    simpleModeBtn?.classList.remove("active");
    advancedModeBtn?.classList.add("active");
  }
}

function bindSimpleModeInputs() {
  // Helper to bind time inputs (hour:minute pairs)
  const bindTimeInput = (hourId, minId, hourKey, minKey) => {
    const hourEl = document.getElementById(hourId);
    const minEl = document.getElementById(minId);
    if (hourEl) {
      hourEl.value = state[hourKey];
      hourEl.addEventListener("input", () => {
        state[hourKey] = parseInt(hourEl.value) || 0;
        handleSimpleParamChange();
      });
    }
    if (minEl) {
      minEl.value = state[minKey];
      minEl.addEventListener("input", () => {
        state[minKey] = parseInt(minEl.value) || 0;
        handleSimpleParamChange();
      });
    }
  };

  bindTimeInput("simple-start-hour", "simple-start-min", "simpleStartHour", "simpleStartMin");
  bindTimeInput("simple-end-hour", "simple-end-min", "simpleEndHour", "simpleEndMin");

  const samplesEl = document.getElementById("samples-per-day");
  if (samplesEl) {
    samplesEl.value = state.samplesPerDay;
    samplesEl.addEventListener("input", () => {
      state.samplesPerDay = parseInt(samplesEl.value) || 1;
      handleSimpleParamChange();
    });
  }

  const minGapEl = document.getElementById("min-gap");
  if (minGapEl) {
    minGapEl.value = state.minGap;
    minGapEl.addEventListener("input", () => {
      state.minGap = parseInt(minGapEl.value) || 0;
      handleSimpleParamChange();
    });
  }

  // Mode toggle buttons
  const simpleModeBtn = document.getElementById("simple-mode-btn");
  const advancedModeBtn = document.getElementById("advanced-mode-btn");

  if (simpleModeBtn) {
    simpleModeBtn.addEventListener("click", () => handleModeSwitch("simple"));
  }
  if (advancedModeBtn) {
    advancedModeBtn.addEventListener("click", () => handleModeSwitch("advanced"));
  }
}

// ============================================================================
// FORM BINDING
// ============================================================================

function bindFormInput(elementId, stateKey, transform = v => v) {
  const el = document.getElementById(elementId);
  if (!el) return;

  // Set initial value from state
  el.value = state[stateKey];

  el.addEventListener("input", () => {
    state[stateKey] = transform(el.value);
    // Re-render UI if relevant fields change
    if (stateKey === "deliverAtPrefix") {
      renderFieldReference();
      renderDownloads();
    }
    if (stateKey === "dayJitter") {
      renderTimeline();
      renderHistogram();
      autoGenerateSamples();
      renderFieldReference();
      renderDownloads();
    }
    if (stateKey === "numDays") {
      renderHistogram();
      autoGenerateSamples();
      renderFieldReference();
      renderDownloads();
    }
  });
}

function bindNumericInput(elementId, stateKey) {
  bindFormInput(elementId, stateKey, v => parseInt(v) || 0);
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export function init() {
  // Bind all form inputs to state
  bindFormInput("start-field", "startField");
  bindFormInput("config-form", "configForm");
  bindFormInput("asi-survey-form", "asiSurveyForm");
  bindFormInput("event-prefix", "eventPrefix");
  bindFormInput("deliver-at-prefix", "deliverAtPrefix");
  bindNumericInput("arm-num", "armNum");
  bindFormInput("rand-prefix", "randPrefix");
  bindFormInput("seed-field", "seedField");
  bindFormInput("enrollment-event", "enrollmentEvent");
  bindFormInput("field-name-a", "fieldNameA");
  bindFormInput("field-name-c", "fieldNameC");
  bindFormInput("field-name-m", "fieldNameM");
  bindFormInput("asi-sender", "asiSender");
  bindFormInput("asi-logic", "asiLogic");
  bindFormInput("asi-subject", "asiSubject");
  bindFormInput("asi-body", "asiBody");
  bindNumericInput("num-days", "numDays");
  bindNumericInput("day-jitter", "dayJitter");

  // Simple mode inputs
  bindSimpleModeInputs();

  // XML file import
  const xmlInput = document.getElementById("xml-file");
  if (xmlInput) {
    xmlInput.addEventListener("change", (e) => {
      handleXmlImport(e.target.files[0]);
    });
  }

  // Add window button
  const addWindowBtn = document.getElementById("add-window-btn");
  if (addWindowBtn) {
    addWindowBtn.addEventListener("click", handleAddWindow);
  }

  // Preview tabs
  document.querySelectorAll('input[name="preview-tab"]').forEach(radio => {
    radio.addEventListener("change", renderPreview);
  });

  // Generate initial windows from simple mode defaults
  generateWindowsFromSimple();

  // Initial render
  renderScheduleMode();
  renderWindows();  // This also auto-generates samples and renders field reference
}
