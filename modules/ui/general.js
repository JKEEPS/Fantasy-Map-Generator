"use strict";
// Module to store generic UI functions

window.addEventListener("resize", function (e) {
  if (stored("mapWidth") && stored("mapHeight")) return;
  mapWidthInput.value = window.innerWidth;
  mapHeightInput.value = window.innerHeight;
  fitMapToScreen();
});

if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
  window.onbeforeunload = () => "Are you sure you want to navigate away?";
}

// Tooltips
const tooltip = document.getElementById("tooltip");

// show tip for non-svg elemets with data-tip
document.getElementById("dialogs").addEventListener("mousemove", showDataTip);
document.getElementById("optionsContainer").addEventListener("mousemove", showDataTip);
document.getElementById("exitCustomization").addEventListener("mousemove", showDataTip);

const tipBackgroundMap = {
  info: "linear-gradient(0.1turn, #ffffff00, #5e5c5c80, #ffffff00)",
  success: "linear-gradient(0.1turn, #ffffff00, #127912cc, #ffffff00)",
  warn: "linear-gradient(0.1turn, #ffffff00, #be5d08cc, #ffffff00)",
  error: "linear-gradient(0.1turn, #ffffff00, #e11d1dcc, #ffffff00)"
};

function tip(tip, main = false, type = "info", time = 0) {
  tooltip.innerHTML = tip;
  tooltip.style.background = tipBackgroundMap[type];

  if (main) {
    tooltip.dataset.main = tip;
    tooltip.dataset.color = tooltip.style.background;
  }
  if (time) setTimeout(clearMainTip, time);
}

function showMainTip() {
  tooltip.style.background = tooltip.dataset.color;
  tooltip.innerHTML = tooltip.dataset.main;
}

function clearMainTip() {
  tooltip.dataset.color = "";
  tooltip.dataset.main = "";
  tooltip.innerHTML = "";
}

const cellInfoTabs = document.getElementById("cellInfoTabs");
if (cellInfoTabs) {
  cellInfoTabs.addEventListener("click", event => {
    const button = event.target.closest("button[data-page]");
    if (!button) return;
    showCellInfoPage(button.dataset.page);
  });
}

function showCellInfoPage(page = "cell") {
  const tabs = document.querySelectorAll("#cellInfoTabs button[data-page]");
  tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.page === page));

  const pages = document.querySelectorAll("#cellInfo .cell-info-page");
  pages.forEach(section => section.classList.toggle("hidden", section.dataset.page !== page));
}

window.showCellInfoPage = showCellInfoPage;

const gridLoreInput = byId("infoGridLore");
const gridLocationsSelect = byId("infoGridLocationsSelect");
const gridLocationNameInput = byId("infoGridLocationName");
const gridLocationLoreInput = byId("infoGridLocationLore");
const gridLocationAddButton = byId("infoGridLocationAdd");
const gridLocationRemoveButton = byId("infoGridLocationRemove");
const gridLocationPopoutButton = byId("infoGridLocationPopout");
const gridCharactersSelect = byId("infoGridCharactersSelect");
const gridCharacterNameInput = byId("infoGridCharacterName");
const gridCharacterLoreInput = byId("infoGridCharacterLore");
const gridCharacterAddButton = byId("infoGridCharacterAdd");
const gridCharacterRemoveButton = byId("infoGridCharacterRemove");
const gridCharacterPopoutButton = byId("infoGridCharacterPopout");
const gridEntityEditor = byId("gridEntityEditor");
const gridEntityEditorName = byId("gridEntityEditorName");
const gridEntityEditorLore = byId("gridEntityEditorLore");

const gridEntityControls = {
  locations: {
    property: "locations",
    label: "location",
    select: gridLocationsSelect,
    addButton: gridLocationAddButton,
    removeButton: gridLocationRemoveButton,
    popoutButton: gridLocationPopoutButton,
    nameInput: gridLocationNameInput,
    loreInput: gridLocationLoreInput,
    defaultName: "New location",
    emptyLabel: "No locations"
  },
  characters: {
    property: "characters",
    label: "character",
    select: gridCharactersSelect,
    addButton: gridCharacterAddButton,
    removeButton: gridCharacterRemoveButton,
    popoutButton: gridCharacterPopoutButton,
    nameInput: gridCharacterNameInput,
    loreInput: gridCharacterLoreInput,
    defaultName: "New character",
    emptyLabel: "No characters"
  }
};

const gridEntitySelection = {locations: null, characters: null};
let currentGridCellId = null;
let currentPackCellId = null;
let syncGridDetails = false;
let activeGridEntityEditor = null;

gridLoreInput?.addEventListener("input", handleGridLoreInput);

gridLocationAddButton?.addEventListener("click", () => handleGridEntityAdd("locations"));
gridLocationRemoveButton?.addEventListener("click", () => handleGridEntityRemove("locations"));
gridLocationPopoutButton?.addEventListener("click", () => handleGridEntityPopout("locations"));
gridLocationsSelect?.addEventListener("change", () => handleGridEntitySelectionChange("locations"));
gridLocationNameInput?.addEventListener("input", () => handleGridEntityNameInput("locations"));
gridLocationLoreInput?.addEventListener("input", () => handleGridEntityLoreInput("locations"));

