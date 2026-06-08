/**
 * Rich HTML email report for performance sprint wave completion.
 * Table-based layout for broad email client support; responsive via @media.
 */

const WAVE_LABELS = {
  1: "Quick wins",
  2: "Payload slimming",
  3: "Observability & baselines",
  4: "Dashboard data layer",
  5: "Render & UX polish",
  6: "Retrieval depth",
  7: "Final hardening",
};

const TOTAL_WAVES = 7;

const C = {
  bg: "#f0eeea",
  surface: "#ffffff",
  ink: "#1a1917",
  muted: "#6f6b64",
  faint: "#9c9890",
  line: "#ddd8cf",
  header: "#1a1917",
  accent: "#0d6e5c",
  accentSoft: "#e6f4f1",
  ok: "#1a6b4a",
  okBg: "#e8f5ef",
  warn: "#9a6700",
  warnBg: "#faf3e0",
  bad: "#a83232",
  badBg: "#fceeee",
  barTrack: "#e8e4dd",
};

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CODE_STYLE = `background:${C.bg};padding:1px 5px;border-radius:3px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;color:${C.ink};`;

/** Inline markdown: bold, italic, code */
function inlineMd(text) {
  if (!text) return "";
  const codes = [];
  let raw = String(text);
  raw = raw.replace(/`([^`\n]+)`/g, (_, code) => {
    codes.push(code);
    return `\x00C${codes.length - 1}\x00`;
  });

  let s = esc(raw);
  s = s.replace(/\x00C(\d+)\x00/g, (_, i) =>
    `<code style="${CODE_STYLE}">${esc(codes[Number(i)])}</code>`,
  );
  s = s.replace(/\*\*([^*\n]+)\*\*/g, `<strong style="font-weight:600;color:${C.ink};">$1</strong>`);
  s = s.replace(/\*([^*\n]+)\*/g, `<em style="font-style:italic;">$1</em>`);
  s = s.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    `<a href="$2" style="color:${C.accent};text-decoration:underline;">$1</a>`,
  );
  return s;
}

function parseMdTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  if (/^\|[\s\-:|]+\|$/.test(trimmed)) return null;
  return trimmed
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

function renderMdTable(rows) {
  if (!rows.length) return "";
  const [head, ...body] = rows;
  const ths = head
    .map(
      (c) =>
        `<th align="left" style="padding:8px 10px;font-size:11px;color:${C.muted};font-weight:600;border-bottom:1px solid ${C.line};">${inlineMd(c)}</th>`,
    )
    .join("");
  const trs = body
    .map((row) => {
      const tds = row
        .map(
          (c, i) =>
            `<td style="padding:8px 10px;border-bottom:1px solid ${C.line};font-size:12px;color:${i === 0 ? C.ink : C.muted};">${inlineMd(c)}</td>`,
        )
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:4px;margin:10px 0 14px;"><tr style="background:${C.bg};">${ths}</tr>${trs}</table>`;
}

