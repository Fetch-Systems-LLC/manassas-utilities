/**
 * content.js — injected into every InvoiceCloud page.
 *
 * Listens for a "collectLinks" message from the popup, then:
 *   1. Scrapes all "View Invoice" links on the current page.
 *   2. Clicks the DataTables "next" button and waits for the table to refresh.
 *   3. Repeats until there are no more pages.
 *   4. Sends the full list back to the popup.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "collectLinks") {
    collectAllLinks()
      .then((links) => sendResponse({ ok: true, links }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true; // keep the message channel open for async response
  }
});

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

/**
 * Returns the DataTables "first" button only when it is clickable
 * (i.e. we are NOT already on page 1).
 */
function getActiveFirstButton() {
  return (
    document.querySelector(".paginate_button.first:not(.disabled)") ||
    document.querySelector("li.first:not(.disabled) > a") ||
    document.querySelector("a.first:not(.disabled)")
  );
}

/**
 * Returns the DataTables "next" button only when it is clickable.
 * DataTables adds the class "disabled" to the button on the last page.
 */
function getActiveNextButton() {
  return (
    document.querySelector(".paginate_button.next:not(.disabled)") ||
    document.querySelector("li.next:not(.disabled) > a") ||
    document.querySelector("a.next:not(.disabled)")
  );
}

/**
 * Returns the text of the DataTables info label, e.g.
 * "Showing 1 to 5 of 24 entries".  Used to detect when the table has
 * rendered the next page after a click.
 */
function getTableInfoText() {
  return document.querySelector(".dataTables_info")?.textContent?.trim() ?? "";
}

/**
 * Clicks the next-page button, then waits until the info text changes
 * (meaning the table has re-rendered), or times out after 5 s.
 */
function clickNextAndWait(btn) {
  return new Promise((resolve) => {
    const before = getTableInfoText();
    btn.click();

    const deadline = Date.now() + 5000;
    const poll = setInterval(() => {
      if (getTableInfoText() !== before || Date.now() > deadline) {
        clearInterval(poll);
        // Small extra buffer for the DOM to finish painting
        setTimeout(resolve, 150);
      }
    }, 100);
  });
}

// ---------------------------------------------------------------------------
// Scraping
// ---------------------------------------------------------------------------

/**
 * Converts an M/D/YYYY date string (as shown in the table) to YYYY-MM-DD
 * so filenames sort chronologically in Finder/Explorer.
 */
function normalizeDate(raw) {
  const parts = raw.split("/");
  if (parts.length !== 3) return raw.replace(/\//g, "-");
  const [m, d, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/**
 * Scrapes all visible "View Invoice" rows from the currently displayed page.
 * Returns an array of { url, filename, dueDate, billNum }.
 */
function scrapeVisibleRows() {
  const results = [];

  document.querySelectorAll("a").forEach((a) => {
    if (!a.textContent.trim().includes("View Invoice")) return;

    const href = a.href;
    // Skip javascript: links — can't download those directly
    if (!href || href.startsWith("javascript:") || href === window.location.href) return;

    const row = a.closest("tr");
    if (!row) return;

    const cells = [...row.querySelectorAll("td")];
    // Column order from live thead:
    // 0: checkbox  1: Invoice (mobile)  2: Bill #  3: Account #  4: Owner  5: Due Date  6: Bill Total  7: Balance Due  8: Actions
    const billNum = cells[2]?.textContent.trim() || "unknown";
    const dueDate = cells[5]?.textContent.trim() || "unknown";
    const normalizedDate = normalizeDate(dueDate);

    results.push({
      url: href,
      filename: `${normalizedDate}_${billNum}.pdf`,
      dueDate,
      billNum,
    });
  });

  return results;
}

// ---------------------------------------------------------------------------
// Main collector
// ---------------------------------------------------------------------------

async function collectAllLinks() {
  const all = [];

  // If the user is mid-table (page 2+), go back to page 1 first.
  const firstBtn = getActiveFirstButton();
  if (firstBtn) await clickNextAndWait(firstBtn);

  // Page 1 — we're now here
  all.push(...scrapeVisibleRows());

  // Paginate through the remaining pages
  let safetyLimit = 100; // never loop forever
  while (safetyLimit-- > 0) {
    const nextBtn = getActiveNextButton();
    if (!nextBtn) break;

    await clickNextAndWait(nextBtn);
    all.push(...scrapeVisibleRows());
  }

  // De-duplicate by URL in case something caused a double-scrape
  const seen = new Set();
  return all.filter(({ url }) => {
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}