gridCharacterAddButton?.addEventListener("click", () => handleGridEntityAdd("characters"));
gridCharacterRemoveButton?.addEventListener("click", () => handleGridEntityRemove("characters"));
gridCharacterPopoutButton?.addEventListener("click", () => handleGridEntityPopout("characters"));
gridCharactersSelect?.addEventListener("change", () => handleGridEntitySelectionChange("characters"));
gridCharacterNameInput?.addEventListener("input", () => handleGridEntityNameInput("characters"));
gridCharacterLoreInput?.addEventListener("input", () => handleGridEntityLoreInput("characters"));

gridEntityEditorName?.addEventListener("input", handleGridEntityEditorNameInput);
gridEntityEditorLore?.addEventListener("input", handleGridEntityEditorLoreInput);

// show tip at the bottom of the screen, consider possible translation
function showDataTip(event) {
  if (!event.target) return;

  let dataTip = event.target.dataset.tip;
  if (!dataTip && event.target.parentNode.dataset.tip) dataTip = event.target.parentNode.dataset.tip;
  if (!dataTip) return;

  const shortcut = event.target.dataset.shortcut;
  if (shortcut && !MOBILE) dataTip += `. Shortcut: ${shortcut}`;

  //const tooltip = lang === "en" ? dataTip : translate(e.target.dataset.t || e.target.parentNode.dataset.t, dataTip);
  tip(dataTip);
}

function showElementLockTip(event) {
  const locked = event?.target?.classList?.contains("icon-lock");
  if (locked) {
    tip("Locked. Click to unlock the element and allow it to be changed by regeneration tools");
  } else {
    tip("Unlocked. Click to lock the element and prevent changes to it by regeneration tools");
  }
}

const onMouseMove = debounce(handleMouseMove, 100);
function handleMouseMove() {
  const point = d3.mouse(this);
  const i = findCell(point[0], point[1]); // pack cell id
  if (i === undefined) return;

  showNotes(d3.event);
  const gridCell = findGridCell(point[0], point[1], grid);
  if (tooltip.dataset.main) showMainTip();
  else showMapTooltip(point, d3.event, i, gridCell);
  if (cellInfo?.offsetParent) updateCellInfo(point, i, gridCell);
}

let currentNoteId = null; // store currently displayed node to not rerender to often

// show note box on hover (if any)
function showNotes(e) {
  if (notesEditor?.offsetParent) return;
  let id = e.target.id || e.target.parentNode.id || e.target.parentNode.parentNode.id;
  if (e.target.parentNode.parentNode.id === "burgLabels") id = "burg" + e.target.dataset.id;
  else if (e.target.parentNode.parentNode.id === "burgIcons") id = "burg" + e.target.dataset.id;

  const note = notes.find(note => note.id === id);
  if (note !== undefined && note.legend !== "") {
    if (currentNoteId === id) return;
    currentNoteId = id;

    document.getElementById("notes").style.display = "block";
    document.getElementById("notesHeader").innerHTML = note.name;
    document.getElementById("notesBody").innerHTML = note.legend;
  } else if (!options.pinNotes && !markerEditor?.offsetParent && !e.shiftKey) {
    document.getElementById("notes").style.display = "none";
    document.getElementById("notesHeader").innerHTML = "";
    document.getElementById("notesBody").innerHTML = "";
    currentNoteId = null;
  }
}

