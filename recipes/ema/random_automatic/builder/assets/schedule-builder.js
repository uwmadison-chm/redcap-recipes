// ============================================================================
// EMA Schedule Builder - Vanilla JS Module
// ============================================================================

// LCG constants (Numerical Recipes values)
const LCG_A = "1664525";
const LCG_C = "1013904223";
const LCG_M = "4294967296";

// ============================================================================
// STATE
// ============================================================================

const state = {
  periods: [
    { id: 1, startHour: 9, startMin: 15, duration: 90 },
    { id: 2, startHour: 13, startMin: 15, duration: 90 }
  ],
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
  numDays: 7,
  samplesPerDay: 2
};

// ============================================================================
// GENERATION FUNCTIONS
// ============================================================================

function generateDataDictionary() {
  const { samples, configForm, startField, randPrefix, seedField,
    deliverAtPrefix, fieldNameA, fieldNameC, fieldNameM, asiSurveyForm } = state;

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

  // Random number fields
  samples.forEach((sample, idx) => {
    const randField = `${randPrefix}_${String(idx + 1).padStart(2, '0')}`;
    const prevField = idx === 0 ? "seed" : `${randPrefix}_${String(idx).padStart(2, '0')}`;
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
    const calcAnnotation = `@CALCDATE([${startField}], (${dayOffset} * 1440) + ${sample.startMinutes} + mod([${randField}], ${sample.duration}), 'm')`;

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

function renderPeriods() {
  const container = document.getElementById("periods-container");
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
      <tbody id="periods-tbody"></tbody>
    </table>
  `;

  const tbody = document.getElementById("periods-tbody");

  state.periods.forEach((period, idx) => {
    const startMinutes = period.startHour * 60 + period.startMin;
    const endMinutes = startMinutes + period.duration;
    const endHour = Math.floor(endMinutes / 60);
    const endMin = endMinutes % 60;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="text-muted">${idx + 1}</td>
      <td>
        <div style="display: flex; align-items: center; gap: 4px;">
          <input type="number" class="form-control form-control-sm" style="width: 65px"
            value="${period.startHour}" min="0" max="23" data-idx="${idx}" data-field="startHour">
          <span>:</span>
          <input type="number" class="form-control form-control-sm" style="width: 65px"
            value="${period.startMin}" min="0" max="59" step="5" data-idx="${idx}" data-field="startMin">
        </div>
      </td>
      <td>
        <input type="number" class="form-control form-control-sm" style="width: 80px"
          value="${period.duration}" min="1" data-idx="${idx}" data-field="duration"> min
      </td>
      <td class="text-muted">${formatTimeFromHourMin(endHour, endMin)}</td>
      <td>
        <button class="btn btn-outline-danger btn-sm remove-period-btn" data-idx="${idx}" title="Remove period">&times;</button>
      </td>
    `;

    tbody.appendChild(row);
  });

  // Wire up event listeners for period inputs
  tbody.querySelectorAll("input").forEach(input => {
    input.addEventListener("change", () => {
      const idx = parseInt(input.dataset.idx);
      const field = input.dataset.field;
      state.periods[idx][field] = parseInt(input.value) || 0;
      renderPeriods();
    });
  });

  // Wire up remove buttons
  tbody.querySelectorAll(".remove-period-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      state.periods.splice(idx, 1);
      renderPeriods();
    });
  });
}

function renderSamples() {
  const container = document.getElementById("samples-container");
  if (!container) return;

  if (state.samples.length === 0) {
    container.innerHTML = `<p class="text-muted">No samples defined yet. Use Generate Schedule above or import a project XML.</p>`;
    renderDownloads();
    return;
  }

  const totalDays = Math.max(...state.samples.map(s => s.day));

  container.innerHTML = `
    <table class="table table-sm table-hover">
      <thead>
        <tr>
          <th>Day</th>
          <th>Sample</th>
          <th>Field Name</th>
          <th>Window</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="samples-tbody"></tbody>
    </table>
    <p class="text-muted"><strong>${state.samples.length}</strong> samples across <strong>${totalDays}</strong> days</p>
  `;

  const tbody = document.getElementById("samples-tbody");

  state.samples.forEach((sample, idx) => {
    const dayPadded = String(sample.day).padStart(2, '0');
    const samplePadded = String(sample.sample).padStart(2, '0');
    const fieldName = `${state.deliverAtPrefix}_d${dayPadded}_s${samplePadded}`;
    const endMinutes = sample.startMinutes + sample.duration;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${sample.day}</td>
      <td>${sample.sample}</td>
      <td><code style="font-size: 0.85em;">${fieldName}</code></td>
      <td class="text-muted">${formatTime(sample.startMinutes)} – ${formatTime(endMinutes)}</td>
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

function renderDownloads() {
  const container = document.getElementById("download-buttons");
  if (!container) return;

  if (state.samples.length === 0) {
    container.innerHTML = `<div class="alert alert-warning">Generate a sample schedule first (Step 4) to enable downloads.</div>`;
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
          periodIdx: (sample - 1) % 10, // rough guess
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
    renderSamples();
  });
}

function handleGenerateSchedule() {
  const newSamples = [];
  let sampleNum = 1;

  for (let day = 1; day <= state.numDays; day++) {
    for (let s = 1; s <= state.samplesPerDay; s++) {
      const periodIdx = (s - 1) % state.periods.length;
      const period = state.periods[periodIdx];
      newSamples.push({
        id: sampleNum++,
        day: day,
        sample: s,
        periodIdx: periodIdx,
        startMinutes: period ? period.startHour * 60 + period.startMin : 540,
        duration: period?.duration || 90
      });
    }
  }

  state.samples = newSamples;
  renderSamples();
}

function handleAddPeriod() {
  const maxId = Math.max(0, ...state.periods.map(d => d.id));
  state.periods.push({ id: maxId + 1, startHour: 9, startMin: 0, duration: 90 });
  renderPeriods();
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
    // Re-render samples table if deliverAtPrefix changes (affects field names)
    if (stateKey === "deliverAtPrefix") {
      renderSamples();
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
  bindNumericInput("samples-per-day", "samplesPerDay");

  // XML file import
  const xmlInput = document.getElementById("xml-file");
  if (xmlInput) {
    xmlInput.addEventListener("change", (e) => {
      handleXmlImport(e.target.files[0]);
    });
  }

  // Add period button
  const addPeriodBtn = document.getElementById("add-period-btn");
  if (addPeriodBtn) {
    addPeriodBtn.addEventListener("click", handleAddPeriod);
  }

  // Generate schedule button
  const generateBtn = document.getElementById("generate-btn");
  if (generateBtn) {
    generateBtn.addEventListener("click", handleGenerateSchedule);
  }

  // Preview tabs
  document.querySelectorAll('input[name="preview-tab"]').forEach(radio => {
    radio.addEventListener("change", renderPreview);
  });

  // Initial render
  renderPeriods();
  renderSamples();
}
