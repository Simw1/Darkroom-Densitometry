// Film Process Control - Diagnostic Engine
// Based on Kodak Z-131 Process C-41 Manual and Ilford FPC Manual

const TOLERANCES = {
  c41: {
    dmin: { action: 3, control: 5 },      // ±0.03, ±0.05 (×100)
    ld: { action: 6, control: 8 },         // ±0.06, ±0.08
    hdld: { action: 7, control: 9 },       // ±0.07, ±0.09
    dmaxb_yb: { action: 10, control: 12 }, // +0.10, +0.12 (retained silver)
    spread: 9                               // 0.09 color balance spread
  },
  bw: {
    ld: { action: 6, control: 10 },        // ±0.06 action per Ilford
    hdld: { action: 6, control: 10 }
  }
};

// C-41 Diagnostic Patterns (Charts 1-22 from Kodak Z-131)
const C41_DIAGNOSTICS = [
  {
    id: 1,
    name: "Developer Temperature Too Low",
    pattern: { 
      dmax: { r: "low", g: "low", b: "low" },
      hd: { r: "low", g: "low", b: "low" },
      ld: { r: "low", g: "low", b: "low" },
      dmin: { r: "normal", g: "normal", b: "normal" }
    },
    signature: "all_low_uniform",
    cause: "Developer temperature below 37.8°C (100°F)",
    action: "Check developer temperature with accurate thermometer. Verify temperature control unit is functioning. Adjust to 37.8°C ±0.15°C.",
    manual_ref: "Chart 1, Page 5-29"
  },
  {
    id: 2,
    name: "Developer Temperature Too High",
    pattern: {
      dmax: { r: "high", g: "high", b: "high" },
      hd: { r: "high", g: "high", b: "high" },
      ld: { r: "high", g: "high", b: "high" },
      dmin: { r: "normal", g: "normal", b: "normal" }
    },
    signature: "all_high_uniform",
    cause: "Developer temperature above 37.8°C (100°F)",
    action: "Check developer temperature with accurate thermometer. Check for intermittent electrical or tempered-water-flow problems. Adjust to 37.8°C ±0.15°C.",
    manual_ref: "Chart 1, Page 5-29"
  },
  {
    id: 3,
    name: "Developer Time Too Short",
    pattern: {
      dmax: { r: "low", g: "low", b: "low" },
      hd: { r: "low", g: "low", b: "low" },
      ld: { r: "low", g: "low", b: "low" },
      dmin: { r: "normal", g: "normal", b: "normal" }
    },
    signature: "all_low_uniform",
    cause: "Developer time below 3 minutes 15 seconds",
    action: "Use stopwatch to measure actual developer time. Check for electrical-load variations and motor-temperature differences. Verify transport is functioning properly. Aim: 3:15.",
    manual_ref: "Chart 2, Page 5-30"
  },
  {
    id: 4,
    name: "Developer Time Too Long",
    pattern: {
      dmax: { r: "high", g: "high", b: "high" },
      hd: { r: "high", g: "high", b: "high" },
      ld: { r: "high", g: "high", b: "high" },
      dmin: { r: "normal", g: "normal", b: "normal" }
    },
    signature: "all_high_uniform",
    cause: "Developer time exceeds 3 minutes 15 seconds",
    action: "Measure developer time with stopwatch. Check rack threading. Adjust time to aim (3:15). Allow recommended drain time as part of developer time.",
    manual_ref: "Chart 2, Page 5-30"
  },
  {
    id: 5,
    name: "Developer Agitation Too Low",
    pattern: {
      dmax: { r: "low", g: "low", b: "low" },
      hd: { r: "low", g: "low", b: "low" },
      ld: { r: "slight_low", g: "slight_low", b: "slight_low" },
      dmin: { r: "normal", g: "normal", b: "normal" }
    },
    signature: "hd_affected_more",
    cause: "Insufficient agitation in developer - not removing by-products effectively",
    action: "For dip & dunk: Check nitrogen burst cycle (2-sec burst, 8-sec rest). Verify bubbles are ~4mm diameter. Check recirculation system for kinked lines or plugged sparger. Solution rise should be ~1.5cm during burst.",
    manual_ref: "Chart 3, Page 5-31"
  },
  {
    id: 6,
    name: "Developer Agitation Too High",
    pattern: {
      dmax: { r: "high", g: "high", b: "high" },
      hd: { r: "high", g: "high", b: "high" },
      ld: { r: "slight_high", g: "slight_high", b: "slight_high" },
      dmin: { r: "normal", g: "normal", b: "normal" }
    },
    signature: "hd_affected_more_high",
    cause: "Excessive agitation causing oxidation and foaming",
    action: "Reduce agitation. For burst agitation, verify 10-second cycle (2-sec burst, 8-sec rest). Check that solution rise is not exceeding 1.5cm. Excessive agitation causes oxidation.",
    manual_ref: "Chart 3, Page 5-31"
  },
  {
    id: 7,
    name: "Developer Underreplenished",
    pattern: {
      dmax: { r: "low", g: "low", b: "low" },
      hd: { r: "low", g: "low", b: "low" },
      ld: { r: "low", g: "low", b: "low" },
      dmin: { r: "low", g: "low", b: "low" }
    },
    signature: "all_low_including_dmin",
    cause: "Developer replenishment rate too low",
    action: "Check replenishment rate setting and pump operation. Add 25mL properly mixed developer replenisher per litre of tank solution. Turn on recirculation for 15 minutes before running control strip.",
    manual_ref: "Charts 4-5, Pages 5-32/33"
  },
  {
    id: 8,
    name: "Developer Overreplenished",
    pattern: {
      dmax: { r: "high", g: "high", b: "high" },
      hd: { r: "high", g: "high", b: "high" },
      ld: { r: "high", g: "high", b: "high" },
      dmin: { r: "high", g: "high", b: "high" }
    },
    signature: "all_high_including_dmin",
    cause: "Developer replenishment rate too high",
    action: "Check replenishment rate. Add solution of 1 part Developer Starter to 4 parts water at 25mL per litre of tank solution. Recirculate 15 minutes before testing.",
    manual_ref: "Charts 4-5, Pages 5-32/33"
  },
  {
    id: 9,
    name: "Developer Mix Error - Part A Low",
    pattern: {
      hdld: { r: "low", g: "slight_low", b: "low" },
      ld: { r: "normal", g: "normal", b: "normal" }
    },
    signature: "red_hdld_most_affected_low",
    cause: "Not enough Part A used in developer mix",
    action: "Check mixing procedures. Unless you know the exact amount omitted, replace developer solution. Part A primarily affects red HD densities.",
    manual_ref: "Chart 6, Page 5-34"
  },
  {
    id: 10,
    name: "Developer Mix Error - Part A High",
    pattern: {
      hdld: { r: "high", g: "slight_high", b: "low" },
      ld: { r: "normal", g: "normal", b: "normal" }
    },
    signature: "red_hdld_high_blue_low",
    cause: "Too much Part A used in developer mix",
    action: "Check mixing procedures. Unless you know the exact amount, replace developer solution. Excess Part A increases red HD dramatically, decreases blue.",
    manual_ref: "Chart 6, Page 5-34"
  },
  {
    id: 11,
    name: "Developer Mix Error - Part B Low",
    pattern: {
      dmax: { r: "high", g: "high", b: "high" },
      hdld: { r: "high", g: "high", b: "high" },
      ld: { r: "high", g: "high", b: "high" }
    },
    signature: "all_high_hdld_most",
    cause: "Not enough Part B used - developer too active",
    action: "Check mixing procedures. Part B is a restrainer. Replace developer solution as correction is difficult without chemical analysis.",
    manual_ref: "Chart 7, Page 5-35"
  },
  {
    id: 12,
    name: "Developer Mix Error - Part B High",
    pattern: {
      dmax: { r: "low", g: "low", b: "low" },
      hdld: { r: "low", g: "low", b: "low" },
      ld: { r: "low", g: "low", b: "low" }
    },
    signature: "all_low_hdld_most",
    cause: "Too much Part B used - developer restrained",
    action: "Check mixing procedures. Excess Part B reduces activity. Replace developer solution.",
    manual_ref: "Chart 7, Page 5-35"
  },
  {
    id: 13,
    name: "Developer Mix Error - Part C Low",
    pattern: {
      hdld: { r: "low", g: "low", b: "very_low" },
      ld: { r: "low", g: "low", b: "low" }
    },
    signature: "blue_hdld_most_affected_low",
    cause: "Not enough Part C used in developer mix",
    action: "Check mixing procedures. Part C primarily affects blue densities. Replace developer solution.",
    manual_ref: "Chart 8, Page 5-36"
  },
  {
    id: 14,
    name: "Developer Mix Error - Part C High",
    pattern: {
      hdld: { r: "normal", g: "high", b: "high" },
      ld: { r: "normal", g: "high", b: "high" }
    },
    signature: "green_blue_high_red_normal",
    cause: "Too much Part C used in developer mix",
    action: "Check mixing procedures. Excess Part C increases green and blue densities. Replace developer solution.",
    manual_ref: "Chart 8, Page 5-36"
  },
  {
    id: 15,
    name: "Developer Starter - Too Little",
    pattern: {
      dmax: { r: "high", g: "high", b: "high" },
      hd: { r: "high", g: "high", b: "high" },
      ld: { r: "high", g: "high", b: "high" },
      dmin: { r: "slight_high", g: "slight_high", b: "slight_high" }
    },
    signature: "all_high_fresh_tank",
    cause: "Fresh developer tank has too little starter - too active",
    action: "Add developer starter in 11mL/L increments. Recirculate 15 minutes before testing. Starter reduces fresh developer activity to match seasoned solution.",
    manual_ref: "Charts 9-10, Pages 5-37/38"
  },
  {
    id: 16,
    name: "Developer Starter - Too Much",
    pattern: {
      dmax: { r: "low", g: "low", b: "low" },
      hd: { r: "low", g: "low", b: "low" },
      ld: { r: "low", g: "low", b: "low" },
      dmin: { r: "slight_low", g: "slight_low", b: "slight_low" }
    },
    signature: "all_low_fresh_tank",
    cause: "Fresh developer tank has too much starter - restrained",
    action: "Add 39mL developer replenisher + 13mL water per litre of tank solution. Recirculate 15 minutes before testing.",
    manual_ref: "Charts 9-10, Pages 5-37/38"
  },
  {
    id: 17,
    name: "Developer Too Dilute",
    pattern: {
      dmax: { r: "low", g: "low", b: "low" },
      hd: { r: "low", g: "low", b: "low" },
      ld: { r: "low", g: "low", b: "low" },
      dmin: { r: "normal", g: "normal", b: "normal" }
    },
    signature: "all_low_dmin_normal",
    cause: "Developer tank solution diluted - too much water in mix or excessive evaporation top-off",
    action: "Check specific gravity with hydrometer. If diluted, replace tank solution. For evaporation: top off with water daily at start-up, not during processing.",
    manual_ref: "Chart 11, Page 5-39"
  },
  {
    id: 18,
    name: "Developer Too Concentrated",
    pattern: {
      dmax: { r: "high", g: "high", b: "high" },
      hd: { r: "high", g: "high", b: "high" },
      ld: { r: "high", g: "high", b: "high" },
      dmin: { r: "normal", g: "normal", b: "normal" }
    },
    signature: "all_high_dmin_normal",
    cause: "Developer over-concentrated from evaporation or insufficient water in mix",
    action: "Check specific gravity. Add water (max 5% of tank volume) if over-concentrated. Top off daily at start-up. Use floating lids on replenisher tanks.",
    manual_ref: "Chart 11, Page 5-39"
  },
  {
    id: 19,
    name: "Developer Oxidation",
    pattern: {
      dmax: { r: "low", g: "low", b: "low" },
      hdld: { r: "low", g: "low", b: "low" },
      ld: { r: "low", g: "low", b: "low" },
      dmin: { r: "normal", g: "normal", b: "normal" }
    },
    signature: "gradual_decline_all",
    cause: "Aerial oxidation of developer from air leaks, low utilization, or excessive agitation",
    action: "Use floating lids on all developer replenisher tanks. Check recirculation line for leaks allowing air in. Ensure at least one tank turnover every 4 weeks. Check for excessive burst agitation.",
    manual_ref: "Chart 12, Page 5-40"
  },
  {
    id: 20,
    name: "Developer Contaminated with Bleach",
    pattern: {
      dmin: { r: "high", g: "high", b: "high" },
      ld: { r: "high", g: "high", b: "high" },
      hdld: { r: "low", g: "low", b: "low" }
    },
    signature: "dmin_ld_high_hdld_low",
    cause: "Bleach contamination causing chemical fogging",
    action: "STOP PROCESSING. Very small amounts cause major issues. Check for bleach splashing into developer, contaminated leader cards. Dump developer, rinse tank thoroughly, mix fresh solution.",
    manual_ref: "Chart 13, Page 5-41"
  },
  {
    id: 21,
    name: "Developer Contaminated with Fixer",
    pattern: {
      dmax: { r: "high", g: "high", b: "high" },
      hd: { r: "high", g: "high", b: "high" },
      ld: { r: "high", g: "high", b: "high" },
      dmin: { r: "high", g: "very_high", b: "high" },
      hdld: { r: "high", g: "high", b: "high" }
    },
    signature: "all_high_dmin_red_highest",
    cause: "Fixer contamination causing chemical fogging - noticeable increase in red D-min",
    action: "STOP PROCESSING. Check for mixing equipment not properly cleaned, contaminated leader cards. Dump developer, rinse tank thoroughly, mix fresh solution.",
    manual_ref: "Chart 14, Page 5-42"
  },
  {
    id: 22,
    name: "Bleach Too Dilute",
    pattern: {
      dmaxb_yb: "high",
      hdld: { r: "normal", g: "normal", b: "slight_low" }
    },
    signature: "retained_silver_high",
    cause: "Bleach diluted by developer carryover or mix error - causing retained silver",
    action: "Check squeegees for developer carryover. Add Bleach Regenerator Concentrate (30mL) + Starter (15mL) per litre. Rebleach and refix affected film.",
    manual_ref: "Chart 15, Page 5-43"
  },
  {
    id: 23,
    name: "Bleach Underreplenished",
    pattern: {
      dmaxb_yb: "high",
      hdld: { r: "normal", g: "normal", b: "slight_low" },
      dmin: { b: "slight_high" }
    },
    signature: "retained_silver_blue_dmin_up",
    cause: "Bleach replenishment rate too low - not compensating for developer carryover",
    action: "Check replenishment rate and pump settings. Check developer exit squeegees. Add Bleach Parts A and B per litre of tank solution. Rebleach affected film.",
    manual_ref: "Charts 16-17, Pages 5-44/45"
  },
  {
    id: 24,
    name: "Bleach Poor Aeration",
    pattern: {
      dmaxb_yb: "high",
      hdld: { r: "low", g: "normal", b: "low" }
    },
    signature: "retained_silver_leuco_cyan",
    cause: "Inadequate bleach aeration - causing retained silver and leuco-cyan dye",
    action: "Check air bubbling in bleach tank. Verify air supply is adequate, tubing clear, distributor not clogged. Rebleach affected film in known good bleach, then complete remaining steps.",
    manual_ref: "Charts 18-19, Pages 5-46/47"
  },
  {
    id: 25,
    name: "Bleach Stain",
    pattern: {
      dmin: { r: "normal", g: "high", b: "normal" },
      ld: { r: "normal", g: "high", b: "normal" }
    },
    signature: "green_magenta_stain",
    cause: "Developer by-product in bleach causing magenta stain - usually from underaeration",
    action: "Correct aeration problem. May need to dump part or all of bleach tank. Activated carbon filter in recirculation may help if staining is minimal.",
    manual_ref: "Chart 20, Page 5-48"
  },
  {
    id: 26,
    name: "Fixer Too Dilute",
    pattern: {
      dmin: { r: "high", g: "high", b: "normal" },
      ld: { r: "high", g: "high", b: "normal" }
    },
    signature: "red_green_dmin_ld_high",
    cause: "Fixer diluted - retained silver halide and sensitizer dye. May appear milky in D-min areas.",
    action: "Check for excessive wash carryover, underreplenishment, or fixer sulfurization. Refix and rewash affected film. Replace fixer if sulfurized.",
    manual_ref: "Chart 21, Page 5-49"
  },
  {
    id: 27,
    name: "Fixer pH Too Low",
    pattern: {
      hdld: { r: "low", g: "normal", b: "normal" },
      ld: { r: "low", g: "normal", b: "normal" }
    },
    signature: "leuco_cyan_red_low",
    cause: "Fixer pH too low causing leuco-cyan dye - often from malfunctioning electrolytic silver recovery",
    action: "Check silver recovery unit operation. Replace fixer with fresh solution. Reprocess affected film starting from bleach step. Adjust pH to 6.5 ±0.5 for closed-loop systems.",
    manual_ref: "Chart 22, Page 5-50"
  }
];