// show viewbox tooltip if main tooltip is blank
function showMapTooltip(point, e, i, g) {
  tip(""); // clear tip
  const path = e.composedPath ? e.composedPath() : getComposedPath(e.target); // apply polyfill
  if (!path[path.length - 8]) return;
  const group = path[path.length - 7].id;
  const subgroup = path[path.length - 8].id;
  const land = pack.cells.h[i] >= 20;

  // specific elements
  if (group === "armies") return tip(e.target.parentNode.dataset.name + ". Click to edit");

  if (group === "emblems" && e.target.tagName === "use") {
    const parent = e.target.parentNode;
    const [g, type] =
      parent.id === "burgEmblems"
        ? [pack.burgs, "burg"]
        : parent.id === "provinceEmblems"
        ? [pack.provinces, "province"]
        : [pack.states, "state"];
    const i = +e.target.dataset.i;
    if (event.shiftKey) highlightEmblemElement(type, g[i]);

    d3.select(e.target).raise();
    d3.select(parent).raise();

    const name = g[i].fullName || g[i].name;
    tip(`${name} ${type} emblem. Click to edit. Hold Shift to show associated area or place`);
    return;
  }

  if (group === "rivers") {
    const river = +e.target.id.slice(5);
    const r = pack.rivers.find(r => r.i === river);
    const name = r ? r.name + " " + r.type : "";
    tip(name + ". Click to edit");
    if (riversOverview?.offsetParent) highlightEditorLine(riversOverview, river, 5000);
    return;
  }

  if (group === "routes") {
    const routeId = +e.target.id.slice(5);
    const route = pack.routes.find(route => route.i === routeId);
    if (route) {
      if (route.name) return tip(`${route.name}. Click to edit the Route`);
      return tip("Click to edit the Route");
    }
  }

  if (group === "terrain") return tip("Click to edit the Relief Icon");

  if (subgroup === "burgLabels" || subgroup === "burgIcons") {
    const burgId = +path[path.length - 10].dataset.id;
    if (burgId) {
      const burg = pack.burgs[burgId];
      const population = si(burg.population * populationRate * urbanization);
      tip(`${burg.name}. Population: ${population}. Click to edit`);
      if (burgsOverview?.offsetParent) highlightEditorLine(burgsOverview, burgId, 5000);
      return;
    }
  }

  if (group === "labels") return tip("Click to edit the Label");

  if (group === "markers") return tip("Click to edit the Marker. Hold Shift to not close the assosiated note");

  if (group === "ruler") {
    const tag = e.target.tagName;
    const className = e.target.getAttribute("class");
    if (tag === "circle" && className === "edge")
      return tip("Drag to adjust. Hold Ctrl and drag to add a point. Click to remove the point");
    if (tag === "circle" && className === "control")
      return tip("Drag to adjust. Hold Shift and drag to keep axial direction. Click to remove the point");
    if (tag === "circle") return tip("Drag to adjust the measurer");
    if (tag === "polyline") return tip("Click on drag to add a control point");
    if (tag === "path") return tip("Drag to move the measurer");
    if (tag === "text") return tip("Drag to move, click to remove the measurer");
  }

  if (subgroup === "burgIcons") return tip("Click to edit the Burg");

  if (subgroup === "burgLabels") return tip("Click to edit the Burg");

  if (group === "lakes" && !land) {
    const lakeId = +e.target.dataset.f;
    const name = pack.features[lakeId]?.name;
    const fullName = subgroup === "freshwater" ? name : name + " " + subgroup;
    tip(`${fullName} lake. Click to edit`);
    return;
  }
  if (group === "coastline") return tip("Click to edit the coastline");

  if (group === "zones") {
    const element = path[path.length - 8];
    const zoneId = +element.dataset.id;
    const zone = pack.zones.find(zone => zone.i === zoneId);
    tip(zone.name);
    if (zonesEditor?.offsetParent) highlightEditorLine(zonesEditor, zoneId, 5000);
    return;
  }

  if (group === "ice") return tip("Click to edit the Ice");

  // covering elements
  if (layerIsOn("togglePrecipitation") && land) tip("Annual Precipitation: " + getFriendlyPrecipitation(i));
  else if (layerIsOn("togglePopulation")) tip(getPopulationTip(i));
  else if (layerIsOn("toggleTemperature")) tip("Temperature: " + convertTemperature(grid.cells.temp[g]));
  else if (layerIsOn("toggleBiomes") && pack.cells.biome[i]) {
    const biome = pack.cells.biome[i];
    tip("Biome: " + biomesData.name[biome]);
    if (biomesEditor?.offsetParent) highlightEditorLine(biomesEditor, biome);
  } else if (layerIsOn("toggleReligions") && pack.cells.religion[i]) {
    const religion = pack.cells.religion[i];
    const r = pack.religions[religion];
    const type = r.type === "Cult" || r.type == "Heresy" ? r.type : r.type + " religion";
    tip(type + ": " + r.name);
    if (byId("religionsEditor")?.offsetParent) highlightEditorLine(religionsEditor, religion);
  } else if (pack.cells.state[i] && (layerIsOn("toggleProvinces") || layerIsOn("toggleStates"))) {
    const state = pack.cells.state[i];
    const stateName = pack.states[state].fullName;
    const province = pack.cells.province[i];
    const prov = province ? pack.provinces[province].fullName + ", " : "";
    tip(prov + stateName);
    if (document.getElementById("statesEditor")?.offsetParent) highlightEditorLine(statesEditor, state);
    if (document.getElementById("diplomacyEditor")?.offsetParent) highlightEditorLine(diplomacyEditor, state);
    if (document.getElementById("militaryOverview")?.offsetParent) highlightEditorLine(militaryOverview, state);
    if (document.getElementById("provincesEditor")?.offsetParent) highlightEditorLine(provincesEditor, province);
  } else if (layerIsOn("toggleCultures") && pack.cells.culture[i]) {
    const culture = pack.cells.culture[i];
    tip("Culture: " + pack.cultures[culture].name);
    if (document.getElementById("culturesEditor")?.offsetParent) highlightEditorLine(culturesEditor, culture);
  } else if (layerIsOn("toggleHeight")) tip("Height: " + getFriendlyHeight(point));
}

function highlightEditorLine(editor, id, timeout = 10000) {
  Array.from(editor.getElementsByClassName("states hovered")).forEach(el => el.classList.remove("hovered")); // clear all hovered
  const hovered = Array.from(editor.querySelectorAll("div")).find(el => el.dataset.id == id);
  if (hovered) hovered.classList.add("hovered"); // add hovered class
  if (timeout)
    setTimeout(() => {
      hovered && hovered.classList.remove("hovered");
    }, timeout);
}