/** Block markdown → email-safe HTML (headings, lists, tables, paragraphs) */
function markdownToEmailHtml(md) {
  if (!md) return "";
  const lines = String(md).split("\n");
  const out = [];
  let listItems = [];
  let listOrdered = false;
  let tableBuffer = [];

  function flushList() {
    if (!listItems.length) return;
    const tag = listOrdered ? "ol" : "ul";
    out.push(
      `<${tag} style="margin:8px 0 12px;padding-left:20px;color:${C.muted};font-size:13px;line-height:1.6;">`,
    );
    for (const item of listItems) {
      out.push(`<li style="margin-bottom:6px;">${inlineMd(item)}</li>`);
    }
    out.push(`</${tag}>`);
    listItems = [];
    listOrdered = false;
  }

  function flushTable() {
    if (!tableBuffer.length) return;
    out.push(renderMdTable(tableBuffer));
    tableBuffer = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const tableRow = parseMdTableRow(trimmed);
    if (tableRow) {
      flushList();
      tableBuffer.push(tableRow);
      continue;
    }
    flushTable();

    const h3 = trimmed.match(/^###\s+(.+)/);
    if (h3) {
      flushList();
      out.push(
        `<div style="font-size:13px;font-weight:600;color:${C.ink};margin:16px 0 6px;">${inlineMd(h3[1])}</div>`,
      );
      continue;
    }
    const h2 = trimmed.match(/^##\s+(.+)/);
    if (h2) {
      flushList();
      out.push(
        `<div style="font-size:14px;font-weight:700;color:${C.ink};margin:18px 0 8px;">${inlineMd(h2[1])}</div>`,
      );
      continue;
    }
    const num = trimmed.match(/^\d+\.\s+(.+)/);
    if (num) {
      if (!listOrdered && listItems.length) flushList();
      listOrdered = true;
      listItems.push(num[1]);
      continue;
    }
    const bullet = trimmed.match(/^[-*]\s+(.+)/);
    if (bullet) {
      if (listOrdered && listItems.length) flushList();
      listItems.push(bullet[1]);
      continue;
    }
    if (!trimmed) {
      flushList();
      continue;
    }

    flushList();
    out.push(
      `<p style="margin:0 0 10px;font-size:13px;color:${C.muted};line-height:1.65;">${inlineMd(trimmed)}</p>`,
    );
  }

  flushList();
  flushTable();
  return out.join("\n");
}

function fmtDate(iso) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function slugTitle(folder) {
  if (!folder) return "Unknown sprint";
  return folder
    .replace(/^sprint-\d+-/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function numericScore(s) {
  const n = Number(s.score);
  return Number.isFinite(n) ? n : null;
}

function statusTone(status) {
  const s = String(status ?? "").toLowerCase();
  if (s === "complete") return "ok";
  if (s === "partial" || s === "in progress" || s === "in_progress") return "warn";
  if (s === "not started" || s === "not") return "bad";
  return "neutral";
}

function formatStatus(status) {
  if (status === "not") return "not started";
  return status ?? "unknown";
}

function isPendingSprint(s) {
  const impl = formatStatus(s.implementationStatus).toLowerCase();
  const verify = formatStatus(s.verificationStatus).toLowerCase();
  return impl === "not started" || verify === "not started";
}

function hasSummary(s) {
  return Boolean(s.implementationSummary?.trim());
}

function objectivesBadge(s) {
  const obj = s.objectivesMet?.trim();
  if (!obj || obj.startsWith("—")) {
    return isPendingSprint(s) ? badge("Pending", "neutral") : "";
  }
  return badge(`Objectives ${obj}`, obj.includes("3 / 3") ? "ok" : "warn");
}

function rubricMax(weight) {
  const n = parseInt(String(weight).replace(/[^\d]/g, ""), 10);
  return n > 0 ? n : 100;
}

function badge(label, tone = "neutral") {
  const styles = {
    ok: `background:${C.okBg};color:${C.ok};`,
    warn: `background:${C.warnBg};color:${C.warn};`,
    bad: `background:${C.badBg};color:${C.bad};`,
    neutral: `background:${C.bg};color:${C.muted};`,
    accent: `background:${C.accentSoft};color:${C.accent};`,
  };
  return `<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:0.03em;text-transform:uppercase;${styles[tone] ?? styles.neutral}">${esc(formatStatus(label))}</span>`;
}

function scoreColor(n) {
  if (n >= 95) return C.ok;
  if (n >= 85) return C.accent;
  if (n >= 70) return C.warn;
  return C.bad;
}

function barChart(label, value, max = 100, color = C.accent) {
  const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;">
      <tr>
        <td style="font-size:12px;color:${C.muted};padding-bottom:4px;">${esc(label)}</td>
        <td align="right" style="font-size:12px;font-weight:600;color:${C.ink};padding-bottom:4px;">${value}${max === 100 ? "" : `/${max}`}</td>
      </tr>
      <tr>
        <td colspan="2">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.barTrack};border-radius:3px;height:8px;">
            <tr><td width="${pct}%" style="background:${color};border-radius:3px;height:8px;font-size:0;line-height:0;">&nbsp;</td><td style="font-size:0;line-height:0;">&nbsp;</td></tr>
          </table>
        </td>
      </tr>
    </table>`;
}

function computeInsights(summary) {
  const ok = summary.sprints.filter((s) => !s.error);
  const errors = summary.sprints.filter((s) => s.error);
  const verified = ok.filter((s) => s.verificationStatus === "complete");
  const implDone = ok.filter((s) => s.implementationStatus === "complete");
  const scored = ok.map(numericScore).filter((n) => n != null);
  const violations = ok.filter(
    (s) => s.antiObjectivesViolated && !/^(none|—|-)$/i.test(s.antiObjectivesViolated.trim()),
  );
  const pending = ok.filter((s) => s.verificationStatus !== "complete");

  const minScore = scored.length ? Math.min(...scored) : null;
  const maxScore = scored.length ? Math.max(...scored) : null;
  const lowest =
    minScore != null
      ? ok.find((s) => numericScore(s) === minScore)
      : null;
  const highest =
    maxScore != null
      ? ok.find((s) => numericScore(s) === maxScore)
      : null;

  const completionPct = summary.sprintCount
    ? Math.round((summary.completedCount / summary.sprintCount) * 100)
    : 0;

  const bullets = [];

  if (errors.length) {
    bullets.push({
      tone: "bad",
      title: `${errors.length} sprint${errors.length > 1 ? "s" : ""} missing data`,
      body: errors.map((e) => `Sprint ${e.sprint}: ${e.error}`).join("; "),
    });
  }

  if (summary.completedCount === summary.sprintCount && !errors.length) {
    bullets.push({
      tone: "ok",
      title: "Wave fully verified",
      body: `All ${summary.sprintCount} sprints passed verification with documented evidence.`,
    });
  } else if (pending.length) {
    bullets.push({
      tone: "warn",
      title: `${pending.length} sprint${pending.length > 1 ? "s" : ""} awaiting verification`,
      body: pending.map((s) => `#${s.sprint} ${s.title ?? slugTitle(s.folder)}`).join(", "),
    });
  }

  if (summary.averageScore != null) {
    const qual =
      summary.averageScore >= 95
        ? "excellent"
        : summary.averageScore >= 85
          ? "solid"
          : summary.averageScore >= 70
            ? "acceptable"
            : "needs attention";
    bullets.push({
      tone: summary.averageScore >= 85 ? "ok" : "warn",
      title: `Average verification score: ${summary.averageScore}/100 (${qual})`,
      body:
        scored.length > 1 && minScore != null && maxScore != null
          ? `Range ${minScore}–${maxScore} across ${scored.length} scored sprints.`
          : `${scored.length} sprint(s) scored.`,
    });
  }

  if (lowest && highest && minScore !== maxScore && scored.length > 1) {
    bullets.push({
      tone: "neutral",
      title: "Score spread",
      body: `Highest: #${highest.sprint} (${maxScore}). Lowest: #${lowest.sprint} (${minScore}). Review rubric notes on lower-scoring sprints for follow-ups.`,
    });
  }

  if (violations.length) {
    bullets.push({
      tone: "bad",
      title: "Anti-objective violations detected",
      body: violations
        .map((s) => `#${s.sprint}: ${s.antiObjectivesViolated}`)
        .join("; "),
    });
  }

  const allMeasurements = ok.flatMap((s) =>
    (s.measurements ?? []).slice(0, 2).map((m) => ({ ...m, sprint: s.sprint })),
  );
  if (allMeasurements.length) {
    const wins = allMeasurements.filter(
      (m) =>
        /−|-\d|↓|eliminated|reduced|fewer|less|pass/i.test(m.after) ||
        (m.before !== m.after && m.after && m.after !== "—"),
    );
    if (wins.length) {
      bullets.push({
        tone: "ok",
        title: "Documented performance deltas",
        body: wins
          .slice(0, 3)
          .map((m) => `#${m.sprint} ${m.metric}: ${m.before} → ${m.after}`)
          .join(". "),
      });
    }
  }

  const openImprovements = ok.flatMap((s) =>
    (s.improvements ?? []).slice(0, 1).map((t) => ({ sprint: s.sprint, text: t })),
  );
  if (openImprovements.length) {
    bullets.push({
      tone: "neutral",
      title: "Follow-up items noted in outcomes",
      body: openImprovements
        .slice(0, 3)
        .map((i) => `#${i.sprint}: ${i.text}`)
        .join(" "),
    });
  }

  return {
    completionPct,
    verified,
    implDone,
    errors,
    pending,
    violations,
    lowest,
    highest,
    minScore,
    maxScore,
    scored,
    bullets,
    programPct: Math.round((summary.wave / TOTAL_WAVES) * 100),
  };
}