// B&W Diagnostic Patterns (from Ilford FPC Manual)
const BW_DIAGNOSTICS = [
  {
    id: 101,
    name: "Developer Underactive",
    pattern: { ld: "low", hdld: "low" },
    cause: "Developer activity too low - possible causes: temperature low, time short, dilution, exhaustion, underreplenishment",
    action: "Check temperature (aim depends on developer). Check time. Check replenishment rate. If using replenisher system, add fresh developer or replenisher. Check specific gravity and pH.",
    manual_ref: "Ilford FPC Fault Finder"
  },
  {
    id: 102,
    name: "Developer Overactive",
    pattern: { ld: "high", hdld: "high" },
    cause: "Developer activity too high - possible causes: temperature high, time long, over-concentrated, over-replenishment",
    action: "Check temperature. Check time. If fresh chemistry, ensure correct starter amount used. Check replenishment rate. Remove some developer and replace with water if over-concentrated.",
    manual_ref: "Ilford FPC Fault Finder"
  },
  {
    id: 103,
    name: "Contrast Too Low",
    pattern: { ld: "normal", hdld: "low" },
    cause: "HD-LD low indicates low contrast - possible developer exhaustion, underreplenishment, or temperature/time issue",
    action: "Check developer activity. Increase development time slightly if process otherwise stable. Check replenishment. May need fresh developer if exhausted.",
    manual_ref: "Ilford FPC Fault Finder"
  },
  {
    id: 104,
    name: "Contrast Too High",
    pattern: { ld: "normal", hdld: "high" },
    cause: "HD-LD high indicates high contrast - possible over-development or developer issue",
    action: "Reduce development time slightly. Check for over-concentration from evaporation. Check temperature is not too high.",
    manual_ref: "Ilford FPC Fault Finder"
  },
  {
    id: 105,
    name: "Developer Contamination",
    pattern: { dmin: "high", ld: "high" },
    cause: "Chemical fogging - likely fixer or stop bath contamination in developer",
    action: "STOP PROCESSING. Check for contamination sources. Dump developer, clean tank thoroughly, mix fresh solution. Clean all racks and hangers.",
    manual_ref: "Ilford FPC Fault Finder"
  },
  {
    id: 106,
    name: "Gradual Drift Down",
    pattern: { trend: "gradual_decline" },
    cause: "Gradual decline in LD and/or HD-LD over multiple readings - developer becoming exhausted or underreplenished",
    action: "Check replenishment rate. Top up with fresh developer. If using replenisher, check concentration and rate. May need partial tank dump and fresh solution.",
    manual_ref: "Ilford FPC Fault Finder"
  }
];