// get cell info on mouse move
function updateCellInfo(point, i, g) {
  const cells = pack.cells;
  currentPackCellId = i;
  currentGridCellId = g;
  if (activeGridEntityEditor && activeGridEntityEditor.cellId !== g) closeGridEntityEditor();
  const x = rn(point[0]);
  const y = rn(point[1]);

  infoX.innerHTML = x;
  infoY.innerHTML = y;

  const latitude = getLatitude(y, 4);
  const longitude = getLongitude(x, 4);
  infoLat.innerHTML = toDMS(latitude, "lat");
  infoLon.innerHTML = toDMS(longitude, "lon");
  infoGeozone.innerHTML = getGeozone(latitude);

  infoCell.innerHTML = i;
  infoArea.innerHTML = cells.area[i] ? `${si(getArea(cells.area[i]))} ${getAreaUnit()}` : "n/a";

  const featureId = cells.f[i];
  const feature = featureId ? pack.features[featureId] : null;
  const isLand = cells.h[i] >= 20;

  infoCellSurface.innerHTML = isLand ? "Land" : "Water";
  const cellDistance = pack.cells.t ? pack.cells.t[i] : undefined;
  infoCellDistance.innerHTML = getDistanceToCoastLabel(cellDistance, isLand);

  infoFeature.innerHTML = formatFeatureLabel(feature, featureId);
  infoBiome.innerHTML = biomesData.name[cells.biome[i]] || "n/a";

  infoTemp.innerHTML = convertTemperature(grid.cells.temp[g]);
  infoPrec.innerHTML = isLand ? getFriendlyPrecipitation(i) : "n/a";
  infoElevation.innerHTML = feature ? getElevation(feature, pack.cells.h[i]) : "n/a";
  infoDepth.innerHTML = feature ? getDepth(feature, point) : "n/a";
  infoRiver.innerHTML = isLand && cells.r[i] ? getRiverInfo(cells.r[i]) : "no";
  infoPopulation.innerHTML = getFriendlyPopulation(i);
  infoBurg.innerHTML = cells.burg[i] ? `${pack.burgs[cells.burg[i]].name} (${cells.burg[i]})` : "no";

  infoState.innerHTML = isLand
    ? cells.state[i]
      ? `${pack.states[cells.state[i]].fullName} (${cells.state[i]})`
      : "neutral lands (0)"
    : "no";

  infoProvince.innerHTML = cells.province[i]
    ? `${pack.provinces[cells.province[i]].fullName} (${cells.province[i]})`
    : "no";

  infoCulture.innerHTML = cells.culture[i] ? `${pack.cultures[cells.culture[i]].name} (${cells.culture[i]})` : "no";
  infoReligion.innerHTML = cells.religion[i]
    ? `${pack.religions[cells.religion[i]].name} (${cells.religion[i]})`
    : "no";

  const gridPoint = grid.points[g];
  if (!gridPoint) return;

  const [gx, gy] = gridPoint;
  infoGridCell.innerHTML = g;
  infoGridX.innerHTML = rn(gx);
  infoGridY.innerHTML = rn(gy);

  const gridLatitude = getLatitude(gy, 4);
  const gridLongitude = getLongitude(gx, 4);
  infoGridLat.innerHTML = toDMS(gridLatitude, "lat");
  infoGridLon.innerHTML = toDMS(gridLongitude, "lon");
  infoGridGeozone.innerHTML = getGeozone(gridLatitude);

  const gridHeight = grid.cells.h[g];
  const gridLand = gridHeight >= 20;
  infoGridSurface.innerHTML = gridLand ? "Land" : "Water";

  const gridDistance = grid.cells.t ? grid.cells.t[g] : undefined;
  infoGridDistance.innerHTML = getDistanceToCoastLabel(gridDistance, gridLand);

  const gridFeatureId = grid.cells.f ? grid.cells.f[g] : null;
  const gridFeature = gridFeatureId ? grid.features?.[gridFeatureId] : null;
  infoGridFeature.innerHTML = formatFeatureLabel(gridFeature, gridFeatureId);

  infoGridElevation.innerHTML = gridLand ? `${getHeight(gridHeight)} (${gridHeight})` : "n/a";
  infoGridDepth.innerHTML = gridLand ? `0 ${heightUnit.value}` : `${getHeight(gridHeight, "abs")} (${gridHeight})`;
  infoGridTemp.innerHTML = convertTemperature(grid.cells.temp[g]);
  infoGridPrec.innerHTML = getPrecipitation(grid.cells.prec[g]);
  infoGridNeighbors.innerHTML = grid.cells.c[g]?.length ?? 0;
  infoGridSpacing.innerHTML = `${rn(grid.spacing, 2)} px`;

  const cellDetails = ensureGridCellDetails(g, false);
  syncGridMetadataUI(cellDetails);
}

function syncGridMetadataUI(details) {
  const metadata = details || {lore: "", locations: [], characters: []};
  updateGridLoreUI(metadata);
  populateGridEntityUI(metadata, "locations");
  populateGridEntityUI(metadata, "characters");
  refreshGridEntityEditor();
}

function updateGridLoreUI(metadata) {
  if (!gridLoreInput) return;
  const previousSync = syncGridDetails;
  syncGridDetails = true;

  if (currentGridCellId === null) {
    gridLoreInput.value = "";
    gridLoreInput.disabled = true;
  } else {
    gridLoreInput.disabled = false;
    gridLoreInput.value = metadata.lore || "";
  }

  syncGridDetails = previousSync;
}

