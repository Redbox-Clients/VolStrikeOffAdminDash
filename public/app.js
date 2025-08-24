let token = localStorage.getItem("token");
if (!token && window.location.pathname.endsWith("dashboard.html")) {
  window.location.href = "login.html";
}

let currentTab = "unprocessed";
let currentRecords = [];
let selectedRecord = null;

function logout() {
  localStorage.removeItem("token");
  window.location.href = "login.html";
}

function setTab(tab) {
  currentTab = tab;
  document
    .getElementById("tab-unprocessed")
    .classList.toggle("active", tab === "unprocessed");
  document
    .getElementById("tab-processed")
    .classList.toggle("active", tab === "processed");
  loadRecords();
}

async function handleApiResponse(res) {
  if (res.status === 401 || res.status === 403) {
    showToast("Session expired. Please log in again.");
    localStorage.removeItem("token");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 2000);
    return null;
  }

  return res.ok ? await res.json() : null;
}

async function loadRecords() {
  // Show spinner
  document.getElementById("recordListSpinner").classList.remove("hidden");
  document.getElementById("recordTableBody").classList.add("hidden");

  const res = await fetch(
    `/api/records?processed=${currentTab === "processed"}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await handleApiResponse(res);
  if (!data) {
    // Hide spinner if error
    document.getElementById("recordListSpinner").classList.add("hidden");
    document.getElementById("recordTableBody").classList.remove("hidden");
    return;
  }

  currentRecords = data;
  renderTable();
  clearDetails();

  // Hide spinner, show table
  document.getElementById("recordListSpinner").classList.add("hidden");
  document.getElementById("recordTableBody").classList.remove("hidden");
}

function renderTable() {
  const tbody = document.getElementById("recordTableBody");
  tbody.innerHTML = "";

  currentRecords.forEach((record, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${record.companyName || ""}</td>
      <td>${record.fullName || ""}</td>
      <td>${record.emailAddress || ""}</td>
      <td>${record.phone || ""}</td>
      <td>${record.processed ? "Yes" : "No"}</td>
      <td>${
        record.createdAt ? new Date(record.createdAt).toLocaleString() : ""
      }</td>
    `;
    row.addEventListener("click", () => showRecordDetails(record));
    tbody.appendChild(row);
  });
}

function clearDetails() {
  document.getElementById("recordDetails").innerHTML =
    "<p>Select a record to view details.</p>";
  selectedRecord = null;
}

function showRecordDetails(record) {
  selectedRecord = record;
  const container = document.getElementById("recordDetails");
  container.innerHTML = `
    <div class="actions">
      <button onclick="printRecord()">Print</button>
      <button onclick="mark('${
        record._id
      }', 'processed')">Mark Processed</button>
      <button onclick="mark('${
        record._id
      }', 'unprocessed')">Mark Unprocessed</button>
      <button onclick="mark('${record._id}', 'delete')">Delete</button>
    </div>
    ${generateRecordHtml(record)}
  `;
}

function mark(id, action) {
  if (action === "delete") {
    showConfirmModal(id);
  } else {
    performAction(id, action);
  }
}