// Main diagnostic function
function diagnoseC41(readings, reference) {
  const deviations = calculateDeviations(readings, reference);
  const status = checkTolerances(deviations, 'c41');
  const problems = [];
  
  // Check for retained silver first (most critical)
  const dmaxb_yb = readings.dmax.b - readings.yellow_b;
  const ref_dmaxb_yb = reference.dmax.b - (reference.yellow_b || reference.dmin.b);
  const dmaxb_yb_dev = dmaxb_yb - ref_dmaxb_yb;
  
  if (dmaxb_yb_dev > TOLERANCES.c41.dmaxb_yb.action) {
    // Retained silver detected - check which bleach issue
    problems.push(...matchRetainedSilverPattern(deviations));
  }
  
  // Check for developer issues
  problems.push(...matchDeveloperPattern(deviations));
  
  // Check for fixer issues
  problems.push(...matchFixerPattern(deviations));
  
  // Check for color spread issues
  const spread = checkColorSpread(deviations);
  if (spread.exceeded) {
    problems.push({
      severity: 'warning',
      issue: 'Color Balance Spread Exceeded',
      details: `Spread of ${spread.value} exceeds limit of ${TOLERANCES.c41.spread}`,
      action: 'Check for contamination or mix errors. See diagnostic charts E.'
    });
  }
  
  return {
    deviations,
    status,
    problems: problems.length > 0 ? problems : [{ severity: 'ok', issue: 'Process within limits', action: 'Continue normal operation' }],
    dmaxb_yb: { value: dmaxb_yb_dev, limit: TOLERANCES.c41.dmaxb_yb.control }
  };
}