function populateGridEntityUI(metadata, type, preferredId) {
  const controls = gridEntityControls[type];
  if (!controls?.select) return;

  const hasCell = currentGridCellId !== null;
  controls.addButton && (controls.addButton.disabled = !hasCell);

  const list = Array.isArray(metadata[controls.property]) ? metadata[controls.property] : [];
  const previousSync = syncGridDetails;
  syncGridDetails = true;

  const select = controls.select;
  select.options.length = 0;

  if (!list.length) {
    select.options.add(new Option(controls.emptyLabel, "", true, true));
    select.disabled = true;
    controls.removeButton && (controls.removeButton.disabled = true);
    controls.popoutButton && (controls.popoutButton.disabled = true);
    if (controls.nameInput) {
      controls.nameInput.value = "";
      controls.nameInput.disabled = true;
    }
    if (controls.loreInput) {
      controls.loreInput.value = "";
      controls.loreInput.disabled = true;
    }
    gridEntitySelection[type] = null;
    syncGridDetails = previousSync;
    return;
  }

  select.disabled = false;
  list.forEach(entity => {
    select.options.add(new Option(entity.name || `Unnamed ${controls.label}`, entity.id));
  });

  const existingId = preferredId && list.some(entity => entity.id === preferredId) ? preferredId : gridEntitySelection[type];
  const nextId =
    existingId && list.some(entity => entity.id === existingId) ? existingId : list.length ? list[0].id : null;

  gridEntitySelection[type] = nextId;
  select.value = nextId || "";

  const selected = list.find(entity => entity.id === nextId) || null;
  controls.removeButton && (controls.removeButton.disabled = !selected);
  controls.popoutButton && (controls.popoutButton.disabled = !selected);
  if (controls.nameInput) {
    controls.nameInput.disabled = !selected;
    controls.nameInput.value = selected?.name || "";
  }
  if (controls.loreInput) {
    controls.loreInput.disabled = !selected;
    controls.loreInput.value = selected?.lore || "";
  }

  syncGridDetails = previousSync;
}

function handleGridLoreInput() {
  if (syncGridDetails || currentGridCellId === null) return;
  const details = ensureGridCellDetails(currentGridCellId, true);
  details.lore = gridLoreInput.value;
}

function handleGridEntityAdd(type) {
  if (currentGridCellId === null) return tip("Hover a grid square to select it first", false, "warn", 3000);
  const controls = gridEntityControls[type];
  if (!controls) return;

  const details = ensureGridCellDetails(currentGridCellId, true);
  const list = details[controls.property];
  const entity = createCellEntity(controls.label, controls.defaultName);
  list.push(entity);
  gridEntitySelection[type] = entity.id;
  populateGridEntityUI(details, type, entity.id);
  controls.nameInput?.focus();
}

function handleGridEntityRemove(type) {
  if (currentGridCellId === null) return;
  const controls = gridEntityControls[type];
  if (!controls) return;

  const selectionId = gridEntitySelection[type];
  if (!selectionId) return;

  const details = ensureGridCellDetails(currentGridCellId, true);
  const list = details[controls.property];
  const index = list.findIndex(entity => entity.id === selectionId);
  if (index === -1) return;

  list.splice(index, 1);
  const fallbackEntity = list[index] || list[index - 1] || null;
  gridEntitySelection[type] = fallbackEntity ? fallbackEntity.id : null;
  if (activeGridEntityEditor && activeGridEntityEditor.type === type && activeGridEntityEditor.id === selectionId) {
    closeGridEntityEditor();
  }
  populateGridEntityUI(details, type, gridEntitySelection[type]);
}

function handleGridEntitySelectionChange(type) {
  if (syncGridDetails) return;
  const controls = gridEntityControls[type];
  if (!controls?.select) return;

  const selectedId = controls.select.value || null;
  gridEntitySelection[type] = selectedId;

  const details = ensureGridCellDetails(currentGridCellId, false);
  const entity = getGridEntityById(details, type, selectedId);

  const previousSync = syncGridDetails;
  syncGridDetails = true;

  controls.removeButton && (controls.removeButton.disabled = !entity);
  if (controls.nameInput) {
    controls.nameInput.disabled = !entity;
    controls.nameInput.value = entity?.name || "";
  }
  if (controls.loreInput) {
    controls.loreInput.disabled = !entity;
    controls.loreInput.value = entity?.lore || "";
  }

  controls.popoutButton && (controls.popoutButton.disabled = !entity);

  syncGridDetails = previousSync;

  if (activeGridEntityEditor && activeGridEntityEditor.type === type) {
    if (!entity) closeGridEntityEditor();
    else {
      activeGridEntityEditor.id = selectedId;
      activeGridEntityEditor.cellId = currentGridCellId;
      refreshGridEntityEditor();
    }
  }
}

function handleGridEntityNameInput(type) {
  if (syncGridDetails || currentGridCellId === null) return;
  const controls = gridEntityControls[type];
  if (!controls?.nameInput) return;

  const selectedId = gridEntitySelection[type];
  if (!selectedId) return;

  const details = ensureGridCellDetails(currentGridCellId, true);
  const entity = getGridEntityById(details, type, selectedId);
  if (!entity) return;

  entity.name = controls.nameInput.value;
  updateGridEntityOptionLabel(type, selectedId, entity.name);
  if (activeGridEntityEditor && activeGridEntityEditor.type === type && activeGridEntityEditor.id === selectedId) {
    gridEntityEditorName.value = entity.name || "";
  }
}

function handleGridEntityLoreInput(type) {
  if (syncGridDetails || currentGridCellId === null) return;
  const controls = gridEntityControls[type];
  if (!controls?.loreInput) return;

  const selectedId = gridEntitySelection[type];
  if (!selectedId) return;

  const details = ensureGridCellDetails(currentGridCellId, true);
  const entity = getGridEntityById(details, type, selectedId);
  if (!entity) return;

  entity.lore = controls.loreInput.value;
  if (activeGridEntityEditor && activeGridEntityEditor.type === type && activeGridEntityEditor.id === selectedId) {
    gridEntityEditorLore.value = entity.lore || "";
  }
}