function waveProgressHtml(currentWave) {
  const cells = [];
  for (let w = 1; w <= TOTAL_WAVES; w++) {
    const done = w < currentWave;
    const active = w === currentWave;
    const bg = done ? C.accent : active ? C.ink : C.barTrack;
    const label = active ? C.surface : done ? C.surface : C.muted;
    cells.push(`
      <td align="center" style="padding:2px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td width="36" height="36" align="center" style="background:${bg};border-radius:4px;font-size:13px;font-weight:700;color:${label};">${w}</td>
          </tr>
          <tr><td align="center" style="font-size:9px;color:${C.faint};padding-top:4px;">${active ? "now" : done ? "done" : ""}</td></tr>
        </table>
      </td>`);
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>${cells.join("")}</tr></table>`;
}

function statCard(label, value, sub, accent = false) {
  return `
    <td class="stat-cell" width="50%" style="padding:6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${accent ? C.accentSoft : C.surface};border:1px solid ${C.line};border-radius:6px;">
        <tr><td style="padding:16px 18px;">
          <div style="font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">${esc(label)}</div>
          <div style="font-size:28px;font-weight:700;color:${accent ? C.accent : C.ink};line-height:1.1;">${esc(value)}</div>
          ${sub ? `<div style="font-size:12px;color:${C.muted};margin-top:6px;line-height:1.4;">${sub}</div>` : ""}
        </td></tr>
      </table>
    </td>`;
}

function insightBlock(item) {
  const border =
    item.tone === "ok"
      ? C.ok
      : item.tone === "warn"
        ? C.warn
        : item.tone === "bad"
          ? C.bad
          : C.line;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border-left:3px solid ${border};background:${C.surface};border-radius:0 6px 6px 0;">
      <tr><td style="padding:12px 16px;">
        <div style="font-size:13px;font-weight:600;color:${C.ink};margin-bottom:4px;">${esc(item.title)}</div>
        <div style="font-size:13px;color:${C.muted};line-height:1.5;">${inlineMd(item.body)}</div>
      </td></tr>
    </table>`;
}

function sprintRow(s, insights) {
  if (s.error) {
    return `
      <tr class="sprint-row">
        <td style="padding:12px 10px;border-bottom:1px solid ${C.line};font-weight:600;color:${C.ink};">#${esc(s.sprint)}</td>
        <td colspan="5" style="padding:12px 10px;border-bottom:1px solid ${C.line};color:${C.bad};">${esc(s.error)}</td>
      </tr>`;
  }

  const score = numericScore(s);
  const isLow = insights.lowest && s.sprint === insights.lowest.sprint && insights.scored.length > 1;
  const isHigh = insights.highest && s.sprint === insights.highest.sprint && insights.scored.length > 1;
  const name = s.title ?? slugTitle(s.folder);
  const scoreCell =
    score != null
      ? `<span style="font-weight:700;color:${scoreColor(score)};">${score}</span>`
      : `<span style="color:${C.faint};">—</span>`;

  return `
    <tr class="sprint-row">
      <td class="mobile-hide" style="padding:12px 10px;border-bottom:1px solid ${C.line};font-weight:600;color:${C.ink};white-space:nowrap;">#${esc(s.sprint)}</td>
      <td style="padding:12px 10px;border-bottom:1px solid ${C.line};">
        <div style="font-weight:600;color:${C.ink};font-size:14px;">${esc(name)}</div>
        <div class="mobile-show" style="display:none;font-size:11px;color:${C.faint};margin-top:2px;">Sprint #${esc(s.sprint)}</div>
        <div style="font-size:11px;color:${C.faint};margin-top:2px;">${esc(s.folder ?? "")}</div>
      </td>
      <td class="mobile-hide" style="padding:12px 10px;border-bottom:1px solid ${C.line};">${badge(s.implementationStatus, statusTone(s.implementationStatus))}</td>
      <td class="mobile-hide" style="padding:12px 10px;border-bottom:1px solid ${C.line};">${badge(s.verificationStatus, statusTone(s.verificationStatus))}</td>
      <td style="padding:12px 10px;border-bottom:1px solid ${C.line};text-align:center;">${scoreCell}${isLow ? ` <span style="font-size:10px;color:${C.warn};">low</span>` : ""}${isHigh ? ` <span style="font-size:10px;color:${C.ok};">top</span>` : ""}</td>
      <td class="mobile-hide" style="padding:12px 10px;border-bottom:1px solid ${C.line};font-size:12px;color:${C.muted};">${esc(s.objectivesMet)}</td>
    </tr>`;
}

function sprintDetailCard(s) {
  if (s.error) return "";

  const score = numericScore(s);
  const name = s.title ?? slugTitle(s.folder);
  const meta = [s.priority, s.effort].filter(Boolean).join(" · ");
  const pending = isPendingSprint(s);
  const measurements = s.measurements ?? [];

  let measurementsHtml = "";
  if (measurements.length) {
    const rows = measurements
      .slice(0, 4)
      .map(
        (m) => `
        <tr>
          <td style="padding:8px 10px;border-bottom:1px solid ${C.line};font-size:12px;color:${C.ink};">${inlineMd(m.metric)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid ${C.line};font-size:12px;color:${C.muted};">${inlineMd(m.before)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid ${C.line};font-size:12px;font-weight:600;color:${C.accent};">${inlineMd(m.after)}</td>
        </tr>`,
      )
      .join("");
    measurementsHtml = `
      <div style="font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;margin:16px 0 8px;">Measurements</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:4px;">
        <tr style="background:${C.bg};">
          <th align="left" style="padding:8px 10px;font-size:11px;color:${C.muted};font-weight:600;">Metric</th>
          <th align="left" style="padding:8px 10px;font-size:11px;color:${C.muted};font-weight:600;">Before</th>
          <th align="left" style="padding:8px 10px;font-size:11px;color:${C.muted};font-weight:600;">After</th>
        </tr>
        ${rows}
      </table>`;
  }

  let rubricHtml = "";
  if (s.rubric?.length) {
    rubricHtml = s.rubric
      .slice(0, 4)
      .map((r) => {
        const max = rubricMax(r.weight);
        return barChart(`${r.dimension} (${r.weight})`, Number(r.score) || 0, max, C.accent);
      })
      .join("");
  }

  let improvementsHtml = "";
  if (s.improvements?.length) {
    improvementsHtml = `
      <div style="font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;margin:16px 0 8px;">Follow-ups</div>
      <ul style="margin:0;padding-left:18px;color:${C.muted};font-size:13px;line-height:1.6;">
        ${s.improvements.map((i) => `<li style="margin-bottom:4px;">${inlineMd(i)}</li>`).join("")}
      </ul>`;
  }

  const summaryHtml = hasSummary(s) ? markdownToEmailHtml(s.implementationSummary) : "";
  const pendingHtml = pending
    ? `<div style="padding:14px 16px;background:${C.bg};border-radius:6px;font-size:13px;color:${C.muted};line-height:1.6;">Not started yet — outcomes will appear here after implement and verify phases complete.</div>`
    : "";
  const bodyHtml = summaryHtml || pendingHtml;
  const bodySection = bodyHtml
    ? `<div style="border-top:1px solid ${C.line};padding-top:14px;">${bodyHtml}</div>`
    : "";

  const badges = [
    badge(s.implementationStatus, statusTone(s.implementationStatus)),
    badge(s.verificationStatus, statusTone(s.verificationStatus)),
    objectivesBadge(s),
  ].filter(Boolean);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border:1px solid ${C.line};border-radius:8px;background:${C.surface};">
      <tr><td style="padding:20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="font-size:11px;color:${C.faint};margin-bottom:4px;">Sprint #${esc(s.sprint)}${meta ? ` · ${esc(meta)}` : ""}</div>
              <div style="font-size:17px;font-weight:700;color:${C.ink};line-height:1.3;">${esc(name)}</div>
            </td>
            <td align="right" valign="top">
              ${score != null ? `<div style="font-size:32px;font-weight:700;color:${scoreColor(score)};line-height:1;">${score}</div><div style="font-size:10px;color:${C.faint};text-align:right;">/ 100</div>` : ""}
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 ${bodySection || measurementsHtml || rubricHtml || improvementsHtml ? "16px" : "0"};">
          <tr>${badges.map((b) => `<td style="padding-right:8px;">${b}</td>`).join("")}</tr>
        </table>
        ${bodySection}
        ${measurementsHtml}
        ${rubricHtml ? `<div style="font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.05em;margin:16px 0 4px;">Score breakdown</div>${rubricHtml}` : ""}
        ${improvementsHtml}
      </td></tr>
    </table>`;
}

function scoreDistribution(summary, insights) {
  const bars = summary.sprints
    .filter((s) => !s.error && numericScore(s) != null)
    .map((s) => {
      const n = numericScore(s);
      const label = `#${s.sprint} ${(s.title ?? slugTitle(s.folder)).slice(0, 28)}${(s.title ?? slugTitle(s.folder)).length > 28 ? "…" : ""}`;
      return barChart(label, n, 100, scoreColor(n));
    })
    .join("");

  if (!bars) {
    return `<p style="font-size:13px;color:${C.muted};margin:0;">No verification scores recorded yet.</p>`;
  }
  return bars;
}