function diagnoseBW(readings, reference) {
  const ld_dev = readings.ld - reference.ld;
  const hdld = readings.hd - readings.ld;
  const ref_hdld = reference.hd - reference.ld;
  const hdld_dev = hdld - ref_hdld;
  const dmin_dev = readings.dmin - reference.dmin;
  
  const deviations = { ld: ld_dev, hdld: hdld_dev, dmin: dmin_dev };
  const status = checkTolerances(deviations, 'bw');
  const problems = [];
  
  // Pattern matching for B&W
  if (ld_dev < -TOLERANCES.bw.ld.action && hdld_dev < -TOLERANCES.bw.hdld.action) {
    problems.push({
      ...BW_DIAGNOSTICS[0], // Underactive
      severity: 'action'
    });
  } else if (ld_dev > TOLERANCES.bw.ld.action && hdld_dev > TOLERANCES.bw.hdld.action) {
    problems.push({
      ...BW_DIAGNOSTICS[1], // Overactive
      severity: 'action'
    });
  } else if (Math.abs(ld_dev) <= TOLERANCES.bw.ld.action && hdld_dev < -TOLERANCES.bw.hdld.action) {
    problems.push({
      ...BW_DIAGNOSTICS[2], // Low contrast
      severity: 'action'
    });
  } else if (Math.abs(ld_dev) <= TOLERANCES.bw.ld.action && hdld_dev > TOLERANCES.bw.hdld.action) {
    problems.push({
      ...BW_DIAGNOSTICS[3], // High contrast
      severity: 'action'
    });
  } else if (dmin_dev > 3 && ld_dev > TOLERANCES.bw.ld.action) {
    problems.push({
      ...BW_DIAGNOSTICS[4], // Contamination
      severity: 'control'
    });
  }
  
  return {
    deviations,
    status,
    hdld: hdld,
    problems: problems.length > 0 ? problems : [{ severity: 'ok', issue: 'Process within limits', action: 'Continue normal operation' }]
  };
}