async function performAction(id, action) {
  try {
    const res = await fetch(`/api/records/${id}/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    });

    const result = await handleApiResponse(res);
    if (!result) return;

    loadRecords();
    showToast(
      `Record ${action === "delete" ? "deleted" : "marked as " + action}`
    );
  } catch (err) {
    console.error("Error:", err);
    showToast("An error occurred.");
  }
}

function printRecord() {
  if (!selectedRecord) return;
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html>
      <head><title>Print Record</title></head>
      <body>${generateRecordHtml(selectedRecord)}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// Confirmation modal logic
let pendingDeleteId = null;

document.getElementById("confirmYes").addEventListener("click", async () => {
  if (!pendingDeleteId) return;

  await performAction(pendingDeleteId, "delete");
  pendingDeleteId = null;
  hideConfirmModal();
});

document.getElementById("confirmNo").addEventListener("click", () => {
  pendingDeleteId = null;
  hideConfirmModal();
});

function showConfirmModal(id) {
  pendingDeleteId = id;
  document.getElementById("confirmModal").classList.remove("hidden");
}

function hideConfirmModal() {
  document.getElementById("confirmModal").classList.add("hidden");
}

function generateRecordHtml(record) {
  const r = record || {};
  return `
      <div class="container mt-5">
      <hr />
      <div class="record-header">
        <h1 style="font-size: 28px; color: #007bff;">${r.fullName || ""}</h1>
        <h2 style="font-size: 24px; color: #333;">${r.companyName || ""}</h2>
        <hr />
      </div>
        <h1>${r.companyName || ""}</h1>
        <h4>Service - ${r.serv || ""}</h4>
        <hr />
        <h3>Details of Advertisement Placer</h3>
        <p><strong>Service:</strong> ${r.serv || ""}</p>
        <p><strong>Role:</strong> ${r.person || ""}</p>
        <p><strong>Full Name:</strong> ${r.fullName || ""}</p>
        <p><strong>Address:</strong> ${r.address || ""}</p>
        <p><strong>Phone Number:</strong> ${r.phone || ""}</p>
        <p><strong>Email Address:</strong> ${r.emailAddress || ""}</p>
        <p><strong>Has Authority:</strong> ${r.authority}</p>
        <hr />
        <h3>Details of Company to be Struck Off</h3>
        <p><strong>Company Name:</strong> ${r.companyName || ""}</p>
        <p><strong>CRO Number:</strong> ${r.croNumber || ""}</p>
        <p><strong>Company Name Changed:</strong> ${r.nameChanged}</p>
        <p><strong>Previous Company Name:</strong> ${
          r.previousCompanyName || ""
        }</p>
        <p><strong>Trading As:</strong> ${r.tradingAs}</p>
        <p><strong>Registered Business Name:</strong> ${
          r.registeredBusName || ""
        }</p>
        <hr />
        <h3>Registered Office</h3>
        <p><strong>Address:</strong> 
          ${r.registeredAddress1 || ""} 
          ${r.registeredAddress2 || ""} 
          ${r.registeredRegion || ""} 
          ${r.registeredCity || ""} 
          ${r.registeredPostalCode || ""} 
          ${r.registeredCountry || ""}
        </p>
        <p><strong>Previous Register Office:</strong> ${
          r.prevRegisterOffice
        }</p>
        <hr />
        <h3>Previous Registered Office</h3>
        <p><strong>Address:</strong> 
          ${r.prevAddress1 || ""} 
          ${r.prevAddress2 || ""} 
          ${r.prevRegion || ""} 
          ${r.prevCity || ""} 
          ${r.prevPostalCode || ""} 
          ${r.prevCountry || ""}
        </p>
        <hr />
        <h3>Business Address</h3>
        <p><strong>Different from Registered Address:</strong> ${
          r.difAddress
        }</p>
        <p><strong>Address:</strong> 
          ${r.busAddress1 || ""} 
          ${r.busAddress2 || ""} 
          ${r.busRegion || ""} 
          ${r.busCity || ""} 
          ${r.busPostalCode || ""} 
          ${r.busCountry || ""}
        </p>
        <hr />
        <h3>Previous Trading History</h3>
        <p><strong>Previously Traded:</strong> ${r.previouslyTraded}</p>
        <p><strong>Ceased Trading Date:</strong> ${
          r.ceasedTradingDate || ""
        }</p>
        <p><strong>Letter of No Objection:</strong> ${r.letterOfNoObjection}</p>
        <p><strong>Letter Assistance:</strong> ${r.letterAssistance}</p>
        <p><strong>Registered for Taxes:</strong> ${r.registeredForTaxes}</p>
        <p><strong>Company Tax Number:</strong> ${r.companyTaxNumber || ""}</p>
        <p><strong>De-Registered:</strong> ${r.deRegistered}</p>
        <p><strong>Tax Return Submitted:</strong> ${r.taxReturnSubmitted}</p>
        <p><strong>Taxes Paid:</strong> ${r.taxesPaid}</p>
        <hr />
        <h3>Company Law Provisions</h3>
        <p><strong>No Longer Trading:</strong> ${r.companyNoLongerTrading}</p>
        <p><strong>Returns Up To Date:</strong> ${r.returnsUpToDate}</p>
        <p><strong>Assets ≤ €150:</strong> ${!r.assetsExceed150}</p>
        <p><strong>Liabilities ≤ €150:</strong> ${!r.liabilitiesExceed150}</p>
        <p><strong>Ongoing Litigation:</strong> ${r.ongoingLitigation}</p>
        <hr />
        <h3>Details of Director or Secretary</h3>
        <p><strong>First Name:</strong> ${r.strikeOffByFirstName || ""}</p>
        <p><strong>Last Name:</strong> ${r.strikeOffByLastName || ""}</p>
        <p><strong>Strike Off By:</strong> ${r.strikeOffBy || ""}</p>
        <p><strong>T&Cs Agreed:</strong> ${r.tandcAgreed}</p>
        <hr />
        <p><strong>Record ID:</strong> ${r._id}</p>
        <p><strong>Created At:</strong> ${
          r.createdAt ? new Date(r.createdAt).toLocaleString() : "N/A"
        }</p>
        <p><strong>Processed:</strong> ${r.processed ? "Yes" : "No"}</p>
      </div>
    `;
}

if (window.location.pathname.endsWith("dashboard.html")) {
  setTab("unprocessed");
}