function ensureGridCellDetails(cellId, create = false) {
  if (cellId === null || cellId === undefined) return null;
  if (!grid.cellDetails) {
    if (!create) return null;
    grid.cellDetails = {};
  }

  let details = grid.cellDetails[cellId];
  if (!details && create) {
    details = {lore: "", locations: [], characters: []};
    grid.cellDetails[cellId] = details;
  }

  if (details) {
    if (!Array.isArray(details.locations)) details.locations = [];
    if (!Array.isArray(details.characters)) details.characters = [];
    if (typeof details.lore !== "string") details.lore = "";
  }

  return details || null;
}

function createCellEntity(label, defaultName) {
  const uniqueId = `${label}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  return {id: uniqueId, name: defaultName, lore: ""};
}

function getGridEntityById(details, type, id) {
  if (!details || !id) return null;
  const controls = gridEntityControls[type];
  if (!controls) return null;
  const list = details[controls.property];
  if (!Array.isArray(list)) return null;
  return list.find(entity => entity.id === id) || null;
}

function updateGridEntityOptionLabel(type, id, label) {
  const controls = gridEntityControls[type];
  if (!controls?.select) return;
  const option = Array.from(controls.select.options).find(opt => opt.value === id);
  if (option) option.textContent = label || `Unnamed ${controls.label}`;
}

function handleGridEntityPopout(type) {
  if (currentGridCellId === null) return tip("Hover a grid square to select it first", false, "warn", 3000);
  const controls = gridEntityControls[type];
  if (!controls) return;

  const selectedId = gridEntitySelection[type];
  if (!selectedId) return tip(`Select a ${controls.label} first`, false, "warn", 3000);

  const details = ensureGridCellDetails(currentGridCellId, false);
  const entity = getGridEntityById(details, type, selectedId);
  if (!entity) return tip(`Selected ${controls.label} is not available`, false, "error", 3000);
  if (!gridEntityEditor) return;

  activeGridEntityEditor = {type, id: selectedId, cellId: currentGridCellId};
  ensureGridEntityEditorDialog();
  refreshGridEntityEditor();

  const title = type === "locations" ? "Location Details" : "Character Details";
  if (window.jQuery) {
    const $editor = window.jQuery(gridEntityEditor);
    $editor.dialog("option", "title", title);
    $editor.dialog("option", "width", 520);
    $editor.dialog("option", "position", {my: "right top", at: "right-30 top+140", of: "svg", collision: "fit"});
    $editor.dialog("open");
  }

  gridEntityEditorName?.focus();
}

function ensureGridEntityEditorDialog() {
  if (!gridEntityEditor || !window.jQuery) return;
  const $editor = window.jQuery(gridEntityEditor);
  if (!$editor.hasClass("ui-dialog-content")) {
    $editor.dialog({
      autoOpen: false,
      resizable: true,
      modal: false,
      width: 520,
      close: () => {
        activeGridEntityEditor = null;
      }
    });
  }
}

function refreshGridEntityEditor() {
  if (!activeGridEntityEditor || !gridEntityEditor) return;
  if (activeGridEntityEditor.cellId !== currentGridCellId) {
    closeGridEntityEditor();
    return;
  }

  const {type, id} = activeGridEntityEditor;
  const details = ensureGridCellDetails(currentGridCellId, false);
  const entity = getGridEntityById(details, type, id);
  if (!entity) {
    closeGridEntityEditor();
    return;
  }

  if (gridEntityEditorName) gridEntityEditorName.value = entity.name || "";
  if (gridEntityEditorLore) gridEntityEditorLore.value = entity.lore || "";

  if (window.jQuery && window.jQuery(gridEntityEditor).hasClass("ui-dialog-content")) {
    const title = type === "locations" ? "Location Details" : "Character Details";
    window.jQuery(gridEntityEditor).dialog("option", "title", title);
  }
}

function closeGridEntityEditor() {
  if (gridEntityEditor && window.jQuery && window.jQuery(gridEntityEditor).hasClass("ui-dialog-content")) {
    if (window.jQuery(gridEntityEditor).dialog("isOpen")) window.jQuery(gridEntityEditor).dialog("close");
  }
  activeGridEntityEditor = null;
}

function handleGridEntityEditorNameInput() {
  if (!activeGridEntityEditor) return;
  const {type, id, cellId} = activeGridEntityEditor;
  const details = ensureGridCellDetails(cellId, true);
  const entity = getGridEntityById(details, type, id);
  if (!entity) return;

  entity.name = gridEntityEditorName.value;
  if (cellId === currentGridCellId) {
    if (gridEntitySelection[type] === id) {
      const controls = gridEntityControls[type];
      if (controls?.nameInput) {
        const previousSync = syncGridDetails;
        syncGridDetails = true;
        controls.nameInput.value = entity.name;
        syncGridDetails = previousSync;
      }
    }
    updateGridEntityOptionLabel(type, id, entity.name);
  }
}

function handleGridEntityEditorLoreInput() {
  if (!activeGridEntityEditor) return;
  const {type, id, cellId} = activeGridEntityEditor;
  const details = ensureGridCellDetails(cellId, true);
  const entity = getGridEntityById(details, type, id);
  if (!entity) return;

  entity.lore = gridEntityEditorLore.value;
  if (cellId === currentGridCellId && gridEntitySelection[type] === id) {
    const controls = gridEntityControls[type];
    if (controls?.loreInput) {
      const previousSync = syncGridDetails;
      syncGridDetails = true;
      controls.loreInput.value = entity.lore;
      syncGridDetails = previousSync;
    }
  }
}

function getDistanceToCoastLabel(distance, isLand) {
  if (distance === undefined || distance === null || Number.isNaN(distance)) return "n/a";

  const suffix = ` (${distance})`;
  if (distance === 1) return `Coastal land${suffix}`;
  if (distance === 2) return `Landlocked edge${suffix}`;
  if (distance > 2) return `Inland +${distance - 2}${suffix}`;
  if (distance === -1) return `Coastal water${suffix}`;
  if (distance <= -2) return `Deep water +${Math.abs(distance) - 1}${suffix}`;
  return `${isLand ? "Interior land" : "Open water"}${suffix}`;
}

function formatFeatureLabel(feature, id) {
  if (!feature || !id) return "n/a";
  const name = feature.fullName || feature.name || feature.type || feature.group || "feature";
  return `${name} (${id})`;
}

function getGeozone(latitude) {
  if (latitude > 66.5) return "Arctic";
  if (latitude > 35) return "Temperate North";
  if (latitude > 23.5) return "Subtropical North";
  if (latitude > 1) return "Tropical North";
  if (latitude > -1) return "Equatorial";
  if (latitude > -23.5) return "Tropical South";
  if (latitude > -35) return "Subtropical South";
  if (latitude > -66.5) return "Temperate South";
  return "Antarctic";
}

// convert coordinate to DMS format
function toDMS(coord, c) {
  const degrees = Math.floor(Math.abs(coord));
  const minutesNotTruncated = (Math.abs(coord) - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
  const cardinal = c === "lat" ? (coord >= 0 ? "N" : "S") : coord >= 0 ? "E" : "W";
  return degrees + "°" + minutes + "′" + seconds + "″" + cardinal;
}

// get surface elevation
function getElevation(f, h) {
  if (f.land) return getHeight(h) + " (" + h + ")"; // land: usual height
  if (f.border) return "0 " + heightUnit.value; // ocean: 0
  if (f.type === "lake") return getHeight(f.height) + " (" + f.height + ")"; // lake: defined on river generation
}

// get water depth
function getDepth(f, p) {
  if (f.land) return "0 " + heightUnit.value; // land: 0

  // lake: difference between surface and bottom
  const gridH = grid.cells.h[findGridCell(p[0], p[1], grid)];
  if (f.type === "lake") {
    const depth = gridH === 19 ? f.height / 2 : gridH;
    return getHeight(depth, "abs");
  }

  return getHeight(gridH, "abs"); // ocean: grid height
}

// get user-friendly (real-world) height value from map data
function getFriendlyHeight([x, y]) {
  const packH = pack.cells.h[findCell(x, y)];
  const gridH = grid.cells.h[findGridCell(x, y, grid)];
  const h = packH < 20 ? gridH : packH;
  return getHeight(h);
}

function getHeight(h, abs) {
  const unit = heightUnit.value;
  let unitRatio = 3.281; // default calculations are in feet
  if (unit === "m") unitRatio = 1; // if meter
  else if (unit === "f") unitRatio = 0.5468; // if fathom

  let height = -990;
  if (h >= 20) height = Math.pow(h - 18, +heightExponentInput.value);
  else if (h < 20 && h > 0) height = ((h - 20) / h) * 50;

  if (abs) height = Math.abs(height);
  return rn(height * unitRatio) + " " + unit;
}

function getPrecipitation(prec) {
  return prec * 100 + " mm";
}

// get user-friendly (real-world) precipitation value from map data
function getFriendlyPrecipitation(i) {
  const prec = grid.cells.prec[pack.cells.g[i]];
  return getPrecipitation(prec);
}

function getRiverInfo(id) {
  const r = pack.rivers.find(r => r.i == id);
  return r ? `${r.name} ${r.type} (${id})` : "n/a";
}

function getCellPopulation(i) {
  const rural = pack.cells.pop[i] * populationRate;
  const urban = pack.cells.burg[i] ? pack.burgs[pack.cells.burg[i]].population * populationRate * urbanization : 0;
  return [rural, urban];
}

// get user-friendly (real-world) population value from map data
function getFriendlyPopulation(i) {
  const [rural, urban] = getCellPopulation(i);
  return `${si(rural + urban)} (${si(rural)} rural, urban ${si(urban)})`;
}

function getPopulationTip(i) {
  const [rural, urban] = getCellPopulation(i);
  return `Cell population: ${si(rural + urban)}; Rural: ${si(rural)}; Urban: ${si(urban)}`;
}

function highlightEmblemElement(type, el) {
  const i = el.i,
    cells = pack.cells;
  const animation = d3.transition().duration(1000).ease(d3.easeSinIn);

  if (type === "burg") {
    const {x, y} = el;
    debug
      .append("circle")
      .attr("cx", x)
      .attr("cy", y)
      .attr("r", 0)
      .attr("fill", "none")
      .attr("stroke", "#d0240f")
      .attr("stroke-width", 1)
      .attr("opacity", 1)
      .transition(animation)
      .attr("r", 20)
      .attr("opacity", 0.1)
      .attr("stroke-width", 0)
      .remove();
    return;
  }

  const [x, y] = el.pole || pack.cells.p[el.center];
  const obj = type === "state" ? cells.state : cells.province;
  const borderCells = cells.i.filter(id => obj[id] === i && cells.c[id].some(n => obj[n] !== i));
  const data = Array.from(borderCells)
    .filter((c, i) => !(i % 2))
    .map(i => cells.p[i])
    .map(i => [i[0], i[1], Math.hypot(i[0] - x, i[1] - y)]);

  debug
    .selectAll("line")
    .data(data)
    .enter()
    .append("line")
    .attr("x1", x)
    .attr("y1", y)
    .attr("x2", d => d[0])
    .attr("y2", d => d[1])
    .attr("stroke", "#d0240f")
    .attr("stroke-width", 0.5)
    .attr("opacity", 0.2)
    .attr("stroke-dashoffset", d => d[2])
    .attr("stroke-dasharray", d => d[2])
    .transition(animation)
    .attr("stroke-dashoffset", 0)
    .attr("opacity", 1)
    .transition(animation)
    .delay(1000)
    .attr("stroke-dashoffset", d => d[2])
    .attr("opacity", 0)
    .remove();
}

// assign lock behavior
document.querySelectorAll("[data-locked]").forEach(function (e) {
  e.addEventListener("mouseover", function (e) {
    e.stopPropagation();
    if (this.className === "icon-lock")
      tip("Click to unlock the option and allow it to be randomized on new map generation");
    else tip("Click to lock the option and always use the current value on new map generation");
  });

  e.addEventListener("click", function () {
    const ids = this.dataset.ids ? this.dataset.ids.split(",") : [this.id.slice(5)];
    const fn = this.className === "icon-lock" ? unlock : lock;
    ids.forEach(fn);
  });
});

// lock option
function lock(id) {
  const input = document.querySelector('[data-stored="' + id + '"]');
  if (input) store(id, input.value);
  const el = document.getElementById("lock_" + id);
  if (!el) return;
  el.dataset.locked = 1;
  el.className = "icon-lock";
}

// unlock option
function unlock(id) {
  localStorage.removeItem(id);
  const el = document.getElementById("lock_" + id);
  if (!el) return;
  el.dataset.locked = 0;
  el.className = "icon-lock-open";
}

// check if option is locked
function locked(id) {
  const lockEl = document.getElementById("lock_" + id);
  return lockEl.dataset.locked === "1";
}

// return key value stored in localStorage or null
function stored(key) {
  return localStorage.getItem(key) || null;
}

// store key value in localStorage
function store(key, value) {
  return localStorage.setItem(key, value);
}

// assign skeaker behaviour
Array.from(document.getElementsByClassName("speaker")).forEach(el => {
  const input = el.previousElementSibling;
  el.addEventListener("click", () => speak(input.value));
});

function speak(text) {
  const speaker = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  if (voices.length) {
    const voiceId = +document.getElementById("speakerVoice").value;
    speaker.voice = voices[voiceId];
  }
  speechSynthesis.speak(speaker);
}

// apply drop-down menu option. If the value is not in options, add it
function applyOption($select, value, name = value) {
  const isExisting = Array.from($select.options).some(o => o.value === value);
  if (!isExisting) $select.options.add(new Option(name, value));
  $select.value = value;
}

// show info about the generator in a popup
function showInfo() {
  const Discord = link("https://discordapp.com/invite/X7E84HU", "Discord");
  const Reddit = link("https://www.reddit.com/r/FantasyMapGenerator", "Reddit");
  const Patreon = link("https://www.patreon.com/azgaar", "Patreon");
  const Armoria = link("https://azgaar.github.io/Armoria", "Armoria");
  const Deorum = link("https://deorum.vercel.app", "Deorum");

  const QuickStart = link(
    "https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Quick-Start-Tutorial",
    "Quick start tutorial"
  );
  const QAA = link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Q&A", "Q&A page");
  const VideoTutorial = link("https://youtube.com/playlist?list=PLtgiuDC8iVR2gIG8zMTRn7T_L0arl9h1C", "Video tutorial");

  alertMessage.innerHTML = /* html */ `<b>Fantasy Map Generator</b> (FMG) is a free open-source application. It means that you own all created maps and can use them as
    you wish.

    <p>
      The development is community-backed, you can donate on ${Patreon}. You can also help creating overviews, tutorials and spreding the word about the
      Generator.
    </p>

    <p>
      The best way to get help is to contact the community on ${Discord} and ${Reddit}. Before asking questions, please check out the ${QuickStart}, the ${QAA},
      and ${VideoTutorial}.
    </p>

    <ul style="columns:2">
      <li>${link("https://github.com/Azgaar/Fantasy-Map-Generator", "GitHub repository")}</li>
      <li>${link("https://github.com/Azgaar/Fantasy-Map-Generator/blob/master/LICENSE", "License")}</li>
      <li>${link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Changelog", "Changelog")}</li>
      <li>${link("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/Hotkeys", "Hotkeys")}</li>
      <li>${link("https://trello.com/b/7x832DG4/fantasy-map-generator", "Devboard")}</li>
      <li><a href="mailto:azgaar.fmg@yandex.by" target="_blank">Contact Azgaar</a></li>
    </ul>
    
    <p>Check out our other projects:
      <ul>
        <li>${Armoria}: a tool for creating heraldic coats of arms</li>
        <li>${Deorum}: a vast gallery of customizable fantasy characters</li>
      </ul>
    </p>
    
    <p>Chinese localization: <a href="https://www.8desk.top" target="_blank">8desk.top</a></p>`;

  $("#alert").dialog({
    resizable: false,
    title: document.title,
    width: "28em",
    buttons: {
      OK: function () {
        $(this).dialog("close");
      }
    },
    position: {my: "center", at: "center", of: "svg"}
  });
}