function calculateDeviations(readings, reference) {
  const dev = {};
  for (const patch of ['dmax', 'hd', 'ld', 'dmin']) {
    dev[patch] = {};
    for (const channel of ['r', 'g', 'b']) {
      dev[patch][channel] = readings[patch][channel] - reference[patch][channel];
    }
  }
  // Calculate HD-LD deviations
  dev.hdld = {};
  for (const channel of ['r', 'g', 'b']) {
    const hdld = readings.hd[channel] - readings.ld[channel];
    const ref_hdld = reference.hd[channel] - reference.ld[channel];
    dev.hdld[channel] = hdld - ref_hdld;
  }
  return dev;
}

function checkTolerances(deviations, process) {
  const tol = TOLERANCES[process];
  const status = { overall: 'ok', details: [] };
  
  if (process === 'c41') {
    // Check each measurement type
    for (const patch of ['dmin', 'ld']) {
      for (const channel of ['r', 'g', 'b']) {
        const val = Math.abs(deviations[patch][channel]);
        const t = tol[patch];
        if (val > t.control) {
          status.overall = 'control';
          status.details.push({ patch, channel, value: deviations[patch][channel], level: 'control' });
        } else if (val > t.action && status.overall !== 'control') {
          status.overall = 'action';
          status.details.push({ patch, channel, value: deviations[patch][channel], level: 'action' });
        }
      }
    }
    // Check HD-LD
    for (const channel of ['r', 'g', 'b']) {
      const val = Math.abs(deviations.hdld[channel]);
      if (val > tol.hdld.control) {
        status.overall = 'control';
        status.details.push({ patch: 'hdld', channel, value: deviations.hdld[channel], level: 'control' });
      } else if (val > tol.hdld.action && status.overall !== 'control') {
        status.overall = 'action';
        status.details.push({ patch: 'hdld', channel, value: deviations.hdld[channel], level: 'action' });
      }
    }
  } else {
    // B&W
    if (Math.abs(deviations.ld) > tol.ld.control || Math.abs(deviations.hdld) > tol.hdld.control) {
      status.overall = 'control';
    } else if (Math.abs(deviations.ld) > tol.ld.action || Math.abs(deviations.hdld) > tol.hdld.action) {
      status.overall = 'action';
    }
  }
  
  return status;
}