function buildCta(summary, triggerUrl) {
  const next = summary.wave + 1;
  if (next > TOTAL_WAVES) {
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.okBg};border:1px solid ${C.ok};border-radius:8px;">
        <tr><td style="padding:24px;text-align:center;">
          <div style="font-size:18px;font-weight:700;color:${C.ok};margin-bottom:6px;">Program complete</div>
          <div style="font-size:14px;color:${C.muted};">All ${TOTAL_WAVES} waves finished. Review cumulative outcomes in the repo.</div>
        </td></tr>
      </table>`;
  }

  const localCmd = `npm run perf:wave -- --wave ${next}`;
  if (triggerUrl) {
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border:1px solid ${C.line};border-radius:8px;">
        <tr><td style="padding:24px;text-align:center;">
          <div style="font-size:15px;font-weight:600;color:${C.ink};margin-bottom:4px;">Ready for Wave ${next}</div>
          <div style="font-size:13px;color:${C.muted};margin-bottom:18px;">${esc(WAVE_LABELS[next] ?? "Next wave")}</div>
          <a href="${esc(triggerUrl)}" style="display:inline-block;padding:14px 28px;background:${C.accent};color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;min-height:44px;line-height:16px;">Start Wave ${next}</a>
          <div style="font-size:12px;color:${C.faint};margin-top:16px;line-height:1.5;">Or locally: <code style="background:${C.bg};padding:2px 6px;border-radius:3px;font-size:11px;">${esc(localCmd)}</code></div>
          <div style="font-size:11px;color:${C.faint};margin-top:8px;">Reply <code style="background:${C.bg};padding:2px 6px;border-radius:3px;">START WAVE ${next}</code> if inbound webhook is configured.</div>
        </td></tr>
      </table>`;
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.surface};border:1px solid ${C.line};border-radius:8px;">
      <tr><td style="padding:24px;text-align:center;">
        <div style="font-size:15px;font-weight:600;color:${C.ink};margin-bottom:4px;">Next: Wave ${next}</div>
        <div style="font-size:13px;color:${C.muted};margin-bottom:14px;">${esc(WAVE_LABELS[next] ?? "Continue the program")}</div>
        <code style="display:inline-block;background:${C.bg};padding:12px 16px;border-radius:6px;font-size:13px;color:${C.ink};">${esc(localCmd)}</code>
        <div style="font-size:11px;color:${C.faint};margin-top:12px;">Set PERF_TRIGGER_PUBLIC_URL + PERF_TRIGGER_SECRET for one-click triggers.</div>
      </td></tr>
    </table>`;
}

export function buildPlainTextReport(summary) {
  const insights = computeInsights(summary);
  const lines = [
    `PERFORMANCE SPRINT — WAVE ${summary.wave} REPORT`,
    `${WAVE_LABELS[summary.wave] ?? ""}`,
    `Generated: ${fmtDate(summary.generatedAt)}`,
    "",
    `SUMMARY`,
    `  Verified: ${summary.completedCount}/${summary.sprintCount} (${insights.completionPct}%)`,
    summary.averageScore != null ? `  Average score: ${summary.averageScore}/100` : null,
    `  Program progress: Wave ${summary.wave} of ${TOTAL_WAVES}`,
    "",
    "INSIGHTS",
    ...insights.bullets.map((b) => `  • ${b.title}: ${b.body}`),
    "",
    "SPRINTS",
  ].filter(Boolean);

  for (const s of summary.sprints) {
    if (s.error) {
      lines.push(`  #${s.sprint} ERROR: ${s.error}`);
      continue;
    }
    lines.push(
      `  #${s.sprint} ${s.title ?? slugTitle(s.folder)} — score ${s.score}, verify ${s.verificationStatus}, objectives ${s.objectivesMet}`,
    );
  }

  lines.push("", "---", "semantic-core performance sprint program");
  return lines.join("\n");
}

