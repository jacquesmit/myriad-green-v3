const form = document.querySelector("#admin-service-report-form");
const statusBanner = document.querySelector("#form-status");
const submitBtn = document.querySelector("#submitBtn");
const addMaterialBtn = document.querySelector("#addMaterialBtn");
const materialsList = document.querySelector("#materialsList");

const CF_URL = "https://africa-south1-myriad-green-v3.cloudfunctions.net/sendServiceReport";

const buildMaterialRow = () => {
  const row = document.createElement("div");
  row.className = "material-row";
  row.innerHTML = `
    <div class="form-group">
      <label>Material Name</label>
      <input type="text" name="materialName" />
    </div>
    <div class="form-group">
      <label>Quantity</label>
      <input type="number" name="materialQuantity" step="0.01" />
    </div>
    <div class="form-group">
      <label>Notes</label>
      <input type="text" name="materialNotes" />
    </div>
    <button type="button" class="btn-link remove-material">Remove</button>
  `;
  row.querySelector(".remove-material").addEventListener("click", () => {
    row.remove();
  });
  return row;
};

const resetStatusBanner = () => {
  statusBanner.hidden = true;
  statusBanner.textContent = "";
  statusBanner.className = "form-status";
};

const showStatus = (message, type = "info") => {
  statusBanner.hidden = false;
  statusBanner.textContent = message;
  statusBanner.className = `form-status ${type}`;
};

const buildMaterialsPayload = () => {
  const rows = Array.from(materialsList.querySelectorAll(".material-row"));
  return rows
    .map((row) => {
      const name = row.querySelector("input[name='materialName']")?.value?.trim();
      const quantityRaw = row.querySelector("input[name='materialQuantity']")?.value;
      const notes = row.querySelector("input[name='materialNotes']")?.value?.trim();
      if (!name) {
        return null;
      }
      const quantity = quantityRaw === undefined || quantityRaw === "" ? null : Number(quantityRaw);
      return {
        name,
        quantity: Number.isFinite(quantity) ? quantity : null,
        notes: notes || null,
      };
    })
    .filter(Boolean);
};

const buildPayload = () => {
  const data = new FormData(form);
  const followUpRequired = form.followUpRequired.checked;
  const visitDateRaw = data.get("visitDate");

  return {
    reportNumber: data.get("reportNumber")?.trim() || null,
    reference: data.get("reference")?.trim() || null,
    serviceName: data.get("serviceName")?.trim() || "Irrigation",
    clientName: data.get("clientName")?.trim() || "",
    clientEmail: data.get("clientEmail")?.trim() || "",
    clientPhone: data.get("clientPhone")?.trim() || null,
    clientAddress: data.get("clientAddress")?.trim() || null,
    suburb: data.get("suburb")?.trim() || null,
    city: data.get("city")?.trim() || null,
    province: data.get("province")?.trim() || null,
    propertyType: data.get("propertyType")?.trim() || null,
    siteNotes: data.get("siteNotes")?.trim() || null,
    technicianName: data.get("technicianName")?.trim() || null,
    technicianNotes: data.get("technicianNotes")?.trim() || null,
    visitDate: visitDateRaw || null,
    arrivalTime: data.get("arrivalTime")?.trim() || null,
    departureTime: data.get("departureTime")?.trim() || null,
    findings: data.get("findings")?.trim() || null,
    actionsTaken: data.get("actionsTaken")?.trim() || null,
    recommendations: data.get("recommendations")?.trim() || null,
    followUpRequired,
    followUpNotes: data.get("followUpNotes")?.trim() || null,
    materialsUsed: buildMaterialsPayload(),
  };
};

const setLoadingState = (isLoading) => {
  submitBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "Submitting..." : "Submit Service Report";
};

const handleSubmit = async (event) => {
  event.preventDefault();
  resetStatusBanner();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const report = buildPayload();
  const payload = { report };
  setLoadingState(true);
  showStatus("Sending service report...", "info");

  try {
    const response = await fetch(CF_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Failed to send report");
    }

    const result = await response.json();
    showStatus(`Service report sent successfully. Report #: ${result.reportNumber}`, "success");
    form.reset();
    materialsList.innerHTML = "";
  } catch (error) {
    console.error("Service report submission failed", error);
    showStatus(error?.message || "An unexpected error occurred.", "error");
  } finally {
    setLoadingState(false);
  }
};

addMaterialBtn.addEventListener("click", () => {
  materialsList.appendChild(buildMaterialRow());
});

form.addEventListener("submit", handleSubmit);
materialsList.appendChild(buildMaterialRow());