function checkColorSpread(deviations) {
  // Color spread is the difference between most widely separated HD-LD densities
  const hdld_vals = [deviations.hdld.r, deviations.hdld.g, deviations.hdld.b];
  const spread = Math.max(...hdld_vals) - Math.min(...hdld_vals);
  return {
    value: spread,
    exceeded: spread > TOLERANCES.c41.spread
  };
}

function matchRetainedSilverPattern(deviations) {
  const problems = [];
  // Check if it's bleach dilution, underreplenishment, or poor aeration
  const hdld_r = deviations.hdld.r;
  const hdld_b = deviations.hdld.b;
  
  if (hdld_r < -5 && hdld_b < -5) {
    problems.push({ ...C41_DIAGNOSTICS.find(d => d.id === 24), severity: 'control' }); // Poor aeration
  } else if (deviations.dmin.b > 3) {
    problems.push({ ...C41_DIAGNOSTICS.find(d => d.id === 23), severity: 'control' }); // Underreplenished
  } else {
    problems.push({ ...C41_DIAGNOSTICS.find(d => d.id === 22), severity: 'control' }); // Too dilute
  }
  return problems;
}

function matchDeveloperPattern(deviations) {
  const problems = [];
  const avg_dmax = (deviations.dmax.r + deviations.dmax.g + deviations.dmax.b) / 3;
  const avg_hd = (deviations.hd.r + deviations.hd.g + deviations.hd.b) / 3;
  const avg_ld = (deviations.ld.r + deviations.ld.g + deviations.ld.b) / 3;
  const avg_dmin = (deviations.dmin.r + deviations.dmin.g + deviations.dmin.b) / 3;
  
  // All low - underactive developer
  if (avg_dmax < -8 && avg_hd < -8 && avg_ld < -4) {
    if (Math.abs(avg_dmin) < 3) {
      // D-min normal - temp/time/dilution issue
      problems.push({ 
        severity: 'action',
        name: 'Developer Underactive',
        cause: 'Temperature too low, time too short, or developer diluted',
        action: 'Check developer temperature (aim 37.8°C). Check time (aim 3:15). Check specific gravity. If diluted, may need to replace tank solution.',
        manual_ref: 'Charts 1-3, 11, 17'
      });
    } else if (avg_dmin < -3) {
      // D-min also low - likely underreplenishment or oxidation
      problems.push({ ...C41_DIAGNOSTICS.find(d => d.id === 7), severity: 'action' });
    }
  }
  
  // All high - overactive developer
  if (avg_dmax > 8 && avg_hd > 8 && avg_ld > 4) {
    if (Math.abs(avg_dmin) < 3) {
      problems.push({
        severity: 'action',
        name: 'Developer Overactive',
        cause: 'Temperature too high, time too long, or developer over-concentrated',
        action: 'Check developer temperature (aim 37.8°C). Check time (aim 3:15). If over-concentrated from evaporation, add water (max 5% of tank volume).',
        manual_ref: 'Charts 1-2, 11, 18'
      });
    } else if (avg_dmin > 3) {
      // D-min also high - contamination or overreplenishment
      if (deviations.dmin.r > deviations.dmin.g && deviations.dmin.r > deviations.dmin.b) {
        problems.push({ ...C41_DIAGNOSTICS.find(d => d.id === 21), severity: 'control' }); // Fixer contamination
      } else {
        problems.push({ ...C41_DIAGNOSTICS.find(d => d.id === 20), severity: 'control' }); // Bleach contamination
      }
    }
  }
  
  // Check for Part A/B/C mix errors (characteristic patterns)
  if (Math.abs(deviations.hdld.r) > 10 && Math.abs(deviations.hdld.g) < 6 && Math.abs(deviations.hdld.b) < 6) {
    if (deviations.hdld.r > 0) {
      problems.push({ ...C41_DIAGNOSTICS.find(d => d.id === 10), severity: 'action' }); // Part A high
    } else {
      problems.push({ ...C41_DIAGNOSTICS.find(d => d.id === 9), severity: 'action' }); // Part A low
    }
  }
  
  if (Math.abs(deviations.hdld.b) > 10 && Math.abs(deviations.hdld.r) < 6) {
    if (deviations.hdld.b < 0) {
      problems.push({ ...C41_DIAGNOSTICS.find(d => d.id === 13), severity: 'action' }); // Part C low
    } else {
      problems.push({ ...C41_DIAGNOSTICS.find(d => d.id === 14), severity: 'action' }); // Part C high
    }
  }
  
  return problems;
}

function matchFixerPattern(deviations) {
  const problems = [];
  
  // Fixer dilute - red and green D-min/LD high, blue normal
  if (deviations.dmin.r > 5 && deviations.dmin.g > 5 && Math.abs(deviations.dmin.b) < 3) {
    problems.push({ ...C41_DIAGNOSTICS.find(d => d.id === 26), severity: 'action' });
  }
  
  // Fixer pH too low - leuco-cyan (red low)
  if (deviations.hdld.r < -8 && Math.abs(deviations.hdld.g) < 4 && Math.abs(deviations.hdld.b) < 4) {
    problems.push({ ...C41_DIAGNOSTICS.find(d => d.id === 27), severity: 'action' });
  }
  
  return problems;
}

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { diagnoseC41, diagnoseBW, TOLERANCES, C41_DIAGNOSTICS, BW_DIAGNOSTICS };
}