export function buildWaveEmailHtml(summary, triggerUrl) {
  const insights = computeInsights(summary);
  const waveLabel = summary.waveName ?? WAVE_LABELS[summary.wave] ?? "Performance wave";
  const allVerified = summary.completedCount === summary.sprintCount && !insights.errors.length;
  const headerStatus = allVerified ? "Complete" : insights.pending.length ? "In progress" : "Review needed";

  const detailCards = summary.sprints.map(sprintDetailCard).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <title>Wave ${summary.wave} Report — semantic-core</title>
  <style>
    @media only screen and (max-width: 620px) {
      .wrapper { width: 100% !important; }
      .content-pad { padding: 16px !important; }
      .stat-cell { display: block !important; width: 100% !important; }
      .mobile-hide { display: none !important; }
      .mobile-show { display: block !important; }
      .sprint-table { font-size: 13px !important; }
      h1.hero-title { font-size: 22px !important; }
    }
    @media (prefers-color-scheme: dark) {
      /* Most clients ignore this; light scheme is primary */
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${C.ink};-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" class="wrapper" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

        <!-- Header -->
        <tr><td style="background:${C.header};border-radius:8px 8px 0 0;padding:28px 28px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:11px;font-weight:600;color:#8a8780;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:10px;">semantic-core · performance sprints</div>
                <h1 class="hero-title" style="margin:0 0 8px;font-size:26px;font-weight:700;color:#ffffff;line-height:1.2;">Wave ${summary.wave} report</h1>
                <div style="font-size:15px;color:#b8b4ac;margin-bottom:14px;">${esc(waveLabel)}</div>
                <div style="font-size:12px;color:#8a8780;">${esc(fmtDate(summary.generatedAt))}</div>
              </td>
              <td align="right" valign="top">
                ${badge(headerStatus, allVerified ? "ok" : insights.pending.length ? "warn" : "bad")}
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td class="content-pad" style="background:${C.surface};padding:28px;border-left:1px solid ${C.line};border-right:1px solid ${C.line};">

          <!-- Stats grid -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
            <tr>
              ${statCard("Verified", `${summary.completedCount}/${summary.sprintCount}`, `${insights.completionPct}% of wave`, true)}
              ${statCard("Avg score", summary.averageScore != null ? `${summary.averageScore}` : "—", summary.averageScore != null ? "out of 100" : "not scored yet")}
            </tr>
            <tr>
              ${statCard("Implemented", `${insights.implDone.length}/${summary.sprintCount}`, "implementation complete")}
              ${statCard("Program", `Wave ${summary.wave}/${TOTAL_WAVES}`, `${insights.programPct}% through program`)}
            </tr>
          </table>

          ${barChart("Wave completion", insights.completionPct, 100, allVerified ? C.ok : C.accent)}

          <!-- Program progress -->
          <div style="font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.06em;margin:24px 0 12px;text-align:center;">Program progress</div>
          ${waveProgressHtml(summary.wave)}

          <!-- Insights -->
          <div style="font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.06em;margin:28px 0 12px;">Insights</div>
          ${insights.bullets.map(insightBlock).join("")}

          <!-- Score chart -->
          <div style="font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.06em;margin:28px 0 12px;">Verification scores</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};border:1px solid ${C.line};border-radius:6px;margin-bottom:8px;">
            <tr><td style="padding:16px 18px;">
              ${scoreDistribution(summary, insights)}
            </td></tr>
          </table>

          <!-- Summary table -->
          <div style="font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.06em;margin:28px 0 12px;">Sprint overview</div>
          <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;">
            <table role="presentation" class="sprint-table" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.line};border-radius:6px;font-size:13px;">
              <tr style="background:${C.bg};">
                <th align="left" class="mobile-hide" style="padding:10px;font-size:11px;color:${C.muted};font-weight:600;">#</th>
                <th align="left" style="padding:10px;font-size:11px;color:${C.muted};font-weight:600;">Sprint</th>
                <th align="left" class="mobile-hide" style="padding:10px;font-size:11px;color:${C.muted};font-weight:600;">Impl</th>
                <th align="left" class="mobile-hide" style="padding:10px;font-size:11px;color:${C.muted};font-weight:600;">Verify</th>
                <th align="center" style="padding:10px;font-size:11px;color:${C.muted};font-weight:600;">Score</th>
                <th align="left" class="mobile-hide" style="padding:10px;font-size:11px;color:${C.muted};font-weight:600;">Objectives</th>
              </tr>
              ${summary.sprints.map((s) => sprintRow(s, insights)).join("")}
            </table>
          </div>

          <!-- Detail cards -->
          <div style="font-size:11px;font-weight:600;color:${C.muted};text-transform:uppercase;letter-spacing:0.06em;margin:32px 0 16px;">Sprint details</div>
          ${detailCards}

          <!-- CTA -->
          <div style="margin-top:32px;">
            ${buildCta(summary, triggerUrl)}
          </div>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:${C.bg};border:1px solid ${C.line};border-top:none;border-radius:0 0 8px 8px;padding:20px 28px;text-align:center;">
          <div style="font-size:12px;color:${C.faint};line-height:1.6;">
            Auto-generated from <code style="font-size:11px;background:${C.surface};padding:1px 5px;border-radius:3px;">docs/performance-improvments/</code> outcomes.<br/>
            Full markdown report saved alongside this email in <code style="font-size:11px;background:${C.surface};padding:1px 5px;border-radius:3px;">wave-reports/</code>.
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
