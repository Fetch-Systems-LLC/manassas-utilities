const startBtn        = document.getElementById("startBtn");
const statusBox       = document.getElementById("statusBox");
const progressSection = document.getElementById("progressSection");
const progressBar     = document.getElementById("progressBar");
const progressLabel   = document.getElementById("progressLabel");
const progressCount   = document.getElementById("progressCount");
const fileListSection = document.getElementById("fileListSection");

// ---------------------------------------------------------------------------
// State persistence  (chrome.storage.session survives popup close/reopen
// but clears when the browser is restarted)
// ---------------------------------------------------------------------------

const STATE_KEY = "downloadState";

function saveState(state) {
  return chrome.storage.session.set({ [STATE_KEY]: state });
}

function loadState() {
  return chrome.storage.session.get(STATE_KEY).then((r) => r[STATE_KEY] ?? null);
}

function clearState() {
  return chrome.storage.session.remove(STATE_KEY);
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

function setStatus(msg, type = "") {
  statusBox.textContent = "";
  statusBox.className = "status-box" + (type ? " " + type : "");

  if (type === "running") {
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    statusBox.appendChild(spinner);
  }

  statusBox.appendChild(document.createTextNode(msg));
}

function showProgress(done, total, label) {
  progressSection.style.display = "flex";
  progressBar.max = total;
  progressBar.value = done;
  progressLabel.textContent = label;
  progressCount.textContent = total > 0 ? `${done} / ${total}` : "";
}

// link.status is "pending" | "done" | "error"
function buildFileList(links) {
  fileListSection.style.display = "block";
  fileListSection.innerHTML = "";
  links.forEach((link, i) => {
    const item = document.createElement("div");
    item.className = "file-list-item";
    item.id = `file-item-${i}`;
    item.innerHTML = `
      <span class="dot dot-${link.status ?? "pending"}" id="dot-${i}"></span>
      <span class="name">${link.filename}</span>
      <span class="date">${link.dueDate}</span>
    `;
    fileListSection.appendChild(item);
  });
}

function markFileDone(i) {
  document.getElementById(`dot-${i}`)?.classList.replace("dot-pending", "dot-done");
}

function markFileError(i) {
  document.getElementById(`dot-${i}`)?.classList.replace("dot-pending", "dot-error");
}

// ---------------------------------------------------------------------------
// Restore UI from saved state
// ---------------------------------------------------------------------------

async function restoreUI(state) {
  if (state.phase === "done") {
    setStatus(state.statusMsg, state.statusType);
    if (state.links?.length) buildFileList(state.links);
    progressSection.style.display = "none";
    startBtn.textContent = "Download Again";
    startBtn.disabled = false;
    return;
  }

  // Popup was closed while a download session was in progress.
  // Re-check chrome.downloads to see what actually completed.
  setStatus("Checking download status…", "running");
  const existing = await getExistingDownloads();

  const updatedLinks = (state.links ?? []).map((l) => {
    // Don't downgrade already-resolved statuses
    if (l.status === "done" || l.status === "skip" || l.status === "error") return l;
    return { ...l, status: existing.has(l.filename) ? "done" : "pending" };
  });

  buildFileList(updatedLinks);
  progressSection.style.display = "none";

  const pending = updatedLinks.filter((l) => l.status === "pending").length;
  const doneCount = updatedLinks.filter((l) => l.status === "done").length;

  let msg, type;
  if (pending === 0) {
    msg = `All ${doneCount} bill${doneCount !== 1 ? "s" : ""} are in your Downloads folder.`;
    type = "success";
    await saveState({ ...state, phase: "done", statusMsg: msg, statusType: type, links: updatedLinks });
  } else {
    msg = `${doneCount} downloaded, ${pending} not yet saved. Click Download Again to fetch the rest.`;
    type = "error";
    await saveState({ ...state, links: updatedLinks });
  }

  setStatus(msg, type);
  startBtn.textContent = "Download Again";
  startBtn.disabled = false;
}

// ---------------------------------------------------------------------------
// Existing-download check
// ---------------------------------------------------------------------------

/**
 * Returns a Set of basenames (e.g. "2026-01-28_12345.pdf") that were already
 * successfully downloaded into the "Manassas Bills" folder AND still exist on
 * disk.
 *
 * Chrome's docs warn that r.exists "may be out of date" and advise calling
 * search() to trigger a refresh — but the refresh can be async, meaning the
 * first callback may still carry a stale value. We do two consecutive searches:
 * the first prompts Chrome to recheck the filesystem, the second reads the
 * now-fresh exists values.
 */
function getExistingDownloads() {
  return new Promise((resolve) => {
    const query = { query: ["Manassas Bills"], state: "complete" };
    // First call: triggers Chrome to recheck file existence on disk.
    chrome.downloads.search(query, () => {
      // Second call: reads the freshly updated exists values.
      chrome.downloads.search(query, (results) => {
        const names = new Set(
          results
            .filter((r) => r.exists)
            .map((r) => r.filename.replace(/\\/g, "/").split("/").pop() ?? "")
            .filter(Boolean)
        );
        resolve(names);
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url, filename: `Manassas Bills/${filename}`, conflictAction: "uniquify", saveAs: false },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(downloadId);
        }
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

startBtn.addEventListener("click", async () => {
  await clearState();
  startBtn.disabled = true;
  fileListSection.style.display = "none";
  fileListSection.innerHTML = "";
  progressSection.style.display = "none";

  // 1. Make sure we're on an InvoiceCloud tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.url?.includes("invoicecloud.com")) {
    setStatus("Please open your InvoiceCloud billing page first, then click again.", "error");
    startBtn.disabled = false;
    return;
  }

  // 2. Ask the content script to collect all invoice links
  setStatus("Scanning all pages for invoices…", "running");
  showProgress(0, 0, "Collecting links…");
  progressSection.style.display = "flex";

  let links;
  try {
    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: "collectLinks" }, (res) => {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        resolve(res);
      });
    });

    if (!response?.ok) throw new Error(response?.error ?? "Unknown error from content script");
    links = response.links.map((l) => ({ ...l, status: "pending" }));
  } catch (err) {
    setStatus(`Could not scan the page: ${err.message}`, "error");
    progressSection.style.display = "none";
    startBtn.disabled = false;
    return;
  }

  if (links.length === 0) {
    setStatus("No invoices found on this page.", "error");
    progressSection.style.display = "none";
    startBtn.disabled = false;
    return;
  }

  // 3. Pre-mark any already-downloaded files as skipped
  const existing = await getExistingDownloads();
  links = links.map((l) =>
    existing.has(l.filename) ? { ...l, status: "skip" } : l
  );

  const toDownload = links.filter((l) => l.status !== "skip").length;
  const skippedCount = links.length - toDownload;

  const headerMsg = toDownload === 0
    ? `All ${links.length} invoice${links.length !== 1 ? "s" : ""} already downloaded — nothing to do.`
    : skippedCount > 0
      ? `Found ${links.length} invoices (${skippedCount} already downloaded). Downloading ${toDownload} new…`
      : `Found ${links.length} invoice${links.length !== 1 ? "s" : ""}. Downloading…`;

  setStatus(headerMsg, toDownload === 0 ? "success" : "running");
  buildFileList(links);
  showProgress(0, toDownload, toDownload === 0 ? "" : "Downloading…");

  if (toDownload === 0) {
    await saveState({ phase: "done", statusMsg: headerMsg, statusType: "success", links, done: 0, errorCount: 0 });
    progressSection.style.display = "none";
    startBtn.disabled = false;
    startBtn.textContent = "Download Again";
    return;
  }

  let done = 0;
  let errorCount = 0;

  await saveState({
    phase: "downloading",
    statusMsg: headerMsg,
    statusType: "running",
    links,
    done: 0,
    errorCount: 0,
  });

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    if (link.status === "skip") continue;  // already on disk

    try {
      await downloadFile(link.url, link.filename);
      markFileDone(i);
      links[i] = { ...link, status: "done" };
    } catch (err) {
      console.error(`Failed to download ${link.filename}:`, err.message, link.url);
      markFileError(i);
      links[i] = { ...link, status: "error" };
      errorCount++;
    }
    done++;
    showProgress(done, toDownload, `Downloading… ${done} of ${toDownload}`);
    await saveState({
      phase: "downloading",
      statusMsg: `Downloading… ${done} of ${toDownload}`,
      statusType: "running",
      links,
      done,
      errorCount,
    });
    await new Promise((r) => setTimeout(r, 300));
  }

  // 4. Done
  const saved = toDownload - errorCount;
  const skipNote = skippedCount > 0 ? ` (${skippedCount} already had, shown in blue)` : "";
  let finalMsg, finalType;
  if (errorCount === 0) {
    finalMsg = `Done! Saved ${saved} new bill${saved !== 1 ? "s" : ""} to "Manassas Bills"${skipNote}.`;
    finalType = "success";
  } else {
    finalMsg = `Finished with ${errorCount} error${errorCount !== 1 ? "s" : ""}. ${saved} saved, ${errorCount} failed (red)${skipNote}.`;
    finalType = "error";
  }

  setStatus(finalMsg, finalType);
  await saveState({ phase: "done", statusMsg: finalMsg, statusType: finalType, links, done, errorCount });

  progressSection.style.display = "none";
  startBtn.disabled = false;
  startBtn.textContent = "Download Again";
});

// ---------------------------------------------------------------------------
// On open: restore previous session if one exists
// ---------------------------------------------------------------------------

loadState().then((state) => {
  if (state) restoreUI(state);
});
